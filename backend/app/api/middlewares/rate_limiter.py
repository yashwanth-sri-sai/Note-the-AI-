import time
from typing import Optional
from collections import defaultdict
import threading
from fastapi import Request, HTTPException, status, Depends
from app.api.deps import get_current_user
from app.db.models.user import User
from app.core.config import settings


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
        self.lock = threading.Lock()

    def is_allowed(self, key: str, endpoint: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        
        with self.lock:
            # Clean up old request records
            self.requests[(key, endpoint)] = [t for t in self.requests[(key, endpoint)] if t > cutoff]
            
            # Check limit
            if len(self.requests[(key, endpoint)]) >= self.limit:
                return False
                
            # Log current request
            self.requests[(key, endpoint)].append(now)
            return True


# Global instances for each rate-limiting bucket
upload_limiter = SlidingWindowRateLimiter(limit=settings.RATE_LIMIT_UPLOAD, window_seconds=60)
chat_limiter = SlidingWindowRateLimiter(limit=settings.RATE_LIMIT_CHAT, window_seconds=60)
search_limiter = SlidingWindowRateLimiter(limit=settings.RATE_LIMIT_SEARCH, window_seconds=60)



async def rate_limit_upload(request: Request, current_user: User = Depends(get_current_user)):
    """Rate limit uploads: max 5 requests per minute per authenticated user/IP."""
    key = str(current_user.id) if current_user else (request.client.host if request.client else "unknown")
    if not upload_limiter.is_allowed(key, "/upload"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Upload rate limit exceeded. You are allowed 5 uploads per minute maximum."
        )


async def rate_limit_chat(request: Request, current_user: User = Depends(get_current_user)):
    """Rate limit chats: max 20 requests per minute per authenticated user/IP."""
    key = str(current_user.id) if current_user else (request.client.host if request.client else "unknown")
    if not chat_limiter.is_allowed(key, "/chat"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Chat rate limit exceeded. You are allowed 20 messages per minute maximum."
        )


async def rate_limit_search(request: Request, current_user: User = Depends(get_current_user)):
    """Rate limit searches: max 60 requests per minute per authenticated user/IP."""
    key = str(current_user.id) if current_user else (request.client.host if request.client else "unknown")
    if not search_limiter.is_allowed(key, "/search"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Search rate limit exceeded. You are allowed 60 search queries per minute maximum."
        )
