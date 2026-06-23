from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.db.models.user import User
from app.schemas.note import NoteCreate, NoteResponse, NoteUpdate
from app.services.note import NoteService

router = APIRouter()


class NoteTagsRequest(BaseModel):
    tag_ids: List[UUID]


@router.get("/", response_model=List[NoteResponse])
async def get_notes(
    folder_id: Optional[UUID] = Query(None),
    tag_id: Optional[UUID] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List notes in the active workspace with optional filters (by folder, tag, or favorite status)."""
    note_service = NoteService(db)
    return await note_service.get_workspace_notes(
        workspace_id=workspace_id,
        folder_id=folder_id,
        tag_id=tag_id,
        is_favorite=is_favorite,
    )


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full details of a specific note, including its tags."""
    note_service = NoteService(db)
    return await note_service.get_note(note_id, workspace_id)


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new note in the active workspace."""
    note_service = NoteService(db)
    return await note_service.create_note(workspace_id, current_user.id, payload)


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Update note details (title, content, folder, or favorite status)."""
    note_service = NoteService(db)
    return await note_service.update_note(note_id, workspace_id, payload, current_user.id)


@router.delete("/{note_id}", status_code=status.HTTP_200_OK)
async def delete_note(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a note from the workspace."""
    note_service = NoteService(db)
    await note_service.delete_note(note_id, workspace_id)
    return {"message": "Note deleted successfully."}


@router.post("/{note_id}/duplicate", response_model=NoteResponse)
async def duplicate_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate an existing note inside the active workspace."""
    note_service = NoteService(db)
    return await note_service.duplicate_note(note_id, workspace_id, current_user.id)


@router.post("/{note_id}/tags", response_model=NoteResponse)
async def set_note_tags(
    note_id: UUID,
    payload: NoteTagsRequest,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Associate a list of tags with a note. Replaces any existing tags."""
    note_service = NoteService(db)
    return await note_service.set_note_tags(
        note_id, workspace_id, payload.tag_ids
    )


from app.schemas.note import NoteVersionResponse

@router.get("/{note_id}/versions", response_model=List[NoteVersionResponse])
async def list_note_versions(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List all version snapshots of a note, ordered by version number descending."""
    note_service = NoteService(db)
    return await note_service.list_note_versions(note_id, workspace_id)


@router.post("/{note_id}/versions/{version_id}/restore", response_model=NoteResponse)
async def restore_note_version(
    note_id: UUID,
    version_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Restore a note's state to a specific history snapshot."""
    note_service = NoteService(db)
    return await note_service.restore_note_version(note_id, version_id, workspace_id)
