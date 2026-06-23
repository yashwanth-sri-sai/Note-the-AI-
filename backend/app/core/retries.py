import asyncio
import logging
from datetime import datetime
from typing import Any, Callable, Dict, Optional
from tenacity import (
    AsyncRetrying,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

logger = logging.getLogger("app.core.retries")


async def retry_with_backoff(
    coro_func: Callable[..., Any],
    *args: Any,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    retry_tracker: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Any:
    """Execute an asynchronous coroutine function using tenacity with exponential backoff and track retry states."""
    retry_count = 0
    failure_reason = None
    last_attempt_at = None

    def before_sleep_hook(retry_state):
        nonlocal retry_count, failure_reason, last_attempt_at
        retry_count = retry_state.attempt_number
        last_attempt_at = datetime.utcnow()
        if retry_state.outcome and retry_state.outcome.failed:

            failure_reason = str(retry_state.outcome.exception())
            
        if retry_tracker is not None:
            retry_tracker["retry_count"] = retry_count
            retry_tracker["failure_reason"] = failure_reason
            retry_tracker["last_attempt_at"] = last_attempt_at
            
        logger.warning(
            f"Attempt {retry_count} failed: {failure_reason}. Retrying in {retry_state.next_action.sleep:.1f}s..."
        )

    try:
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(max_retries),
            wait=wait_exponential(multiplier=initial_delay, exp_base=backoff_factor, max=30.0),
            before_sleep=before_sleep_hook,
            reraise=True
        ):
            with attempt:
                res = await coro_func(*args, **kwargs)
                if retry_tracker is not None:
                    retry_tracker["retry_count"] = retry_count
                    retry_tracker["failure_reason"] = None
                    retry_tracker["last_attempt_at"] = datetime.utcnow()
                return res
    except Exception as e:
        logger.error(f"Task execution failed after {max_retries} attempts: {e}")
        if retry_tracker is not None:
            retry_tracker["retry_count"] = max_retries
            retry_tracker["failure_reason"] = str(e)
            retry_tracker["last_attempt_at"] = datetime.utcnow()
        raise e
