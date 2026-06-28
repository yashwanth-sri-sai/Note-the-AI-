import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class KnowledgeSourceResponse(BaseModel):
    """Unified representation of a knowledge source (note or document)."""
    id: uuid.UUID
    source_type: str  # "note" | "document"
    title: str
    status: str  # "ready" for notes, document processing status for documents
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = {}

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class GenerateFromSourceRequest(BaseModel):
    """Request body for generating flashcards/quizzes from any knowledge source."""
    source_type: str = Field(..., pattern="^(note|document)$", description="Type of source: 'note' or 'document'")
    source_id: uuid.UUID = Field(..., description="UUID of the note or document")
