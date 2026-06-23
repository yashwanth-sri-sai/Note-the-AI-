import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.document import Document, DocumentChunk, Embedding
from app.services.embedding import get_embedding_provider
from app.services.reranking import get_reranker_provider


class RetrievalService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_provider = get_embedding_provider()
        self.reranker_provider = get_reranker_provider()

    async def retrieve_context(
        self,
        workspace_id: uuid.UUID,
        query: str,
        limit: int = 5,
        document_ids: Optional[List[uuid.UUID]] = None,
        file_types: Optional[List[str]] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Perform workspace-scoped semantic similarity search, applying filters and the reranking layer."""
        # 1. Generate query embedding
        query_vector = await self.embedding_provider.get_embedding(query)
        
        # 2. Build cosine distance query fetching up to 20 candidates
        distance_col = Embedding.embedding.cosine_distance(query_vector)
        
        stmt = (
            select(
                DocumentChunk.chunk_uuid,
                DocumentChunk.chunk_text,
                DocumentChunk.page_number,
                DocumentChunk.section_title,
                DocumentChunk.token_count,
                DocumentChunk.source_reference,
                Document.id.label("document_id"),
                Document.filename.label("document_name"),
                distance_col.label("distance")
            )
            .join(DocumentChunk, Embedding.chunk_id == DocumentChunk.id)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.workspace_id == workspace_id)
            .where(Document.status == "completed")
        )
        
        # Apply filters
        if document_ids:
            stmt = stmt.where(Document.id.in_(document_ids))
        if file_types:
            stmt = stmt.where(Document.content_type.in_(file_types))
        if date_start:
            stmt = stmt.where(Document.created_at >= date_start)
        if date_end:
            stmt = stmt.where(Document.created_at <= date_end)
            
        stmt = stmt.order_by("distance").limit(20)  # Retrieve 20 candidates for reranking
        
        result = await self.db.execute(stmt)
        rows = result.all()
        
        # 3. Format candidates, mapping distance to similarity score
        candidates = []
        for row in rows:
            similarity = 1.0 - float(row.distance)
            candidates.append({
                "chunk_uuid": row.chunk_uuid,
                "chunk_text": row.chunk_text,
                "similarity_score": similarity,
                "document_name": row.document_name,
                "document_id": row.document_id,
                "page_number": row.page_number,
                "section_title": row.section_title,
                "token_count": row.token_count,
                "source_reference": row.source_reference
            })
            
        # 4. Apply reranker to filter and sort down to the top limit (default 5)
        reranked_results = await self.reranker_provider.rerank(query, candidates, top_n=limit)
        return reranked_results
