import math
from typing import List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_workspace_id
from app.db.models.metrics import APIRequestLog

router = APIRouter()


def calculate_percentile(data: List[float], pct: float) -> float:
    """Calculate a percentile value from a list of numerical values using linear interpolation."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    idx = (n - 1) * pct
    low = math.floor(idx)
    high = math.ceil(idx)
    if low == high:
        return float(sorted_data[int(idx)])
    return float(sorted_data[low] * (high - idx) + sorted_data[high] * (idx - low))


@router.get("/dashboard")
async def get_metrics_dashboard(
    workspace_id: UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve operational telemetric analytics (usage, latencies, error logs) for the active workspace."""
    stmt = select(APIRequestLog).where(APIRequestLog.workspace_id == workspace_id)
    result = await db.execute(stmt)
    logs = list(result.scalars().all())

    # Usage Metrics
    requests_by_endpoint = {}
    requests_by_user = {}
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0

    # Failure Metrics
    total_requests = len(logs)
    success_count = 0
    client_error_count = 0
    server_error_count = 0
    last_errors = []

    # Latencies lists
    retrieval_latencies = []
    llm_latencies = []
    total_latencies = []

    for log in logs:
        # Group by endpoint
        requests_by_endpoint[log.endpoint] = requests_by_endpoint.get(log.endpoint, 0) + 1

        # Group by user
        u_id = str(log.user_id) if log.user_id else "anonymous"
        requests_by_user[u_id] = requests_by_user.get(u_id, 0) + 1

        # Token totals
        total_prompt_tokens += log.prompt_tokens or 0
        total_completion_tokens += log.completion_tokens or 0
        total_tokens += log.total_tokens or 0

        # Success/Failure classification
        if log.status_code < 400:
            success_count += 1
        elif 400 <= log.status_code < 500:
            client_error_count += 1
        else:
            server_error_count += 1

        if log.status_code >= 400 or log.error_message:
            last_errors.append({
                "id": str(log.id),
                "timestamp": log.created_at.isoformat(),
                "endpoint": log.endpoint,
                "method": log.method,
                "status_code": log.status_code,
                "error_message": log.error_message or f"HTTP Error {log.status_code}"
            })

        # Latencies (skip None/zero)
        if log.retrieval_latency_ms is not None:
            retrieval_latencies.append(log.retrieval_latency_ms)
        if log.llm_latency_ms is not None:
            llm_latencies.append(log.llm_latency_ms)
        total_latencies.append(log.total_response_ms)

    # Sort last errors to get the 10 most recent
    last_errors.sort(key=lambda x: x["timestamp"], reverse=True)
    last_errors = last_errors[:10]

    # Calculate statistics
    def stats(data_list: List[float]) -> Dict[str, float]:
        if not data_list:
            return {"mean": 0.0, "p95": 0.0, "p99": 0.0}
        mean_val = sum(data_list) / len(data_list)
        p95_val = calculate_percentile(data_list, 0.95)
        p99_val = calculate_percentile(data_list, 0.99)
        return {
            "mean": round(mean_val, 2),
            "p95": round(p95_val, 2),
            "p99": round(p99_val, 2)
        }

    success_rate = (success_count / total_requests) if total_requests > 0 else 1.0

    return {
        "usage": {
            "requests_by_endpoint": requests_by_endpoint,
            "requests_by_user": requests_by_user,
            "total_prompt_tokens": total_prompt_tokens,
            "total_completion_tokens": total_completion_tokens,
            "total_tokens": total_tokens
        },
        "failures": {
            "total_requests": total_requests,
            "success_count": success_count,
            "client_error_count": client_error_count,
            "server_error_count": server_error_count,
            "success_rate": round(success_rate, 4),
            "last_errors": last_errors
        },
        "latency": {
            "retrieval": stats(retrieval_latencies),
            "llm": stats(llm_latencies),
            "total": stats(total_latencies)
        }
    }
