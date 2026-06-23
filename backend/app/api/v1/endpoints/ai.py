from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.api.middlewares.rate_limiter import rate_limit_search
from app.db.models.user import User
from app.schemas.note import NoteResponse
from app.schemas.ai import (
    AISearchRequest,
    FlashcardResponse,
    FlashcardReviewRequest,
    QuizResponse,
    QuizSubmissionRequest,
    QuizSubmissionResponse,
    KnowledgeGraphResponse,
    KnowledgeGraphEdgeResponse,
    KnowledgeGraphEdgeCreate,
)
from app.schemas.chat import RetrievalDebugResponse
from app.services.retrieval import RetrievalService
from app.services.ai import AIService
import time

router = APIRouter()


@router.post("/search", response_model=List[NoteResponse])
async def semantic_search(
    request: Request,
    payload: AISearchRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit_search),
):
    """Perform a fuzzy semantic text search across notes inside the active workspace."""
    import time
    import asyncio
    from app.services.metrics import log_request_metrics_task

    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else None
    ai_service = AIService(db)
    
    try:
        results = await ai_service.search_notes_semantic(workspace_id, payload.query, payload.limit)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        
        asyncio.create_task(
            log_request_metrics_task(
                user_id=current_user.id,
                workspace_id=workspace_id,
                endpoint="/search",
                method="POST",
                status_code=200,
                client_ip=client_ip,
                total_response_ms=latency_ms,
                retrieval_latency_ms=latency_ms,
                llm_latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                provider="None",
                model_name="None"
            )
        )
        return results
    except Exception as e:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        asyncio.create_task(
            log_request_metrics_task(
                user_id=current_user.id if current_user else None,
                workspace_id=workspace_id,
                endpoint="/search",
                method="POST",
                status_code=500,
                client_ip=client_ip,
                total_response_ms=latency_ms,
                retrieval_latency_ms=latency_ms,
                llm_latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                provider="None",
                model_name="None",
                error_message=str(e)
            )
        )
        raise e


@router.post("/retrieve-debug", response_model=RetrievalDebugResponse)
async def retrieve_debug(
    request: Request,
    payload: AISearchRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit_search),
):
    """Debug retrieval engine, returning cosine similarity scores, character offsets, and token budget analytics."""
    import time
    import asyncio
    from app.services.metrics import log_request_metrics_task

    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else None
    retrieval_service = RetrievalService(db)
    
    try:
        retrieval_start = time.perf_counter()
        references = await retrieval_service.retrieve_context(workspace_id, payload.query, payload.limit)
        retrieval_latency_ms = (time.perf_counter() - retrieval_start) * 1000.0
        
        total_tokens = sum([ref.get("token_count", 0) for ref in references])
        total_response_ms = (time.perf_counter() - start_time) * 1000.0
        
        asyncio.create_task(
            log_request_metrics_task(
                user_id=current_user.id,
                workspace_id=workspace_id,
                endpoint="/retrieve-debug",
                method="POST",
                status_code=200,
                client_ip=client_ip,
                total_response_ms=total_response_ms,
                retrieval_latency_ms=retrieval_latency_ms,
                llm_latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=total_tokens,
                provider="None",
                model_name="None"
            )
        )
        
        return {
            "references": references,
            "retrieval_latency_ms": retrieval_latency_ms,
            "retrieval_count": len(references),
            "total_context_tokens": total_tokens
        }
    except Exception as e:
        total_response_ms = (time.perf_counter() - start_time) * 1000.0
        asyncio.create_task(
            log_request_metrics_task(
                user_id=current_user.id if current_user else None,
                workspace_id=workspace_id,
                endpoint="/retrieve-debug",
                method="POST",
                status_code=500,
                client_ip=client_ip,
                total_response_ms=total_response_ms,
                retrieval_latency_ms=total_response_ms,
                llm_latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                provider="None",
                model_name="None",
                error_message=str(e)
            )
        )
        raise e


# =========================================================================
# FLASHCARDS (Spaced Repetition)
# =========================================================================


@router.get("/notes/{note_id}/flashcards", response_model=List[FlashcardResponse])
async def get_note_flashcards(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all flashcards created for a specific note."""
    ai_service = AIService(db)
    return await ai_service.get_note_flashcards(note_id, workspace_id)


@router.post("/notes/{note_id}/flashcards/generate", response_model=List[FlashcardResponse], status_code=status.HTTP_201_CREATED)
async def generate_note_flashcards(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate review flashcards by parsing the note text."""
    ai_service = AIService(db)
    return await ai_service.generate_note_flashcards(note_id, workspace_id)


@router.post("/flashcards/{flashcard_id}/review", response_model=FlashcardResponse)
async def review_flashcard(
    flashcard_id: UUID,
    payload: FlashcardReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a spaced repetition review score (1-5) and update the scheduling interval."""
    ai_service = AIService(db)
    return await ai_service.review_flashcard(flashcard_id, current_user.id, payload.rating)


# =========================================================================
# QUIZZES
# =========================================================================


@router.get("/notes/{note_id}/quizzes", response_model=List[QuizResponse])
async def get_note_quizzes(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all quizzes created for a specific note."""
    ai_service = AIService(db)
    return await ai_service.get_note_quizzes(note_id, workspace_id)


@router.post("/notes/{note_id}/quizzes/generate", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def generate_note_quiz(
    note_id: UUID,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate a multiple choice quiz evaluating note concepts."""
    ai_service = AIService(db)
    return await ai_service.generate_note_quiz(note_id, workspace_id)


@router.post("/quizzes/{quiz_id}/submit", response_model=QuizSubmissionResponse)
async def submit_quiz(
    quiz_id: UUID,
    payload: QuizSubmissionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit quiz responses, grade the questions, and fetch detailed feedback."""
    ai_service = AIService(db)
    return await ai_service.submit_quiz(quiz_id, payload.answers)


# =========================================================================
# KNOWLEDGE GRAPH
# =========================================================================


@router.get("/knowledge-graph", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all nodes (notes) and edge relationships for interactive mapping."""
    ai_service = AIService(db)
    return await ai_service.get_workspace_knowledge_graph(workspace_id)


@router.post("/knowledge-graph/edges", response_model=KnowledgeGraphEdgeResponse, status_code=status.HTTP_201_CREATED)
async def create_graph_edge(
    payload: KnowledgeGraphEdgeCreate,
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Add a visual relationship link between two notes inside the active workspace."""
    ai_service = AIService(db)
    return await ai_service.create_graph_edge(workspace_id, payload)
