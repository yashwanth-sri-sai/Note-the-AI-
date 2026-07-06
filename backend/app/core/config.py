import json
from typing import Any, List, Union
from pydantic import AnyHttpUrl, BeforeValidator, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


def parse_cors_origins(v: Any) -> List[str]:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, (list, str)):
        try:
            if isinstance(v, str):
                return json.loads(v)
            return v
        except Exception:
            raise ValueError(f"Invalid CORS origins format: {v}")
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    PROJECT_NAME: str = "NoteAI"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    POSTGRES_SERVER: Union[str, None] = None
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: Union[str, None] = None
    POSTGRES_PASSWORD: Union[str, None] = None
    POSTGRES_DB: Union[str, None] = None
    DATABASE_URL: Union[str, None] = None

    @property
    def ASYNC_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def SYNC_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
            return url
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # CORS
    ALLOWED_ORIGINS: Annotated[
        List[str], BeforeValidator(parse_cors_origins)
    ] = []

    # Configurable Rate Limits
    RATE_LIMIT_UPLOAD: int = 5
    RATE_LIMIT_CHAT: int = 20
    RATE_LIMIT_SEARCH: int = 60

    # Sentry DSN
    SENTRY_DSN: str = ""

    # Gemini Configurations
    GEMINI_API_KEY: Union[str, None] = None
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"

    # RAG Settings
    DEFAULT_CONTEXT_TOKEN_LIMIT: int = 30000
    DEBUG_RAG: bool = False

    # AI Service Timeouts
    AI_EMBEDDING_TIMEOUT: float = 30.0
    AI_GENERATION_TIMEOUT: float = 60.0
    AI_RERANK_TIMEOUT: float = 15.0

    # Evaluation & Regression Thresholds
    EVAL_RECALL_DROP_THRESHOLD: float = 0.05
    EVAL_GROUNDEDNESS_DROP_THRESHOLD: float = 0.05
    EVAL_HALLUCINATION_INC_THRESHOLD: float = 0.05
    EVAL_LATENCY_INC_THRESHOLD: float = 0.30

settings = Settings()
