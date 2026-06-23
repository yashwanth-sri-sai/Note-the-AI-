import os
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db
from app.core.exceptions import BadRequestException
from app.db.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.services.user import UserService

router = APIRouter()

# Directory for storing avatars
AVATAR_DIR = "static/avatars"


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get details of the currently authenticated user."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update profile information or password for the current user."""
    user_service = UserService(db)
    updated_user = await user_service.update_user(current_user.id, payload)
    return updated_user


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a new profile avatar image."""
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise BadRequestException(detail="File uploaded must be an image.")

    # Validate file size (e.g. limit to 5MB)
    max_size = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise BadRequestException(detail="Image must be less than 5MB.")

    # Reset cursor after reading
    await file.seek(0)

    # Create storage folder if it doesn't exist
    os.makedirs(AVATAR_DIR, exist_ok=True)

    # Generate a unique file name
    file_ext = os.path.splitext(file.filename)[1]
    # Default to .png if no extension found
    if not file_ext:
        file_ext = ".png"

    filename = f"{current_user.id}_{uuid.uuid4().hex}{file_ext}"
    filepath = os.path.join(AVATAR_DIR, filename)

    # Save file content
    with open(filepath, "wb") as f:
        f.write(content)

    # Construct the url
    avatar_url = f"/static/avatars/{filename}"

    # Save to user model
    user_service = UserService(db)
    user_update = UserUpdate(avatar_url=avatar_url)
    updated_user = await user_service.update_user(current_user.id, user_update)
    return updated_user


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the current user's account."""
    user_service = UserService(db)
    await user_service.delete_user(current_user.id)
    return {"message": "Account deleted successfully."}
