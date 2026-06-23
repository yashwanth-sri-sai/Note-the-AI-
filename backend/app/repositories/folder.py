from typing import List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.folder import Folder
from app.repositories.base import BaseRepository


class FolderRepository(BaseRepository[Folder]):
    def __init__(self, db: AsyncSession):
        super().__init__(Folder, db)

    async def get_by_workspace_id(self, workspace_id: UUID) -> List[Folder]:
        """Fetch all folders belonging to a specific workspace."""
        query = select(Folder).where(Folder.workspace_id == workspace_id).order_by(Folder.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())
