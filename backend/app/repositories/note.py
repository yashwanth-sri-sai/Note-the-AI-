from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.note import Note
from app.repositories.base import BaseRepository


class NoteRepository(BaseRepository[Note]):
    def __init__(self, db: AsyncSession):
        super().__init__(Note, db)

    async def get_with_tags(self, id: UUID) -> Optional[Note]:
        """Fetch a single note and eagerly load its tags."""
        query = (
            select(Note)
            .where(Note.id == id)
            .options(selectinload(Note.tags))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_workspace_notes(
        self,
        workspace_id: UUID,
        folder_id: Optional[UUID] = None,
        tag_id: Optional[UUID] = None,
        is_favorite: Optional[bool] = None,
    ) -> List[Note]:
        """Get all notes in a workspace, filtered by folder, tags, or favorites."""
        from app.db.models.document import Document
        
        query = (
            select(Note)
            .where(Note.workspace_id == workspace_id)
            .where(~Note.id.in_(select(Document.id)))
            .options(selectinload(Note.tags))
        )

        if folder_id is not None:
            query = query.where(Note.folder_id == folder_id)

        if is_favorite is not None:
            query = query.where(Note.is_favorite == is_favorite)

        if tag_id is not None:
            from app.db.models.tag import Tag
            # Filter by joined tag association
            query = query.join(Note.tags).where(Note.tags.any(Tag.id == tag_id))

        # Order by recently updated first
        query = query.order_by(Note.updated_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())
