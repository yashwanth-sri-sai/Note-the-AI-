import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field("#3B82F6", max_length=7)

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("Color must be a valid hex code (e.g. #3B82F6)")
        # Test if characters after '#' are hex digits
        if not all(c.isalnum() for c in v[1:]):
            raise ValueError("Color must be a valid hex color string")
        return v


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=7)


class TagResponse(TagBase):
    id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}
