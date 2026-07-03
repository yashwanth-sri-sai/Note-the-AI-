import time
import logging
import asyncio
from typing import Callable, Any, Dict, Optional

logger = logging.getLogger("app.circuit_breaker")


class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 3, recovery_timeout: float = 60.0):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN
        self.last_state_change = time.time()

    def record_success(self):
        if self.state != "CLOSED":
            logger.info(f"Circuit Breaker [{self.name}] recovered and is now CLOSED.")
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failure_count += 1
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            self.last_state_change = time.time()
            logger.error(f"Circuit Breaker [{self.name}] opened! Threshold of {self.failure_threshold} failures reached. Disabling service for {self.recovery_timeout}s.")

    def can_execute(self) -> bool:
        if self.state == "OPEN":
            if time.time() - self.last_state_change > self.recovery_timeout:
                self.state = "HALF-OPEN"
                logger.info(f"Circuit Breaker [{self.name}] entered HALF-OPEN state. Testing connection on next call.")
                return True
            return False
        return True

    async def execute(self, func: Callable, fallback_func: Callable, *args, **kwargs) -> Any:
        if not self.can_execute():
            logger.warning(f"Circuit Breaker [{self.name}] is OPEN. Executing fallback.")
            if asyncio.iscoroutinefunction(fallback_func):
                return await fallback_func(*args, **kwargs)
            return fallback_func(*args, **kwargs)

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            logger.error(f"Circuit Breaker [{self.name}] caught failure: {e}")
            self.record_failure()
            if asyncio.iscoroutinefunction(fallback_func):
                return await fallback_func(*args, **kwargs)
            return fallback_func(*args, **kwargs)


# Global instances of circuit breakers for central monitoring
llm_breaker = CircuitBreaker("LLM_Generation")
embedding_breaker = CircuitBreaker("Embeddings_API")
reranker_breaker = CircuitBreaker("Cohere_Reranker")
