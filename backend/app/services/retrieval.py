import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
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
        query: Union[str, List[str]],
        limit: int = 5,
        document_ids: Optional[List[uuid.UUID]] = None,
        file_types: Optional[List[str]] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        diagnostics: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Perform workspace-scoped semantic similarity search, applying filters and the reranking layer."""
        
        queries = [query] if isinstance(query, str) else query
        if not queries:
            return []
            
        original_query = queries[0]
        all_raw_candidates = []
        
        # 1. Generate query embeddings in parallel (Network I/O)
        import asyncio
        query_vectors = await asyncio.gather(
            *(self.embedding_provider.get_embedding(q) for q in queries)
        )
        
        # 2. Execute DB queries sequentially to ensure database safety (no shared session corruption)
        for query_vector in query_vectors:
            # Build cosine distance query fetching up to 50 candidates per query
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
                
            # Apply similarity threshold
            stmt = stmt.where(distance_col < 0.65)
                
            stmt = stmt.order_by("distance").limit(50)
            
            result = await self.db.execute(stmt)
            rows = result.all()
            
            # 3. Format candidates, mapping distance to similarity score
            for row in rows:
                similarity = 1.0 - float(row.distance)
                all_raw_candidates.append({
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
        
        # Sort all raw candidates by similarity score before deduplication so we keep the highest scores
        all_raw_candidates.sort(key=lambda x: x["similarity_score"], reverse=True)

        # 4. Deduplicate candidates using overlap check before sending to reranker (saves API costs)
        deduped_candidates = []
        for chunk in all_raw_candidates:
            text_val = chunk.get("chunk_text", "").strip()
            if not text_val:
                continue
                
            is_duplicate = False
            set1 = frozenset(text_val.lower().split())
            if not set1:
                continue
                
            for accepted in deduped_candidates:
                accepted_text = accepted.get("chunk_text", "").strip()
                set2 = frozenset(accepted_text.lower().split())
                if not set2:
                    continue
                    
                overlap = len(set1.intersection(set2))
                min_len = min(len(set1), len(set2))
                
                # If > 75% of the smaller chunk's tokens are present in the other, it's a sliding window duplicate
                if min_len > 0 and (overlap / min_len) > 0.75:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                deduped_candidates.append(chunk)
            
        # 5. Apply reranker to filter and sort down to the top limit (default 10)
        # We always use the original query (first item) for reranking the pooled candidates
        reranked_results = await self.reranker_provider.rerank(original_query, deduped_candidates, top_n=limit)
        
        if diagnostics is not None:
            diagnostics["retrieval_count_before_rerank"] = len(all_raw_candidates)
            diagnostics["retrieval_count_after_dedup"] = len(deduped_candidates)
            diagnostics["retrieval_count_after_rerank"] = len(reranked_results)
            
        return reranked_results
