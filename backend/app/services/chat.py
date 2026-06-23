import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import NotFoundException, ForbiddenException
from app.db.models.chat import Conversation, Message


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_conversation(
        self, workspace_id: uuid.UUID, title: str, user_id: Optional[uuid.UUID] = None
    ) -> Conversation:
        """Initialize a new chat conversation session inside the workspace."""
        conversation = Conversation(
            workspace_id=workspace_id,
            title=title,
            created_by=user_id
        )
        self.db.add(conversation)
        await self.db.flush()
        return conversation

    async def list_conversations(self, workspace_id: uuid.UUID) -> List[Conversation]:
        """Fetch all chat sessions scoped to the current active workspace."""
        stmt = (
            select(Conversation)
            .where(Conversation.workspace_id == workspace_id)
            .order_by(Conversation.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_conversation(self, conversation_id: uuid.UUID, workspace_id: uuid.UUID) -> Conversation:
        """Fetch details for a single conversation session, verifying workspace scoping."""
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(selectinload(Conversation.messages))
        )
        result = await self.db.execute(stmt)
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise NotFoundException(detail="Conversation session not found")
        if conversation.workspace_id != workspace_id:
            raise ForbiddenException(detail="Access denied to conversation session")
            
        return conversation

    async def add_message(
        self, conversation_id: uuid.UUID, workspace_id: uuid.UUID, sender_role: str, content: str
    ) -> Message:
        """Append a user or assistant response to the conversation log."""
        # Verify scoping
        await self.get_conversation(conversation_id, workspace_id)
        
        message = Message(
            conversation_id=conversation_id,
            sender_role=sender_role,
            content=content
        )
        self.db.add(message)
        await self.db.flush()
        return message

    async def delete_conversation(self, conversation_id: uuid.UUID, workspace_id: uuid.UUID) -> None:
        """Delete a conversation log."""
        conversation = await self.get_conversation(conversation_id, workspace_id)
        await self.db.delete(conversation)
        await self.db.flush()
