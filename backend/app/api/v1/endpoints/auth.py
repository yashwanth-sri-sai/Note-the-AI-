from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db
from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserResponse
from app.services.auth import AuthService
from app.services.user import UserService

router = APIRouter()


def set_refresh_cookie(response: Response, token: str) -> None:
    """Helper to set refresh token HttpOnly cookie."""
    is_production = settings.ENVIRONMENT == "production"
    # Cookie expires in settings.REFRESH_TOKEN_EXPIRE_DAYS days
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=is_production,
        samesite="lax" if not is_production else "strict",
        max_age=max_age,
        path="/",  # accessible by all backend routes
    )


def clear_refresh_cookie(response: Response) -> None:
    """Helper to clear refresh token cookie."""
    is_production = settings.ENVIRONMENT == "production"
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=is_production,
        samesite="lax" if not is_production else "strict",
        path="/",
    )


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    payload: RegisterRequest, db: AsyncSession = Depends(get_db)
):
    """Register a new standard user account."""
    user_service = UserService(db)
    user_in = UserCreate(
        email=payload.email,
        password=payload.password,
        name=payload.name,
    )
    user = await user_service.create_user(user_in)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    """Log in an existing user and set a refresh cookie."""
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(payload.email, payload.password)

    # Create tokens
    from app.core.security import create_access_token

    access_token = create_access_token(subject=user.id)
    refresh_token = await auth_service.create_user_refresh_token(user.id)

    set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/oauth/google", response_model=TokenResponse)
async def google_oauth(
    payload: GoogleAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user using Google OAuth credential ID Token."""
    auth_service = AuthService(db)
    user = await auth_service.google_login(payload.token)

    # Create tokens
    from app.core.security import create_access_token

    access_token = create_access_token(subject=user.id)
    refresh_token = await auth_service.create_user_refresh_token(user.id)

    set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new access token using the HTTP-only refresh token."""
    if not refresh_token:
        raise BadRequestException(detail="Refresh token cookie missing")

    auth_service = AuthService(db)
    new_access_token = await auth_service.refresh_access_token(refresh_token)
    return TokenResponse(access_token=new_access_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    response: Response,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """Log out user and revoke the active refresh token."""
    if refresh_token:
        auth_service = AuthService(db)
        try:
            await auth_service.revoke_token(refresh_token)
        except Exception:
            pass  # Fail silently if token is already bad

    clear_refresh_cookie(response)
    return {"message": "Successfully logged out"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Initiate a password reset request. Returns success response (mock)."""
    # For Phase 1, we return a mock success response to avoid configuring real SMTP servers
    return {
        "message": "If this email is registered, a password reset link has been sent."
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Set a new password using a token. Returns success response (mock)."""
    # For Phase 1, we return a mock success response
    return {"message": "Password has been reset successfully."}
