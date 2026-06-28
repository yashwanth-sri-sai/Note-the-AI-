import uuid
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    document_ids: Optional[List[uuid.UUID]] = None
    note_ids: Optional[List[uuid.UUID]] = None
    file_types: Optional[List[str]] = None
    date_start: Optional[datetime] = None
    date_end: Optional[datetime] = None
    stream: Optional[bool] = False



class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_role: str
    content: str
    model_used: Optional[str] = None
    retrieved_chunks: Optional[Any] = None
    citation_metadata: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ConversationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatRetrievalReference(BaseModel):
    chunk_uuid: uuid.UUID
    chunk_text: str
    similarity_score: float
    document_name: str
    document_id: uuid.UUID
    page_number: Optional[int] = None
    section_title: Optional[str] = None
    token_count: int
    source_reference: Optional[str] = None


class ChatResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
    references: List[ChatRetrievalReference] = []


class RetrievalDebugResponse(BaseModel):
    references: List[ChatRetrievalReference]
    retrieval_latency_ms: float
    retrieval_count: int
    total_context_tokens: int

