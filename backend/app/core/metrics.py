import threading
from typing import Dict, Any

class MetricsTracker:
    def __init__(self):
        self._lock = threading.Lock()
        self._counters: Dict[str, int] = {}
        self._gauges: Dict[str, float] = {}

    def increment_counter(self, name: str, labels: Dict[str, str] = None, amount: int = 1):
        """Increment a Prometheus counter metric."""
        metric_str = self._format_metric_with_labels(name, labels)
        with self._lock:
            self._counters[metric_str] = self._counters.get(metric_str, 0) + amount

    def set_gauge(self, name: str, value: float, labels: Dict[str, str] = None):
        """Set a Prometheus gauge metric."""
        metric_str = self._format_metric_with_labels(name, labels)
        with self._lock:
            self._gauges[metric_str] = value

    def _format_metric_with_labels(self, name: str, labels: Dict[str, str] = None) -> str:
        if not labels:
            return name
        label_str = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    def export_metrics(self) -> str:
        """Export all metrics in standard Prometheus text format."""
        lines = []
        with self._lock:
            # 1. Output counters
            # Standardize HELP and TYPE descriptors
            lines.append("# HELP noteai_api_requests_total Total count of HTTP requests processed.")
            lines.append("# TYPE noteai_api_requests_total counter")
            for metric, value in self._counters.items():
                if metric.startswith("noteai_api_requests_total"):
                    lines.append(f"{metric} {value}")

            lines.append("# HELP noteai_ai_requests_total Total count of external AI requests.")
            lines.append("# TYPE noteai_ai_requests_total counter")
            for metric, value in self._counters.items():
                if metric.startswith("noteai_ai_requests_total"):
                    lines.append(f"{metric} {value}")

            lines.append("# HELP noteai_ai_request_retries_total Total count of AI API retry attempts.")
            lines.append("# TYPE noteai_ai_request_retries_total counter")
            for metric, value in self._counters.items():
                if metric.startswith("noteai_ai_request_retries_total"):
                    lines.append(f"{metric} {value}")

            lines.append("# HELP noteai_circuit_breaker_events_total Count of circuit breaker state transition events.")
            lines.append("# TYPE noteai_circuit_breaker_events_total counter")
            for metric, value in self._counters.items():
                if metric.startswith("noteai_circuit_breaker_events_total"):
                    lines.append(f"{metric} {value}")

            # General counters fallback
            for metric, value in self._counters.items():
                if not (metric.startswith("noteai_api_requests_total") or 
                        metric.startswith("noteai_ai_requests_total") or 
                        metric.startswith("noteai_ai_request_retries_total") or
                        metric.startswith("noteai_circuit_breaker_events_total")):
                    lines.append(f"{metric} {value}")

            # 2. Output gauges
            lines.append("# HELP noteai_api_request_duration_seconds Latency of HTTP requests in seconds.")
            lines.append("# TYPE noteai_api_request_duration_seconds gauge")
            for metric, value in self._gauges.items():
                if metric.startswith("noteai_api_request_duration_seconds"):
                    lines.append(f"{metric} {value:.4f}")

            lines.append("# HELP noteai_document_processing_status Current count of ingestion jobs by stage.")
            lines.append("# TYPE noteai_document_processing_status gauge")
            for metric, value in self._gauges.items():
                if metric.startswith("noteai_document_processing_status"):
                    lines.append(f"{metric} {value}")

            # General gauges fallback
            for metric, value in self._gauges.items():
                if not (metric.startswith("noteai_api_request_duration_seconds") or 
                        metric.startswith("noteai_document_processing_status")):
                    lines.append(f"{metric} {value:.4f}")

        return "\n".join(lines) + "\n"

# Global single-instance metrics store
metrics_store = MetricsTracker()
