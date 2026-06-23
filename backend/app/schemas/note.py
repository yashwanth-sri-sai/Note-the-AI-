import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.tag import TagResponse


class NoteBase(BaseModel):
    title: Optional[str] = Field("Untitled Note", max_length=255)
    content: Optional[str] = Field("", description="Markdown content of the note")
    folder_id: Optional[uuid.UUID] = Field(
        None, description="UUID of the folder this note belongs to"
    )
    is_favorite: Optional[bool] = Field(False)


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = Field(None)
    folder_id: Optional[uuid.UUID] = Field(None)
    is_favorite: Optional[bool] = Field(None)


class NoteResponse(NoteBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    tags: List[TagResponse] = []

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class NoteVersionResponse(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    title_snapshot: str
    content_snapshot: str
    version_number: int
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}
