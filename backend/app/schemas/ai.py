import uuid
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, field_validator


class AISearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(5, ge=1, le=50)


class FlashcardResponse(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    question: str
    answer: str
    ease_factor: int
    interval_days: int
    repetitions: int
    next_review: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class FlashcardReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class QuizQuestionResponse(BaseModel):
    id: uuid.UUID
    question_text: str
    choices: List[str]
    correct_answer: str
    explanation: Optional[str] = None

    class Config:
        from_attributes = True


class QuizResponse(BaseModel):
    id: uuid.UUID
    note_id: uuid.UUID
    title: str
    questions: List[QuizQuestionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class QuizSubmissionRequest(BaseModel):
    answers: Dict[uuid.UUID, str]  # Map question ID to user's selected choice string


class QuizQuestionResult(BaseModel):
    is_correct: bool
    correct_answer: str
    user_answer: str
    explanation: Optional[str] = None


class QuizSubmissionResponse(BaseModel):
    quiz_id: uuid.UUID
    score: int
    total_questions: int
    results: Dict[uuid.UUID, QuizQuestionResult]


class KnowledgeGraphNode(BaseModel):
    id: uuid.UUID
    title: str
    folder_id: Optional[uuid.UUID] = None


class KnowledgeGraphEdgeResponse(BaseModel):
    id: uuid.UUID
    source: uuid.UUID
    target: uuid.UUID
    relation_type: str
    weight: float

    class Config:
        from_attributes = True


class KnowledgeGraphResponse(BaseModel):
    nodes: List[KnowledgeGraphNode]
    edges: List[KnowledgeGraphEdgeResponse]


class KnowledgeGraphEdgeCreate(BaseModel):
    source_note_id: uuid.UUID
    target_note_id: uuid.UUID
    relation_type: str = "references"
    weight: float = 1.0
