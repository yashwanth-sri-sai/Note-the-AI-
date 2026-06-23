import uuid
import logging
from typing import Optional
from datetime import datetime
from app.db.session import async_session_factory
from app.db.models.metrics import APIRequestLog

logger = logging.getLogger("app.services.metrics")


async def log_request_metrics_task(
    user_id: Optional[uuid.UUID],
    workspace_id: Optional[uuid.UUID],
    endpoint: str,
    method: str,
    status_code: int,
    client_ip: Optional[str],
    total_response_ms: float,
    retrieval_latency_ms: Optional[float] = None,
    llm_latency_ms: Optional[float] = None,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    error_message: Optional[str] = None
) -> None:
    """Asynchronous worker task to insert API telemetry request log records into the database."""
    async with async_session_factory() as db:
        try:
            log_record = APIRequestLog(
                user_id=user_id,
                workspace_id=workspace_id,
                endpoint=endpoint,
                method=method,
                status_code=status_code,
                client_ip=client_ip,
                retrieval_latency_ms=retrieval_latency_ms,
                llm_latency_ms=llm_latency_ms,
                total_response_ms=total_response_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                provider=provider,
                model_name=model_name,
                error_message=error_message,
                created_at=datetime.utcnow()
            )
            db.add(log_record)

            # Populate separate ai_requests and token_usage tables if applicable
            from app.db.models.extensions import AIRequest, TokenUsage
            if provider and provider != "None" and workspace_id:
                request_type = "chat"
                if "search" in endpoint:
                    request_type = "search"
                elif "retrieve" in endpoint:
                    request_type = "retrieval"
                
                ai_req = AIRequest(
                    workspace_id=workspace_id,
                    provider=provider,
                    model=model_name or "unknown",
                    request_type=request_type,
                    created_at=datetime.utcnow()
                )
                db.add(ai_req)
                
                if total_tokens and total_tokens > 0:
                    tok_usage = TokenUsage(
                        workspace_id=workspace_id,
                        prompt_tokens=prompt_tokens or 0,
                        completion_tokens=completion_tokens or 0,
                        total_tokens=total_tokens or 0,
                        created_at=datetime.utcnow()
                    )
                    db.add(tok_usage)

            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to save request telemetry metrics to database: {e}")
