import logging
import asyncio
import sys
import os

# Phase 8: Run production startup checks before initializing the app router
from app.startup_health_check import run_startup_checks
try:
    asyncio.run(run_startup_checks())
except SystemExit as sys_exit:
    raise sys_exit
except Exception as e:
    print(f"CRITICAL: Application startup health check failed: {e}")
    sys.exit(1)

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.exceptions import AppException, format_validation_error, LLMProviderNotConfiguredException
from app.core.logging_conf import configure_logging
from app.api.middlewares.request_log import CorrelationIdMiddleware, RequestLoggingMiddleware
from app.api.v1.router import api_router

# Configure centralized logging setup
configure_logging(settings.ENVIRONMENT)
logger = logging.getLogger("app.main")

# Initialize Sentry SDK for error tracking (only if DSN is configured)
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,  # 20% of transactions sampled for performance
        profiles_sample_rate=0.1,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
        ],
        send_default_pii=False,  # Don't send personally identifiable information
    )
    logger.info(f"Sentry SDK initialized for environment: {settings.ENVIRONMENT}")

# Initialize FastAPI Application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for NoteAI - AI-Powered Knowledge Management SaaS",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# Custom Correlation ID and Request Logger Middlewares
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# Rate Limiter setup
from app.api.middlewares.rate_limiter import limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS Middleware Configurations
if settings.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Static Files Directory Mount (for user uploads like avatars)
os.makedirs("static/avatars", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    return response


# =========================================================================
# STARTUP EVENTS
# =========================================================================

@app.on_event("startup")
async def startup_event():
    """Run on application startup to perform initialization tasks."""
    logger.info("NoteAI backend starting up...")
    # Run stuck job recovery to clean up any jobs interrupted by a prior crash
    try:
        from app.services.recovery_service import stuck_job_recovery_task
        asyncio.create_task(stuck_job_recovery_task())
    except Exception as e:
        logger.error(f"Startup recovery task failed: {e}")


# =========================================================================
# CENTRALIZED EXCEPTION HANDLERS
# =========================================================================

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handles domain-specific application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
    )


@app.exception_handler(LLMProviderNotConfiguredException)
async def llm_provider_not_configured_handler(
    request: Request, exc: LLMProviderNotConfiguredException
) -> JSONResponse:
    """Returns exact structured JSON error when LLM provider keys are missing."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "LLM_PROVIDER_NOT_CONFIGURED",
            "message": "Configure Gemini or OpenAI API key.",
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handles Pydantic request body validation failures, returning standard error fields."""
    error_payload = format_validation_error(exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_payload,
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback handler for unexpected backend Python runtime errors.

    Prevents internal code traceback leak to client interfaces.
    """
    logger.exception("An unhandled exception occurred in the application.")
    if settings.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_error",
            "message": "Service temporarily unavailable"
        },
    )


# Include API V1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "running",
        "service": settings.PROJECT_NAME
    }

from fastapi import Depends
from app.db.session import get_db, AsyncSession, safe_db_execute
from sqlalchemy import text
from app.core.circuit_breaker import llm_breaker, embedding_breaker, reranker_breaker

# Consolidated Health Check endpoint
@app.get("/health", tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = True
    try:
        res = await safe_db_execute(db, text("SELECT 1"))
        db_ok = (res.scalar() == 1) if res else False
    except Exception:
        db_ok = False
        
    llm_ok = llm_breaker.state != "OPEN" and (bool(os.getenv("OPENAI_API_KEY")) or bool(settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")))
    vector_ok = embedding_breaker.state != "OPEN" and reranker_breaker.state != "OPEN"
    
    overall = "healthy"
    if not db_ok:
        overall = "down"
    elif not llm_ok or not vector_ok:
        overall = "degraded"
        
    return {
        "status": overall,
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "details": {
            "database": "healthy" if db_ok else "down",
            "llm": "healthy" if llm_ok else ("degraded" if llm_breaker.state == "OPEN" else "down"),
            "vector": "healthy" if vector_ok else "degraded"
        }
    }

@app.get("/health/db", tags=["Health"])
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        result = await safe_db_execute(db, text("SELECT 1"))
        val = result.scalar() if result else None
        if val == 1:
            return {"status": "healthy"}
        return {"status": "degraded", "message": "Test query returned invalid output."}
    except Exception as e:
        logger.error(f"Health DB query failed: {e}")
        return {"status": "down", "message": str(e)}

@app.get("/health/llm", tags=["Health"])
async def health_llm():
    if llm_breaker.state == "OPEN":
        return {"status": "degraded", "message": "Circuit breaker is open due to recent failures."}
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not openai_key and not gemini_key:
        return {"status": "down", "message": "No active LLM provider keys configured."}
    return {"status": "healthy"}

@app.get("/health/vector", tags=["Health"])
async def health_vector():
    if embedding_breaker.state == "OPEN":
        return {"status": "degraded", "message": "Embedding circuit breaker is open."}
    if reranker_breaker.state == "OPEN":
        return {"status": "degraded", "message": "Reranker circuit breaker is open."}
    return {"status": "healthy"}
