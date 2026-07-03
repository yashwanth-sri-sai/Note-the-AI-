import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.evaluation.models import BenchmarkRun, QuestionEvaluation

RESULTS_DIR = Path(__file__).parent / "results"

class DashboardService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DashboardService, cls).__new__(cls)
            cls._instance._cache = []
            cls._instance._last_checked_mtime = 0
            cls._instance._file_count = 0
        return cls._instance

    def _refresh_cache_if_needed(self):
        if not RESULTS_DIR.exists():
            return
            
        json_files = list(RESULTS_DIR.glob("run_*.json"))
        current_count = len(json_files)
        
        # Check latest modified time
        latest_mtime = max((f.stat().st_mtime for f in json_files), default=0)
        
        if current_count != self._file_count or latest_mtime > self._last_checked_mtime:
            # Refresh needed
            runs = []
            for file in json_files:
                try:
                    with open(file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        runs.append(BenchmarkRun(**data))
                except Exception as e:
                    print(f"Error loading {file}: {e}")
                    continue
                    
            # Sort chronological
            runs.sort(key=lambda r: r.timestamp)
            
            self._cache = runs
            self._file_count = current_count
            self._last_checked_mtime = latest_mtime

    def get_all_runs(self) -> List[BenchmarkRun]:
        self._refresh_cache_if_needed()
        return self._cache

    def get_latest_run(self) -> Optional[BenchmarkRun]:
        runs = self.get_all_runs()
        return runs[-1] if runs else None

    def calculate_quality_score(self, run: BenchmarkRun) -> float:
        """
        Quality Score Formula (0-100):
        Recall: 30%
        Groundedness: 30%
        Hallucination Penalty: 20%
        Latency: 20% (baseline: max(0, 20 - (Avg Latency * 4)))
        """
        c = run.summary
        recall_score = c.retrieval.recall_at_5 * 30.0
        groundedness_score = c.generation.groundedness * 30.0
        hallucination_score = (1.0 - c.generation.hallucination_rate) * 20.0
        
        latency_score = max(0.0, 20.0 - (c.performance.avg_latency_ms * 4.0))
        
        return round(recall_score + groundedness_score + hallucination_score + latency_score, 1)

    def get_quality_score_metadata(self) -> Dict[str, Any]:
        return {
            "weights": {
                "Recall": "30%",
                "Groundedness": "30%",
                "Hallucination Penalty": "20%",
                "Latency Score": "20%"
            }
        }

    def get_trends(self, mode: Optional[str] = None, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
        runs = self.get_all_runs()
        trends = []
        
        for run in runs:
            if mode and run.mode != mode:
                continue
            if workspace_id and run.workspace_id != workspace_id:
                continue
                
            ts = run.timestamp
            s = run.summary
            
            trends.append({"timestamp": ts, "metric": "recall", "value": s.retrieval.recall_at_5})
            trends.append({"timestamp": ts, "metric": "precision", "value": s.retrieval.precision_at_5})
            trends.append({"timestamp": ts, "metric": "latency", "value": s.performance.avg_latency_ms})
            trends.append({"timestamp": ts, "metric": "groundedness", "value": s.generation.groundedness})
            trends.append({"timestamp": ts, "metric": "hallucination", "value": s.generation.hallucination_rate})
            trends.append({"timestamp": ts, "metric": "quality_score", "value": self.calculate_quality_score(run)})
            
        return trends

    def get_failure_analytics(self, mode: Optional[str] = None, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        runs = self.get_all_runs()
        
        total_failures = 0
        distribution = {
            "RETRIEVAL_FAILURE": 0,
            "RERANK_FAILURE": 0,
            "CHUNKING_FAILURE": 0,
            "PROMPT_FAILURE": 0,
            "HALLUCINATION": 0,
            "CITATION_FAILURE": 0,
            "UNKNOWN": 0
        }
        doc_fails = {}
        page_fails = {}
        top_failing_questions_map = {}
        
        for run in runs:
            if mode and run.mode != mode: continue
            if workspace_id and run.workspace_id != workspace_id: continue
            
            f_sum = run.failure_summary
            total_failures += f_sum.total_failed
            distribution["RETRIEVAL_FAILURE"] += f_sum.retrieval_failures
            distribution["RERANK_FAILURE"] += f_sum.rerank_failures
            distribution["CHUNKING_FAILURE"] += f_sum.chunking_failures
            distribution["PROMPT_FAILURE"] += f_sum.prompt_failures
            distribution["HALLUCINATION"] += f_sum.hallucinations
            distribution["CITATION_FAILURE"] += f_sum.citation_failures
            distribution["UNKNOWN"] += f_sum.unknown_failures
            
            for doc, count in f_sum.top_failing_documents.items():
                doc_fails[doc] = doc_fails.get(doc, 0) + count
                
            for page, count in f_sum.top_failing_pages.items():
                page_fails[page] = page_fails.get(page, 0) + count
                
            for q in run.question_results:
                if q.failure_type != "NONE":
                    if q.question_id not in top_failing_questions_map:
                        top_failing_questions_map[q.question_id] = {
                            "question_id": q.question_id,
                            "question": q.question,
                            "failure_count": 0,
                            "last_failure_type": q.failure_type
                        }
                    top_failing_questions_map[q.question_id]["failure_count"] += 1

        top_docs = dict(sorted(doc_fails.items(), key=lambda x: x[1], reverse=True)[:10])
        top_pages = dict(sorted(page_fails.items(), key=lambda x: x[1], reverse=True)[:10])
        
        top_qs = sorted(top_failing_questions_map.values(), key=lambda x: x["failure_count"], reverse=True)[:10]

        return {
            "total_failures": total_failures,
            "failure_distribution": distribution,
            "top_failing_documents": top_docs,
            "top_failing_pages": top_pages,
            "top_failing_questions": top_qs
        }

    def get_paginated_questions(
        self, 
        page: int = 1, 
        size: int = 20, 
        mode: Optional[str] = None, 
        workspace_id: Optional[str] = None,
        failure_type: Optional[str] = None,
        date_prefix: Optional[str] = None
    ) -> Dict[str, Any]:
        runs = self.get_all_runs()
        
        # We need to flatten and filter the questions
        all_qs = []
        for run in runs:
            if mode and run.mode != mode: continue
            if workspace_id and run.workspace_id != workspace_id: continue
            if date_prefix and not run.timestamp.startswith(date_prefix): continue
            
            for q in run.question_results:
                if failure_type and q.failure_type != failure_type: continue
                all_qs.append(q)
                
        # Sort chronologically by the run they belonged to (already sorted by run)
        # But we want latest first typically for questions, let's just reverse the runs initially
        all_qs.reverse()
        
        total = len(all_qs)
        start = (page - 1) * size
        end = start + size
        paginated = all_qs[start:end]
        
        return {
            "total": total,
            "page": page,
            "size": size,
            "data": paginated
        }
