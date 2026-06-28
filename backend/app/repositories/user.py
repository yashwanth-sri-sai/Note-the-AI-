from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.user import RefreshToken, User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> Optional[User]:
        """Fetch a user by email address."""
        from sqlalchemy import func
        query = select(User).where(func.lower(User.email) == func.lower(email.strip()))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    def __init__(self, db: AsyncSession):
        super().__init__(RefreshToken, db)

    async def get_by_token(self, token: str) -> Optional[RefreshToken]:
        """Fetch a refresh token record by token string."""
        query = select(RefreshToken).where(RefreshToken.token == token)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_token(
        self, user_id: UUID, token: str, expires_at: datetime
    ) -> RefreshToken:
        """Create a new refresh token for a user."""
        db_token = RefreshToken(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
            is_revoked=False,
            created_at=datetime.now(timezone.utc),
        )
        return await self.create(db_token)

    async def revoke_token(self, token: str) -> None:
        """Mark a refresh token as revoked."""
        query = (
            update(RefreshToken)
            .where(RefreshToken.token == token)
            .values(is_revoked=True)
        )
        await self.db.execute(query)

    async def revoke_all_user_tokens(self, user_id: UUID) -> None:
        """Revoke all active refresh tokens for a user (e.g. on logout/password change)."""
        query = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(is_revoked=True)
        )
        await self.db.execute(query)
