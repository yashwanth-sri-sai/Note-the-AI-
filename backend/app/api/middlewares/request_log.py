import time
import uuid
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from app.core.logging_conf import correlation_id_ctx

logger = logging.getLogger("app.api.middleware")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Middleware that assigns a unique Correlation ID to every incoming request.

    If the client sends 'X-Correlation-ID', it is preserved, otherwise a new UUID is generated.
    The ID is stored in a context variable for logger retrieval and added to the response headers.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Retrieve or generate Correlation ID
        corr_id = request.headers.get("X-Correlation-ID")
        if not corr_id:
            corr_id = str(uuid.uuid4())

        # Set the correlation ID in contextvars
        token = correlation_id_ctx.set(corr_id)

        try:
            response = await call_next(request)
            # Add correlation ID to the response header
            response.headers["X-Correlation-ID"] = corr_id
            return response
        finally:
            # Clean up context variables after request completes
            correlation_id_ctx.reset(token)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs the details of every HTTP request, including method, path, client IP,

    HTTP status, and processing time.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start_time = time.perf_counter()
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # Log request receipt
        logger.debug(
            f"Incoming request: {method} {path} from {client_ip}"
        )

        try:
            response = await call_next(request)
            process_time = (time.perf_counter() - start_time) * 1000  # ms
            status_code = response.status_code

            # Categorize log level based on response code
            if status_code >= 500:
                logger.error(
                    f"Request failed: {method} {path} - Status: {status_code} - Duration: {process_time:.2f}ms"
                )
            elif status_code >= 400:
                logger.warning(
                    f"Client error: {method} {path} - Status: {status_code} - Duration: {process_time:.2f}ms"
                )
            else:
                logger.info(
                    f"Request success: {method} {path} - Status: {status_code} - Duration: {process_time:.2f}ms"
                )

            return response

        except Exception as e:
            # Log any unhandled exceptions before they propagate to the global handler
            process_time = (time.perf_counter() - start_time) * 1000
            logger.exception(
                f"Unhandled exception on {method} {path} - Duration: {process_time:.2f}ms - Error: {str(e)}"
            )
            raise e
