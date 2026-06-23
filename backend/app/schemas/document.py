import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    filename: str
    file_size: int
    content_type: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProcessingJobResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChunkNavigationResponse(BaseModel):
    chunk_uuid: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    chunk_text: str
    source_reference: Optional[str] = None

    class Config:
        from_attributes = True

