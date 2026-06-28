"""
Knowledge Source API endpoints.

Provides a unified interface for:
  - Listing all knowledge sources (notes + documents) in a workspace
  - Generating flashcards from any knowledge source
  - Generating quizzes from any knowledge source
  - Retrieving flashcards/quizzes by source type and ID

Legacy /ai/notes/{note_id}/* endpoints remain untouched for backward compatibility.
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)

from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.db.models.user import User
from app.schemas.knowledge import KnowledgeSourceResponse, GenerateFromSourceRequest
from app.schemas.ai import FlashcardResponse, QuizResponse
from app.services.knowledge import KnowledgeService
from app.services.ai import AIService

router = APIRouter()


@router.get("/sources", response_model=List[KnowledgeSourceResponse])
async def list_knowledge_sources(
    include_processing: bool = False,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List all knowledge sources (notes + completed documents) in the active workspace."""
    ks = KnowledgeService(db)
    return await ks.get_workspace_sources(workspace_id, include_processing=include_processing)


@router.post("/flashcards/generate", response_model=List[FlashcardResponse], status_code=status.HTTP_201_CREATED)
async def generate_flashcards_from_source(
    payload: GenerateFromSourceRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate flashcards from any knowledge source (note or document)."""
    ks = KnowledgeService(db)
    ai_service = AIService(db)

    logger.info(f"[AUDIT] Flashcard generation started for source_type='{payload.source_type}', source_id='{payload.source_id}'")

    # Resolve the note_id FK for storage
    note_id = await ks.resolve_note_id(payload.source_type, payload.source_id)
    logger.info(f"[AUDIT] Resolved reference_id (note_id) = {note_id}")

    # Fetch context from the source
    context = await ks.get_source_context(payload.source_type, payload.source_id, workspace_id)
    
    context_length = len(context) if context else 0
    logger.info(f"[AUDIT] Combined text length retrieved: {context_length}")
    
    MIN_CONTEXT_THRESHOLD = 50
    logger.info(f"[AUDIT] Minimum context threshold: {MIN_CONTEXT_THRESHOLD}")
    if context_length < MIN_CONTEXT_THRESHOLD:
        logger.error(f"[AUDIT] Generation aborted: context too short ({context_length} < {MIN_CONTEXT_THRESHOLD})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to auto-generate flashcards. Make sure the source has sufficient context text."
        )

    try:
        # Generate using the existing AI service, but with explicit context
        return await ai_service.generate_flashcards_with_context(note_id, context)
    except Exception as e:
        logger.error(f"[AUDIT] Generation aborted due to exception: {str(e)}")
        raise e


@router.post("/quizzes/generate", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def generate_quiz_from_source(
    payload: GenerateFromSourceRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a quiz from any knowledge source (note or document)."""
    ks = KnowledgeService(db)
    ai_service = AIService(db)

    logger.info(f"[AUDIT] Quiz generation started for source_type='{payload.source_type}', source_id='{payload.source_id}'")

    note_id = await ks.resolve_note_id(payload.source_type, payload.source_id)
    logger.info(f"[AUDIT] Resolved reference_id (note_id) = {note_id}")

    context = await ks.get_source_context(payload.source_type, payload.source_id, workspace_id)
    
    context_length = len(context) if context else 0
    logger.info(f"[AUDIT] Combined text length retrieved: {context_length}")

    MIN_CONTEXT_THRESHOLD = 50
    logger.info(f"[AUDIT] Minimum context threshold: {MIN_CONTEXT_THRESHOLD}")
    if context_length < MIN_CONTEXT_THRESHOLD:
        logger.error(f"[AUDIT] Generation aborted: context too short ({context_length} < {MIN_CONTEXT_THRESHOLD})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to generate quiz. Check that the source has sufficient text context."
        )

    try:
        return await ai_service.generate_quiz_with_context(note_id, context)
    except Exception as e:
        logger.error(f"[AUDIT] Generation aborted due to exception: {str(e)}")
        raise e


@router.get("/{source_type}/{source_id}/flashcards", response_model=List[FlashcardResponse])
async def get_source_flashcards(
    source_type: str,
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all flashcards for a knowledge source."""
    ks = KnowledgeService(db)
    ai_service = AIService(db)

    note_id = await ks.resolve_note_id(source_type, source_id)
    return await ai_service.get_note_flashcards(note_id, workspace_id)


@router.get("/{source_type}/{source_id}/quizzes", response_model=List[QuizResponse])
async def get_source_quizzes(
    source_type: str,
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all quizzes for a knowledge source."""
    ks = KnowledgeService(db)
    ai_service = AIService(db)

    note_id = await ks.resolve_note_id(source_type, source_id)
    return await ai_service.get_note_quizzes(note_id, workspace_id)
