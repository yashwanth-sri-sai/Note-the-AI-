from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    def __init__(self, db: AsyncSession):
        super().__init__(Workspace, db)

    async def get_by_slug(self, slug: str) -> Optional[Workspace]:
        """Fetch a workspace by its unique slug."""
        query = select(Workspace).where(Workspace.slug == slug)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_workspaces(self, user_id: UUID) -> List[Workspace]:
        """Fetch all workspaces that the user is a member of."""
        query = (
            select(Workspace)
            .join(WorkspaceMember)
            .where(WorkspaceMember.user_id == user_id)
            .order_by(Workspace.name)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())


class WorkspaceMemberRepository(BaseRepository[WorkspaceMember]):
    def __init__(self, db: AsyncSession):
        super().__init__(WorkspaceMember, db)

    async def get_by_workspace_and_user(
        self, workspace_id: UUID, user_id: UUID
    ) -> Optional[WorkspaceMember]:
        """Fetch workspace membership for a specific user and workspace."""
        query = select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_workspace_members(self, workspace_id: UUID) -> List[WorkspaceMember]:
        """Fetch all member mappings for a specific workspace, loading user information."""
        query = (
            select(WorkspaceMember)
            .where(WorkspaceMember.workspace_id == workspace_id)
            .options(selectinload(WorkspaceMember.user))
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
