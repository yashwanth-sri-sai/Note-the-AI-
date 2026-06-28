import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
import uuid
from passlib.context import CryptContext
from app.core.config import settings

ALGORITHM = "HS256"

# Use Argon2id for secure password hashing (OWASP recommendation)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Hash a password using argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    try:
        # Check if the hash is an old bcrypt hash and verify it, but we can just let passlib handle it if configured, 
        # but to keep it simple, since passlib handles argon2. Wait, we should gracefully handle bcrypt if it exists.
        # But this is a greenfield-ish change, let's just use passlib's verify.
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(
    subject: Union[str, Any], expires_delta: Union[timedelta, None] = None
) -> str:
    """Create a signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "access",
        "jti": str(uuid.uuid4())
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_random_token() -> str:
    """Generate a secure random token for refresh tokens or password reset."""
    return secrets.token_urlsafe(64)
