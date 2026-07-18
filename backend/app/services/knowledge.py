"""
KnowledgeService — Unified abstraction layer over Notes and Documents.

Responsibilities:
  - Load and normalize Notes + Documents into KnowledgeSource objects
  - Resolve source IDs for Flashcard/Quiz FK lookups
  - Fetch text context from either source type for AI generation
  - Filter, sort, and merge knowledge sources for the workspace

This service does NOT modify the database schema. It operates purely as a
read-side abstraction that normalizes the two existing tables.
"""
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)

from app.db.models.note import Note
from app.db.models.document import Document, DocumentChunk
from app.schemas.knowledge import KnowledgeSourceResponse


class KnowledgeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_workspace_sources(
        self,
        workspace_id: uuid.UUID,
        include_processing: bool = False,
    ) -> List[KnowledgeSourceResponse]:
        """
        Return a unified, sorted list of all knowledge sources in a workspace.
        
        Notes that are shadow entries for documents (same UUID in both tables)
        are excluded from the notes section to prevent duplicates.
        """
        # 1. Fetch all documents in this workspace
        doc_stmt = select(Document).where(Document.workspace_id == workspace_id)
        if not include_processing:
            doc_stmt = doc_stmt.where(func.lower(Document.status).in_(["completed", "ready"]))
        doc_res = await self.db.execute(doc_stmt)
        documents = doc_res.scalars().all()

        # Build set of document IDs (these are also shadow note IDs)
        doc_id_set = {doc.id for doc in documents}

        # 2. Fetch all notes in this workspace, excluding document-mapped shadow notes
        note_stmt = select(Note).where(Note.workspace_id == workspace_id)
        note_res = await self.db.execute(note_stmt)
        all_notes = note_res.scalars().all()
        pure_notes = [n for n in all_notes if n.id not in doc_id_set]

        # 3. Normalize documents into KnowledgeSourceResponse
        sources: List[KnowledgeSourceResponse] = []
        for doc in documents:
            sources.append(KnowledgeSourceResponse(
                id=doc.id,
                source_type="document",
                title=doc.filename,
                status=doc.status,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                metadata={
                    "file_size": doc.file_size,
                    "content_type": doc.content_type,
                },
            ))

        # 4. Normalize notes into KnowledgeSourceResponse
        for note in pure_notes:
            word_count = len(note.content.split()) if note.content else 0
            sources.append(KnowledgeSourceResponse(
                id=note.id,
                source_type="note",
                title=note.title or "Untitled Note",
                status="ready",
                created_at=note.created_at,
                updated_at=note.updated_at,
                metadata={
                    "word_count": word_count,
                    "is_favorite": note.is_favorite,
                    "folder_id": str(note.folder_id) if note.folder_id else None,
                },
            ))

        # 5. Sort by updated_at descending (most recent first)
        sources.sort(key=lambda s: s.updated_at, reverse=True)

        # Diagnostic audit log — visible in Railway logs
        doc_ids = [str(d.id) for d in documents]
        logger.info(
            f"[KNOWLEDGE SOURCES] workspace={workspace_id} "
            f"include_processing={include_processing} "
            f"docs_returned={len(documents)} "
            f"notes_returned={len(pure_notes)} "
            f"total={len(sources)} "
            f"doc_ids={doc_ids}"
        )
        return sources

    async def get_source_context(
        self,
        source_type: str,
        source_id: uuid.UUID,
        workspace_id: uuid.UUID,
        chunk_limit: int = 10,
    ) -> str:
        """
        Fetch the text content for a knowledge source.
        
        For documents: concatenates chunk texts in order.
        For notes: returns the note's content field.
        """
        if source_type == "document":
            return await self._get_document_context(source_id, workspace_id, chunk_limit)
        else:
            return await self._get_note_context(source_id, workspace_id)

    async def resolve_note_id(self, source_type: str, source_id: uuid.UUID) -> uuid.UUID:
        """
        Resolve a knowledge source to the note_id used as FK for Flashcards/Quizzes.
        
        For notes: returns the note ID directly.
        For documents: returns the document ID (which is also the shadow note ID).
        """
        # Both cases return source_id because documents create shadow notes with id = doc.id
        return source_id

    # ---- Private helpers ----

    async def _get_document_context(
        self, doc_id: uuid.UUID, workspace_id: uuid.UUID, limit: int = 10
    ) -> str:
        """Fetch concatenated chunk text for a document."""
        stmt = (
            select(DocumentChunk.chunk_text, Document.filename)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.id == doc_id)
            .where(Document.workspace_id == workspace_id)
            .where(func.lower(Document.status).in_(["completed", "ready"]))
            .order_by(DocumentChunk.chunk_index)
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        rows = res.all()
        logger.info(f"[AUDIT] Retrieved {len(rows)} chunks for document_id={doc_id}")
        if rows:
            parts = [f"[{r.filename}]\n{r.chunk_text}" for r in rows]
            return "\n\n".join(parts)
        return ""

    async def _get_note_context(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> str:
        """Fetch note content."""
        stmt = select(Note).where(Note.id == note_id, Note.workspace_id == workspace_id)
        res = await self.db.execute(stmt)
        note = res.scalar_one_or_none()
        if note and note.content and note.content.strip():
            logger.info(f"[AUDIT] Note content retrieved for note_id={note_id}, length={len(note.content)}")
            return note.content
        logger.info(f"[AUDIT] No content found for note_id={note_id}")
        return ""
