from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db
from app.db.models.user import User
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
    WorkspaceMemberCreate,
    WorkspaceMemberResponse,
)
from app.services.workspace import WorkspaceService

router = APIRouter()


@router.get("/", response_model=List[WorkspaceResponse])
async def get_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all workspaces that the current user belongs to."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.get_user_workspaces(current_user.id)


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workspace, automatically designating the creator as Owner."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.create_workspace(current_user.id, payload)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch details of a specific workspace, verifying membership."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.get_workspace(workspace_id, current_user.id)


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: UUID,
    payload: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update workspace details (Requires owner/administrator privileges)."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.update_workspace(workspace_id, current_user.id, payload)


@router.delete("/{workspace_id}", status_code=status.HTTP_200_OK)
async def delete_workspace(
    workspace_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a workspace (Requires owner privilege)."""
    workspace_service = WorkspaceService(db)
    await workspace_service.delete_workspace(workspace_id, current_user.id)
    return {"message": "Workspace deleted successfully."}


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_workspace_member(
    workspace_id: UUID,
    payload: WorkspaceMemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new member to the workspace (Requires owner/administrator privileges)."""
    workspace_service = WorkspaceService(db)
    return await workspace_service.add_member(
        workspace_id, current_user.id, payload.email, payload.role
    )
