from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ForbiddenException, NotFoundException
from app.db.models.folder import Folder
from app.repositories.folder import FolderRepository
from app.schemas.folder import FolderCreate, FolderUpdate


class FolderService:
    def __init__(self, db: AsyncSession):
        self.folder_repo = FolderRepository(db)

    async def get_folder(self, folder_id: UUID, workspace_id: UUID) -> Folder:
        """Fetch folder by ID and verify workspace scoping."""
        folder = await self.folder_repo.get(folder_id)
        if not folder:
            raise NotFoundException(detail="Folder not found")
        if folder.workspace_id != workspace_id:
            raise ForbiddenException(detail="Access denied to folder")
        return folder

    async def get_workspace_folders(self, workspace_id: UUID) -> List[Folder]:
        """Fetch all folders belonging to the workspace."""
        return await self.folder_repo.get_by_workspace_id(workspace_id)

    async def create_folder(self, workspace_id: UUID, folder_in: FolderCreate) -> Folder:
        """Create a new folder inside a workspace."""
        db_folder = Folder(
            name=folder_in.name,
            description=folder_in.description,
            workspace_id=workspace_id,
        )
        return await self.folder_repo.create(db_folder)

    async def update_folder(
        self, folder_id: UUID, workspace_id: UUID, folder_in: FolderUpdate
    ) -> Folder:
        """Update folder details."""
        folder = await self.get_folder(folder_id, workspace_id)
        return await self.folder_repo.update(folder, folder_in)

    async def delete_folder(self, folder_id: UUID, workspace_id: UUID) -> Folder:
        """Delete a folder. Associated notes' folder_id is set to null in database."""
        folder = await self.get_folder(folder_id, workspace_id)
        await self.folder_repo.delete(folder_id)
        return folder
