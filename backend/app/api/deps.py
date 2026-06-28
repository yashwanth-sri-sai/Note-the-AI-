from typing import AsyncGenerator, Optional
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.db.session import get_db
from app.db.models.user import User
from app.services.user import UserService
from uuid import UUID

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> User:
    """Dependency to retrieve and validate the currently authenticated user from the JWT access token."""
    if not token:
        raise UnauthorizedException(detail="Not authenticated")

    try:
        # Decode the access token (ignoring audience validation for Supabase integration)
        payload = jwt.decode(
            token.credentials, settings.SECRET_KEY, algorithms=["HS256"], options={"verify_aud": False}
        )
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedException(detail="Invalid token payload")

        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise UnauthorizedException(detail="Could not validate credentials")

    # Fetch user from db, auto-creating them if they are verified by Supabase Auth but not yet cached locally
    user_service = UserService(db)
    try:
        user = await user_service.get_user_by_id(user_id)
        return user
    except Exception:
        email = payload.get("email")
        if not email:
            raise UnauthorizedException(detail="User not found and email claim missing from token")
        
        user_metadata = payload.get("user_metadata", {}) or {}
        name = user_metadata.get("name") or user_metadata.get("full_name") or email.split("@")[0]
        avatar_url = user_metadata.get("avatar_url")
        
        try:
            user = await user_service.create_user_from_supabase(
                user_id=user_id,
                email=email,
                name=name,
                avatar_url=avatar_url
            )
            return user
        except Exception as e:
            raise UnauthorizedException(detail=f"Failed to auto-cache Supabase user: {str(e)}")


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to retrieve the currently authenticated user and assert admin privileges."""
    if not current_user.is_admin:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException(detail="Insufficient privileges. Admin access required.")
    return current_user


from fastapi import Header
from app.core.exceptions import BadRequestException

async def get_current_workspace_id(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """Dependency to retrieve the active workspace UUID.
    
    Verifies that the user is a member of the workspace.
    If the header is not provided, defaults to the user's first workspace membership.
    If the user has no workspaces, a default workspace is automatically created.
    """
    from app.services.workspace import WorkspaceService
    from app.schemas.workspace import WorkspaceCreate
    
    workspace_service = WorkspaceService(db)
    
    if x_workspace_id:
        try:
            workspace_uuid = UUID(x_workspace_id)
        except ValueError:
            raise BadRequestException(detail="Invalid X-Workspace-ID header format")
        
        # Verify user is member of this workspace
        await workspace_service.get_workspace(workspace_uuid, current_user.id)
        return workspace_uuid
        
    # If no workspace header is sent, find user's workspaces
    user_workspaces = await workspace_service.get_user_workspaces(current_user.id)
    if user_workspaces:
        return user_workspaces[0].id
        
    # If no workspaces exist at all, create a default personal workspace for them
    default_ws = await workspace_service.create_workspace(
        current_user.id,
        WorkspaceCreate(name="Personal Workspace")
    )
    return default_ws.id
