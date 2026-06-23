from typing import List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.tag import Tag
from app.repositories.base import BaseRepository


class TagRepository(BaseRepository[Tag]):
    def __init__(self, db: AsyncSession):
        super().__init__(Tag, db)

    async def get_by_workspace_id(self, workspace_id: UUID) -> List[Tag]:
        """Fetch all tags created in a specific workspace."""
        query = select(Tag).where(Tag.workspace_id == workspace_id).order_by(Tag.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_ids(self, workspace_id: UUID, tag_ids: List[UUID]) -> List[Tag]:
        """Fetch tags belonging to a workspace matching a list of IDs."""
        if not tag_ids:
            return []
        query = (
            select(Tag)
            .where(Tag.workspace_id == workspace_id)
            .where(Tag.id.in_(tag_ids))
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
