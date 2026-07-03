from typing import Dict, Any, Tuple
from app.evaluation.models import BenchmarkRun
from app.core.config import settings

class RegressionEngine:
    def __init__(self):
        self.recall_threshold = settings.EVAL_RECALL_DROP_THRESHOLD
        self.groundedness_threshold = settings.EVAL_GROUNDEDNESS_DROP_THRESHOLD
        self.hallucination_threshold = settings.EVAL_HALLUCINATION_INC_THRESHOLD
        self.latency_threshold = settings.EVAL_LATENCY_INC_THRESHOLD

    def _compute_diff(self, curr: float, prev: float, is_lower_better: bool = False) -> Dict[str, Any]:
        if prev == 0.0:
            percentage = 0.0
        else:
            percentage = ((curr - prev) / prev) * 100.0

        abs_diff = curr - prev
        
        if abs(abs_diff) < 0.001:
            direction = "no_change"
        else:
            direction = "increase" if curr > prev else "decrease"
            
        return {
            "current": curr,
            "previous": prev,
            "absolute_difference": abs_diff,
            "percentage": percentage,
            "direction": direction,
            "is_lower_better": is_lower_better
        }

    def run(self, current: BenchmarkRun, previous: BenchmarkRun) -> Dict[str, Any]:
        if not previous:
            return {"overall": "PASS", "metrics": {}}

        c_sum = current.summary
        p_sum = previous.summary

        metrics = {
            "recall": self._compute_diff(c_sum.retrieval.recall_at_5, p_sum.retrieval.recall_at_5, is_lower_better=False),
            "precision": self._compute_diff(c_sum.retrieval.precision_at_5, p_sum.retrieval.precision_at_5, is_lower_better=False),
            "groundedness": self._compute_diff(c_sum.generation.groundedness, p_sum.generation.groundedness, is_lower_better=False),
            "latency": self._compute_diff(c_sum.performance.avg_latency_ms, p_sum.performance.avg_latency_ms, is_lower_better=True),
            "hallucination": self._compute_diff(c_sum.generation.hallucination_rate, p_sum.generation.hallucination_rate, is_lower_better=True)
        }

        overall_status = "PASS"
        regressions = []

        # Recall Drop Check
        if metrics["recall"]["absolute_difference"] < -self.recall_threshold:
            regressions.append(f"Recall dropped by {-metrics['recall']['absolute_difference']:.2f} (Threshold: {self.recall_threshold})")
            overall_status = "FAIL"

        # Groundedness Drop Check
        if metrics["groundedness"]["absolute_difference"] < -self.groundedness_threshold:
            regressions.append(f"Groundedness dropped by {-metrics['groundedness']['absolute_difference']:.2f} (Threshold: {self.groundedness_threshold})")
            overall_status = "FAIL"

        # Hallucination Increase Check
        if metrics["hallucination"]["absolute_difference"] > self.hallucination_threshold:
            regressions.append(f"Hallucination increased by {metrics['hallucination']['absolute_difference']:.2f} (Threshold: {self.hallucination_threshold})")
            overall_status = "FAIL"

        # Latency Increase Check (percentage)
        # Latency threshold is a percentage (e.g. 0.30 = 30%)
        if metrics["latency"]["percentage"] > (self.latency_threshold * 100):
            regressions.append(f"Latency increased by {metrics['latency']['percentage']:.1f}% (Threshold: {self.latency_threshold * 100}%)")
            if overall_status == "PASS":
                overall_status = "WARN"

        return {
            "overall": overall_status,
            "metrics": metrics,
            "regressions": regressions
        }
