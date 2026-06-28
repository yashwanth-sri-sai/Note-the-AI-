import time
from typing import Optional
from collections import defaultdict
import threading
from fastapi import Request, HTTPException, status, Depends
from app.api.deps import get_current_user
from app.db.models.user import User
from app.core.config import settings


from slowapi import Limiter
from slowapi.util import get_remote_address

# Global instances for each rate-limiting bucket using slowapi
limiter = Limiter(key_func=get_remote_address)
