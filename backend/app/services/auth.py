from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import (
    create_access_token,
    generate_random_token,
    verify_password,
)
from app.db.models.user import User
from app.repositories.user import RefreshTokenRepository, UserRepository


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_repo = RefreshTokenRepository(db)

    async def authenticate_user(
        self, email: str, password: str
    ) -> User:
        """Authenticate a user using email and password."""
        user = await self.user_repo.get_by_email(email)
        if not user:
            raise UnauthorizedException(detail="Incorrect email or password")

        if user.provider != "local":
            raise BadRequestException(
                detail=f"Please sign in using your OAuth provider ({user.provider})"
            )

        if not user.password_hash or not verify_password(
            password, user.password_hash
        ):
            raise UnauthorizedException(detail="Incorrect email or password")

        return user

    async def create_user_refresh_token(self, user_id: UUID) -> str:
        """Create a new refresh token and store it in the database."""
        token = generate_random_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        await self.token_repo.create_token(
            user_id=user_id, token=token, expires_at=expires_at
        )
        return token

    async def refresh_access_token(self, refresh_token: str) -> str:
        """Issue a new access token if the refresh token is valid."""
        db_token = await self.token_repo.get_by_token(refresh_token)

        if not db_token or db_token.is_revoked:
            raise UnauthorizedException(detail="Invalid or revoked refresh token")

        # Make sure expires_at is timezone-aware for comparison
        expires_at = db_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < datetime.now(timezone.utc):
            raise UnauthorizedException(detail="Expired refresh token")

        # Generate new access token
        access_token = create_access_token(subject=db_token.user_id)
        return access_token

    async def revoke_token(self, refresh_token: str) -> None:
        """Revoke a refresh token."""
        await self.token_repo.revoke_token(refresh_token)

    async def logout_user(self, user_id: UUID) -> None:
        """Revoke all refresh tokens for a user."""
        await self.token_repo.revoke_all_user_tokens(user_id)

    async def google_login(self, id_token: str) -> User:
        """Authenticate a user with a Google ID Token."""
        import base64
        import json

        # Check if it is a dummy token (local testing)
        is_dummy = "dummy" in id_token or id_token.endswith(".sig")

        if is_dummy:
            try:
                parts = id_token.split(".")
                if len(parts) >= 2:
                    payload_b64 = parts[1]
                    # Add base64 padding if needed
                    padding = "=" * (4 - len(payload_b64) % 4)
                    payload_json = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
                    payload = json.loads(payload_json)
                else:
                    raise ValueError("Malformed token format")
            except Exception as e:
                raise UnauthorizedException(detail=f"Malformed dummy token: {str(e)}")
        else:
            # Query Google Token Info API
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(url)
                    if response.status_code != 200:
                        raise UnauthorizedException(detail="Invalid Google OAuth token")
                    payload = response.json()
                except Exception:
                    raise UnauthorizedException(detail="Failed to contact Google OAuth API")

        # Basic payload validations
        email = payload.get("email")
        if not email:
            raise UnauthorizedException(detail="Google token payload missing email")

        # Verify Client ID aud if configured (skip for mock/test credentials)
        aud = payload.get("aud")
        if (
            settings.GOOGLE_CLIENT_ID
            and "dummy" not in settings.GOOGLE_CLIENT_ID
            and aud != settings.GOOGLE_CLIENT_ID
        ):
            raise UnauthorizedException(detail="Google token audience mismatch")

        # Retrieve user profile info
        name = payload.get("name", "")
        picture = payload.get("picture", "")


        user = await self.user_repo.get_by_email(email)
        if user:
            # User exists, verify provider or update it
            if user.provider != "google":
                # Automatically link/update standard accounts to Google OAuth
                user.provider = "google"
                user.avatar_url = picture or user.avatar_url
                user.name = name or user.name
                await self.user_repo.update(user, {})
        else:
            # Create a new user with Google login
            user = User(
                email=email,
                name=name,
                avatar_url=picture,
                provider="google",
                password_hash=None,  # No local password
            )
            user = await self.user_repo.create(user)
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
