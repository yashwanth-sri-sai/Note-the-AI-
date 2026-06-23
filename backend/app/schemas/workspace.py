import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.db.models.workspace import WorkspaceRole


class WorkspaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class WorkspaceCreate(WorkspaceBase):
    slug: Optional[str] = Field(None, min_length=3, max_length=100)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            # Slug must be alphanumeric + hyphens
            if not all(c.isalnum() or c == "-" for c in v):
                raise ValueError("Slug must contain only alphanumeric characters and hyphens")
            return v.lower()
        return v


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class WorkspaceMemberCreate(BaseModel):
    email: str
    role: WorkspaceRole = WorkspaceRole.EDITOR


class WorkspaceMemberResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: WorkspaceRole
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class WorkspaceResponse(WorkspaceBase):
    id: uuid.UUID
    slug: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}
