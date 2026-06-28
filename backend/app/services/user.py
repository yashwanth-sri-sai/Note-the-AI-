from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import ConflictException, NotFoundException
from app.core.security import get_password_hash
from app.db.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)

    async def get_user_by_id(self, user_id: UUID) -> User:
        """Retrieve user details by ID, or raise 404."""
        user = await self.user_repo.get(user_id)
        if not user:
            raise NotFoundException(detail="User not found")
        return user

    async def create_user(self, user_in: UserCreate) -> User:
        """Register a new user in the system."""
        email_lower = user_in.email.lower().strip()
        existing_user = await self.user_repo.get_by_email(email_lower)
        if existing_user:
            raise ConflictException(detail="Email already registered")

        password_hash = get_password_hash(user_in.password)
        db_user = User(
            email=email_lower,
            name=user_in.name,
            avatar_url=user_in.avatar_url,
            password_hash=password_hash,
            provider="local",
        )
        user = await self.user_repo.create(db_user)
        await self.db.flush()

        # Create a default workspace for the user
        from app.services.workspace import WorkspaceService
        from app.schemas.workspace import WorkspaceCreate
        workspace_service = WorkspaceService(self.db)
        await workspace_service.create_workspace(
            user.id,
            WorkspaceCreate(name="Personal Workspace")
        )
        return user

    async def update_user(self, user_id: UUID, user_in: UserUpdate) -> User:
        """Update a user's details and/or password."""
        user = await self.get_user_by_id(user_id)
        update_data = user_in.model_dump(exclude_unset=True)

        if "password" in update_data and update_data["password"]:
            update_data["password_hash"] = get_password_hash(
                update_data.pop("password")
            )
        else:
            update_data.pop("password", None)

        return await self.user_repo.update(user, update_data)

    async def delete_user(self, user_id: UUID) -> User:
        """Permanently delete a user account."""
        user = await self.get_user_by_id(user_id)
        await self.user_repo.delete(user_id)
        return user

    async def create_user_from_supabase(self, user_id: UUID, email: str, name: str, avatar_url: Optional[str] = None) -> User:
        """Cache a user record that was authenticated via Supabase Auth."""
        try:
            # Check if user already exists
            existing_user = await self.get_user_by_id(user_id)
            return existing_user
        except NotFoundException:
            pass

        db_user = User(
            id=user_id,
            email=email,
            name=name,
            avatar_url=avatar_url,
            password_hash=None,
            provider="supabase",
        )
        user = await self.user_repo.create(db_user)
        await self.db.flush()

        # Create a default workspace for the user
        from app.services.workspace import WorkspaceService
        from app.schemas.workspace import WorkspaceCreate
        workspace_service = WorkspaceService(self.db)
        await workspace_service.create_workspace(
            user.id,
            WorkspaceCreate(name="Personal Workspace")
        )
        return user
