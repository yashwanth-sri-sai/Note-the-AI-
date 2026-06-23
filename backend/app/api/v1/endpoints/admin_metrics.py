import math
from datetime import datetime, timedelta
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models.user import User
from app.db.models.metrics import APIRequestLog, LatencyMetric
from app.db.models.extensions import AIRequest, TokenUsage

router = APIRouter()


def _calculate_percentile(values: List[float], p: float) -> float:
    """Calculate percentile via linear interpolation."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    index = (n - 1) * p
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return sorted_vals[lower]
    return sorted_vals[lower] * (upper - index) + sorted_vals[upper] * (index - lower)


def _period_start(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "daily":
        return now - timedelta(days=1)
    elif period == "weekly":
        return now - timedelta(weeks=1)
    elif period == "monthly":
        return now - timedelta(days=30)
    return now - timedelta(days=1)


def _aggregate_for_period(rows, period: str) -> Dict[str, Any]:
    start = _period_start(period)
    filtered = [r for r in rows if r.created_at.replace(tzinfo=None) >= start]
    return filtered


@router.get("/usage")
async def get_usage_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return Daily, Weekly, and Monthly request count and endpoint usage aggregates."""
    result = await db.execute(
        select(APIRequestLog).order_by(APIRequestLog.created_at.desc()).limit(10000)
    )
    logs = result.scalars().all()

    def summarize(subset):
        by_endpoint: Dict[str, int] = {}
        by_user: Dict[str, int] = {}
        for log in subset:
            ep = log.endpoint or "unknown"
            by_endpoint[ep] = by_endpoint.get(ep, 0) + 1
            uid = str(log.user_id) if log.user_id else "anonymous"
            by_user[uid] = by_user.get(uid, 0) + 1
        return {
            "total_requests": len(subset),
            "requests_by_endpoint": by_endpoint,
            "requests_by_user": by_user,
        }

    return {
        "daily": summarize(_aggregate_for_period(logs, "daily")),
        "weekly": summarize(_aggregate_for_period(logs, "weekly")),
        "monthly": summarize(_aggregate_for_period(logs, "monthly")),
    }


@router.get("/tokens")
async def get_token_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return Daily, Weekly, and Monthly token consumption and estimated cost aggregates."""
    result = await db.execute(
        select(TokenUsage).order_by(TokenUsage.created_at.desc()).limit(10000)
    )
    usages = result.scalars().all()

    def summarize(subset):
        total_prompt = sum(u.prompt_tokens for u in subset)
        total_completion = sum(u.completion_tokens for u in subset)
        total_tokens = sum(u.total_tokens for u in subset)
        total_cost = sum(u.estimated_cost or 0.0 for u in subset)
        by_model: Dict[str, int] = {}
        by_provider: Dict[str, int] = {}
        for u in subset:
            m = u.model or "unknown"
            by_model[m] = by_model.get(m, 0) + (u.total_tokens or 0)
            prov = u.provider or "unknown"
            by_provider[prov] = by_provider.get(prov, 0) + (u.total_tokens or 0)
        return {
            "total_prompt_tokens": total_prompt,
            "total_completion_tokens": total_completion,
            "total_tokens": total_tokens,
            "estimated_cost_usd": round(total_cost, 6),
            "tokens_by_model": by_model,
            "tokens_by_provider": by_provider,
            "request_count": len(subset),
        }

    return {
        "daily": summarize(_aggregate_for_period(usages, "daily")),
        "weekly": summarize(_aggregate_for_period(usages, "weekly")),
        "monthly": summarize(_aggregate_for_period(usages, "monthly")),
    }


@router.get("/latency")
async def get_latency_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return Daily, Weekly, and Monthly mean/p95/p99 latency percentiles for all tracked points."""
    result = await db.execute(
        select(LatencyMetric).order_by(LatencyMetric.created_at.desc()).limit(10000)
    )
    metrics = result.scalars().all()

    def latency_stats(values: List[float]) -> Dict[str, float]:
        if not values:
            return {"mean": 0.0, "p95": 0.0, "p99": 0.0, "count": 0}
        mean = sum(values) / len(values)
        return {
            "mean": round(mean, 2),
            "p95": round(_calculate_percentile(values, 0.95), 2),
            "p99": round(_calculate_percentile(values, 0.99), 2),
            "count": len(values),
        }

    def summarize(subset):
        retrieval = [m.retrieval_latency_ms for m in subset if m.retrieval_latency_ms is not None]
        llm = [m.llm_latency_ms for m in subset if m.llm_latency_ms is not None]
        total = [m.total_response_ms for m in subset if m.total_response_ms is not None]
        embedding = [m.embedding_latency_ms for m in subset if m.embedding_latency_ms is not None]
        doc_proc = [m.document_processing_ms for m in subset if m.document_processing_ms is not None]
        return {
            "retrieval_ms": latency_stats(retrieval),
            "llm_ms": latency_stats(llm),
            "total_response_ms": latency_stats(total),
            "embedding_ms": latency_stats(embedding),
            "document_processing_ms": latency_stats(doc_proc),
        }

    return {
        "daily": summarize(_aggregate_for_period(metrics, "daily")),
        "weekly": summarize(_aggregate_for_period(metrics, "weekly")),
        "monthly": summarize(_aggregate_for_period(metrics, "monthly")),
    }


@router.get("/failures")
async def get_failure_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return Daily, Weekly, and Monthly success/failure rates and top error messages."""
    result = await db.execute(
        select(APIRequestLog).order_by(APIRequestLog.created_at.desc()).limit(10000)
    )
    logs = result.scalars().all()

    def summarize(subset):
        total = len(subset)
        success_count = sum(1 for l in subset if l.status_code < 400)
        client_errors = sum(1 for l in subset if 400 <= l.status_code < 500)
        server_errors = sum(1 for l in subset if l.status_code >= 500)
        success_rate = round(success_count / total, 4) if total > 0 else 1.0
        errors = [
            {"endpoint": l.endpoint, "status_code": l.status_code, "error": l.error_message, "at": l.created_at.isoformat()}
            for l in subset if l.error_message and l.status_code >= 400
        ]
        # Return last 10 errors
        errors_sorted = sorted(errors, key=lambda x: x["at"], reverse=True)[:10]
        return {
            "total_requests": total,
            "success_count": success_count,
            "client_error_count": client_errors,
            "server_error_count": server_errors,
            "success_rate": success_rate,
            "last_errors": errors_sorted,
        }

    return {
        "daily": summarize(_aggregate_for_period(logs, "daily")),
        "weekly": summarize(_aggregate_for_period(logs, "weekly")),
        "monthly": summarize(_aggregate_for_period(logs, "monthly")),
    }
