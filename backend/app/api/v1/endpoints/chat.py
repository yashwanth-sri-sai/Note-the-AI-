import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.db.models.user import User
from fastapi.responses import StreamingResponse
from app.schemas.chat import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse, ChatResponse
from app.services.chat import ChatService
from app.services.rag_generation import RAGGenerationService

router = APIRouter()


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Initialize a new chat conversation session inside the current active workspace."""
    chat_service = ChatService(db)
    return await chat_service.create_conversation(workspace_id, payload.title or "New Chat", current_user.id)


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List all chat conversation sessions scoped to the current active workspace."""
    chat_service = ChatService(db)
    return await chat_service.list_conversations(workspace_id)


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def list_conversation_messages(
    conversation_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full message history log for a single conversation session."""
    chat_service = ChatService(db)
    conversation = await chat_service.get_conversation(conversation_id, workspace_id)
    return conversation.messages


from app.api.middlewares.rate_limiter import limiter
from fastapi import Request

@router.post("/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def send_message_rag(
    request: Request,
    conversation_id: uuid.UUID,
    payload: MessageCreate,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit user message, execute pgvector context retrieval, log history, and generate LLM cited response (streams if requested)."""
    chat_service = ChatService(db)
    rag_service = RAGGenerationService(db)
    
    if payload.stream:
        # Stream response in SSE format
        generator = rag_service.generate_answer_stream(
            workspace_id=workspace_id,
            question=payload.content,
            document_ids=payload.document_ids,
            note_ids=payload.note_ids,
            file_types=payload.file_types,
            date_start=payload.date_start,
            date_end=payload.date_end,
            conversation_id=conversation_id,
            user_id=current_user.id
        )
        return StreamingResponse(generator, media_type="text/event-stream")
        
    # Standard non-streaming flow
    cited_answer, references, confidence = await rag_service.generate_answer(
        workspace_id=workspace_id,
        question=payload.content,
        document_ids=payload.document_ids,
        note_ids=payload.note_ids,
        file_types=payload.file_types,
        date_start=payload.date_start,
        date_end=payload.date_end,
        conversation_id=conversation_id,
        user_id=current_user.id
    )
    
    # Reload user and assistant messages to return them in schema format
    conversation = await chat_service.get_conversation(conversation_id, workspace_id)
    # The last two messages are user and assistant
    messages = conversation.messages
    user_msg = messages[-2] if len(messages) >= 2 else None
    assistant_msg = messages[-1] if len(messages) >= 1 else None
    
    return ChatResponse(
        user_message=MessageResponse.model_validate(user_msg) if user_msg else None,
        assistant_message=MessageResponse.model_validate(assistant_msg) if assistant_msg else None,
        references=references
    )
