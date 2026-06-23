from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ForbiddenException, NotFoundException
from app.db.models.tag import Tag
from app.repositories.tag import TagRepository
from app.schemas.tag import TagCreate, TagUpdate


class TagService:
    def __init__(self, db: AsyncSession):
        self.tag_repo = TagRepository(db)

    async def get_tag(self, tag_id: UUID, workspace_id: UUID) -> Tag:
        """Fetch a specific tag and verify workspace scoping."""
        tag = await self.tag_repo.get(tag_id)
        if not tag:
            raise NotFoundException(detail="Tag not found")
        if tag.workspace_id != workspace_id:
            raise ForbiddenException(detail="Access denied to tag")
        return tag

    async def get_workspace_tags(self, workspace_id: UUID) -> List[Tag]:
        """Fetch all tags created in the workspace."""
        return await self.tag_repo.get_by_workspace_id(workspace_id)

    async def create_tag(self, workspace_id: UUID, tag_in: TagCreate) -> Tag:
        """Create a new tag for the workspace."""
        # Prevent duplicate tag names for the same workspace
        existing_tags = await self.tag_repo.get_by_workspace_id(workspace_id)
        for t in existing_tags:
            if t.name.lower() == tag_in.name.lower():
                return t  # Return existing tag to prevent duplicates (idempotent create)

        db_tag = Tag(name=tag_in.name, color=tag_in.color, workspace_id=workspace_id)
        return await self.tag_repo.create(db_tag)

    async def delete_tag(self, tag_id: UUID, workspace_id: UUID) -> Tag:
        """Delete a tag."""
        tag = await self.get_tag(tag_id, workspace_id)
        await self.tag_repo.delete(tag_id)
        return tag
