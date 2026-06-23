from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.db.models.user import User
from app.schemas.folder import FolderCreate, FolderResponse, FolderUpdate
from app.services.folder import FolderService

router = APIRouter()


@router.get("/", response_model=List[FolderResponse])
async def get_folders(
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List all folders in the active workspace."""
    folder_service = FolderService(db)
    return await folder_service.get_workspace_folders(workspace_id)


@router.post("/", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new folder in the active workspace."""
    folder_service = FolderService(db)
    return await folder_service.create_folder(workspace_id, payload)


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    payload: FolderUpdate,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Rename or update description for a folder in the active workspace."""
    folder_service = FolderService(db)
    return await folder_service.update_folder(folder_id, workspace_id, payload)


@router.delete("/{folder_id}", status_code=status.HTTP_200_OK)
async def delete_folder(
    folder_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a folder. Associated notes inside are unassigned (folder_id=null)."""
    folder_service = FolderService(db)
    await folder_service.delete_folder(folder_id, workspace_id)
    return {"message": "Folder deleted successfully."}
