import re
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ForbiddenException, NotFoundException, ConflictException
from app.db.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.repositories.workspace import WorkspaceRepository, WorkspaceMemberRepository
from app.repositories.user import UserRepository
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


class WorkspaceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.workspace_repo = WorkspaceRepository(db)
        self.member_repo = WorkspaceMemberRepository(db)
        self.user_repo = UserRepository(db)

    async def get_user_workspaces(self, user_id: uuid.UUID) -> List[Workspace]:
        """Fetch all workspaces user belongs to."""
        return await self.workspace_repo.get_user_workspaces(user_id)

    async def get_workspace(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> Workspace:
        """Fetch a specific workspace and verify membership."""
        membership = await self.member_repo.get_by_workspace_and_user(workspace_id, user_id)
        if not membership:
            raise ForbiddenException(detail="Access denied to this workspace")
        
        workspace = await self.workspace_repo.get(workspace_id)
        if not workspace:
            raise NotFoundException(detail="Workspace not found")
        return workspace

    async def create_workspace(self, user_id: uuid.UUID, workspace_in: WorkspaceCreate) -> Workspace:
        """Create a new workspace and assign the creator as Owner."""
        # Generate slug if not provided
        slug = workspace_in.slug
        if not slug:
            # Generate from name: lower, strip non-alphanumeric/hyphen
            clean_name = workspace_in.name.lower().strip()
            clean_name = re.sub(r"[^a-z0-9\-]+", "-", clean_name)
            slug = re.sub(r"\-+", "-", clean_name).strip("-")
            if not slug:
                slug = "workspace"

        # Ensure slug is unique
        base_slug = slug
        suffix = 1
        while True:
            existing = await self.workspace_repo.get_by_slug(slug)
            if not existing:
                break
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        # Create workspace
        db_workspace = Workspace(
            name=workspace_in.name,
            slug=slug,
        )
        db_workspace = await self.workspace_repo.create(db_workspace)

        # Create owner membership mapping
        db_member = WorkspaceMember(
            workspace_id=db_workspace.id,
            user_id=user_id,
            role=WorkspaceRole.OWNER,
        )
        await self.member_repo.create(db_member)
        
        await self.db.flush()
        return db_workspace

    async def update_workspace(
        self, workspace_id: uuid.UUID, user_id: uuid.UUID, workspace_in: WorkspaceUpdate
    ) -> Workspace:
        """Update workspace details (Requires OWNER or ADMIN role)."""
        membership = await self.member_repo.get_by_workspace_and_user(workspace_id, user_id)
        if not membership or membership.role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise ForbiddenException(detail="Only owners and administrators can edit workspace settings")

        workspace = await self.workspace_repo.get(workspace_id)
        if not workspace:
            raise NotFoundException(detail="Workspace not found")

        updated = await self.workspace_repo.update(workspace, workspace_in)
        await self.db.flush()
        return updated

    async def delete_workspace(self, workspace_id: uuid.UUID, user_id: uuid.UUID) -> Workspace:
        """Permanently delete a workspace (Requires OWNER role)."""
        membership = await self.member_repo.get_by_workspace_and_user(workspace_id, user_id)
        if not membership or membership.role != WorkspaceRole.OWNER:
            raise ForbiddenException(detail="Only the workspace owner can delete it")

        workspace = await self.workspace_repo.get(workspace_id)
        if not workspace:
            raise NotFoundException(detail="Workspace not found")

        await self.workspace_repo.delete(workspace_id)
        await self.db.flush()
        return workspace

    async def add_member(
        self, workspace_id: uuid.UUID, requester_id: uuid.UUID, email: str, role: WorkspaceRole
    ) -> WorkspaceMember:
        """Invite/Add a new member to a workspace (Requires OWNER or ADMIN role)."""
        requester_membership = await self.member_repo.get_by_workspace_and_user(workspace_id, requester_id)
        if not requester_membership or requester_membership.role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise ForbiddenException(detail="Only owners and administrators can add members")

        # Find target user
        target_user = await self.user_repo.get_by_email(email)
        if not target_user:
            raise NotFoundException(detail="User with this email not found")

        # Check existing membership
        existing_membership = await self.member_repo.get_by_workspace_and_user(workspace_id, target_user.id)
        if existing_membership:
            raise ConflictException(detail="User is already a member of this workspace")

        # Create membership
        db_member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=target_user.id,
            role=role,
        )
        db_member = await self.member_repo.create(db_member)
        await self.db.flush()
        return db_member
