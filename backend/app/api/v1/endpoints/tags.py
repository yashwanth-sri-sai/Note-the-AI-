from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.db.models.user import User
from app.schemas.tag import TagCreate, TagResponse
from app.services.tag import TagService

router = APIRouter()


@router.get("/", response_model=List[TagResponse])
async def get_tags(
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List all tags inside the active workspace."""
    tag_service = TagService(db)
    return await tag_service.get_workspace_tags(workspace_id)


@router.post("/", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tag inside the active workspace."""
    tag_service = TagService(db)
    return await tag_service.create_tag(workspace_id, payload)


@router.delete("/{tag_id}", status_code=status.HTTP_200_OK)
async def delete_tag(
    tag_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a tag. Associated notes will remain but no longer carry this tag."""
    tag_service = TagService(db)
    await tag_service.delete_tag(tag_id, workspace_id)
    return {"message": "Tag deleted successfully."}
