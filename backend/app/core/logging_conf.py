import contextvars
import json
import logging
import logging.config
import sys
from typing import Any, Dict

# Context variable to hold the request-scoped correlation ID
correlation_id_ctx = contextvars.ContextVar("correlation_id", default="-")


class CorrelationIdFilter(logging.Filter):
    """Logging filter that injects the current request correlation ID into the log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_ctx.get()
        return True


import re

SENSITIVE_KEY_RE = re.compile(
    r'(?i)\b(authorization|bearer|token|secret|key|password|email|credentials|pwd)\b[\s:="\'\[{]*(?:[^\s,"\'\}]{8,})',
    re.IGNORECASE
)

def sanitize_message(msg: str) -> str:
    """Mask sensitive keys, tokens, and credentials in log messages."""
    if not isinstance(msg, str):
        return msg
    return SENSITIVE_KEY_RE.sub(r'\1: [REDACTED]', msg)


class JSONFormatter(logging.Formatter):
    """Custom formatter that serializes log records into JSON format for production telemetry."""

    def format(self, record: logging.LogRecord) -> str:
        raw_message = record.getMessage()
        sanitized_message = sanitize_message(raw_message)
        
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": sanitized_message,
            "logger": record.name,
            "file": f"{record.filename}:{record.lineno}",
            "correlation_id": getattr(record, "correlation_id", "-"),
        }

        # Include exception stack traces if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def configure_logging(environment: str = "development") -> None:
    """Configures system-wide logging.

    Uses structured JSON logs in production, and clean, highlighted console
    outputs in development.
    """
    log_formatter = "json" if environment == "production" else "console"

    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "correlation_id_filter": {
                "()": CorrelationIdFilter,
            }
        },
        "formatters": {
            "console": {
                "format": "[%(asctime)s] [%(levelname)s] [%(correlation_id)s] [%(name)s:%(lineno)d] - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "json": {
                "()": JSONFormatter,
                "datefmt": "%Y-%m-%dT%H:%M:%S%z",
            },
        },
        "handlers": {
            "stdout": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": log_formatter,
                "filters": ["correlation_id_filter"],
            }
        },
        "root": {
            "level": "INFO" if environment == "production" else "DEBUG",
            "handlers": ["stdout"],
        },
        # Override third-party log noise levels
        "loggers": {
            "uvicorn": {"level": "INFO", "handlers": ["stdout"], "propagate": False},
            "uvicorn.access": {"level": "WARNING", "handlers": ["stdout"], "propagate": False},
            "sqlalchemy.engine": {"level": "WARNING", "handlers": ["stdout"], "propagate": False},
            "alembic": {"level": "INFO", "handlers": ["stdout"], "propagate": False},
        },
    }

    logging.config.dictConfig(logging_config)
