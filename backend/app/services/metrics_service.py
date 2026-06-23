import uuid
import logging
from datetime import datetime
from typing import Optional
from app.db.session import async_session_factory
from app.db.models.extensions import AIRequest, TokenUsage
from app.db.models.metrics import LatencyMetric

logger = logging.getLogger("app.services.metrics_service")


def calculate_token_cost(provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate the estimated USD cost of an LLM or embedding API request based on current token rates."""
    p = provider.lower() if provider else ""
    m = model.lower() if model else ""
    
    # 1. Embeddings cost estimation
    if "embedding" in m or "embedding" in p:
        if "openai" in p or "text-embedding-3" in m:
            # $0.02 per 1M tokens
            return (prompt_tokens + completion_tokens) * 0.00000002
        if "gemini" in p or "google" in p or "text-embedding-004" in m:
            # $0.025 per 1M tokens
            return (prompt_tokens + completion_tokens) * 0.000000025
        # Fallback local trigram/mock is free
        return 0.0
            
    # 2. Chat LLMs cost estimation
    if "gpt-4o-mini" in m:
        # Input: $0.150 / 1M tokens, Output: $0.600 / 1M tokens
        return (prompt_tokens * 0.00000015) + (completion_tokens * 0.00000060)
    elif "gpt-4o" in m:
        # Input: $5.00 / 1M tokens, Output: $15.00 / 1M tokens
        return (prompt_tokens * 0.000005) + (completion_tokens * 0.000015)
    elif "gemini-1.5-flash" in m or "flash" in m:
        # Input: $0.075 / 1M tokens, Output: $0.300 / 1M tokens
        return (prompt_tokens * 0.000000075) + (completion_tokens * 0.00000030)
    elif "gemini-1.5-pro" in m or "pro" in m:
        # Input: $1.25 / 1M tokens, Output: $5.00 / 1M tokens
        return (prompt_tokens * 0.00000125) + (completion_tokens * 0.000005)
        
    return 0.0


async def log_ai_request_and_tokens(
    workspace_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    provider: str,
    model: str,
    request_type: str,
    prompt_tokens: int,
    completion_tokens: int,
    created_at: Optional[datetime] = None
) -> None:
    """Asynchronously persist AI request log metadata and associated token usage details."""
    created_at = created_at or datetime.utcnow()
    total_tokens = prompt_tokens + completion_tokens
    cost = calculate_token_cost(provider, model, prompt_tokens, completion_tokens)

    async with async_session_factory() as db:
        try:
            # 1. Create AIRequest log record
            ai_req = AIRequest(
                workspace_id=workspace_id,
                user_id=user_id,
                provider=provider,
                model=model,
                request_type=request_type,
                created_at=created_at
            )
            db.add(ai_req)
            await db.flush()  # Obtain ai_req.id
            
            # 2. Create TokenUsage log record
            tok_usage = TokenUsage(
                workspace_id=workspace_id,
                user_id=user_id,
                provider=provider,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                estimated_cost=cost,
                created_at=created_at
            )
            db.add(tok_usage)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to log AI request and tokens: {e}")


async def log_latency_metric(
    workspace_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    retrieval_latency_ms: Optional[float] = None,
    llm_latency_ms: Optional[float] = None,
    total_response_ms: Optional[float] = None,
    embedding_latency_ms: Optional[float] = None,
    document_processing_ms: Optional[float] = None,
    created_at: Optional[datetime] = None
) -> None:
    """Asynchronously persist detailed multi-point latency telemetry log metrics."""
    created_at = created_at or datetime.utcnow()
    async with async_session_factory() as db:
        try:
            latency_rec = LatencyMetric(
                workspace_id=workspace_id,
                user_id=user_id,
                retrieval_latency_ms=retrieval_latency_ms,
                llm_latency_ms=llm_latency_ms,
                total_response_ms=total_response_ms,
                embedding_latency_ms=embedding_latency_ms,
                document_processing_ms=document_processing_ms,
                created_at=created_at
            )
            db.add(latency_rec)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to log latency metrics: {e}")
