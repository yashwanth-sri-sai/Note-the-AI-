from typing import Any, Dict, List
from fastapi import status
from fastapi.exceptions import RequestValidationError


class AppException(Exception):
    """Base application exception.

    Translated into an HTTP response using global FastAPI exception handlers.
    """

    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str = "ERROR",
    ):
        self.status_code = status_code
        self.detail = detail
        self.code = code


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND, detail=detail, code=code
        )


class UnauthorizedException(AppException):
    def __init__(
        self, detail: str = "Could not validate credentials", code: str = "UNAUTHORIZED"
    ):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, code=code
        )


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Permission denied", code: str = "FORBIDDEN"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN, detail=detail, code=code
        )


class BadRequestException(AppException):
    def __init__(self, detail: str = "Bad request", code: str = "BAD_REQUEST"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, detail=detail, code=code
        )


class ConflictException(AppException):
    def __init__(self, detail: str = "Resource conflict", code: str = "CONFLICT"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT, detail=detail, code=code
        )


def format_validation_error(exc: RequestValidationError) -> Dict[str, Any]:
    """Helper to convert Pydantic validation errors into a clean JSON error response structure."""
    errors_list: List[Dict[str, Any]] = []
    for error in exc.errors():
        errors_list.append(
            {
                "location": error.get("loc", []),
                "message": error.get("msg", ""),
                "type": error.get("type", ""),
            }
        )

    return {
        "detail": "Request validation failed.",
        "code": "VALIDATION_ERROR",
        "errors": errors_list,
    }


class LLMProviderNotConfiguredException(Exception):
    """Custom exception raised when no LLM API keys are configured."""
    pass

