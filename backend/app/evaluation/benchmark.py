import os
import sys
import json
import uuid
import asyncio
import glob
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

from app.evaluation.evaluation_runner import run_evaluation_for_case
from app.evaluation.models import (
    BenchmarkRun, BenchmarkSummary, QuestionEvaluation, FailureSummary,
    RetrievalMetrics, GenerationMetrics, PerformanceMetrics
)
from app.evaluation.regression import RegressionEngine
from app.evaluation.report import ReportGenerator
from app.evaluation.failure_classifier import FailureClassifier

RESULTS_DIR = Path(__file__).parent / "results"

def get_git_info() -> tuple[str, str]:
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"]).strip().decode("utf-8")
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"]).strip().decode("utf-8")
        return commit, branch
    except Exception:
        return "unknown", "unknown"

def load_test_cases(filepath: str) -> list:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def load_latest_previous_run() -> Optional[BenchmarkRun]:
    if not RESULTS_DIR.exists():
        return None
        
    files = glob.glob(str(RESULTS_DIR / "run_*.json"))
    if not files:
        return None
        
    runs = []
    for file in files:
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                runs.append(BenchmarkRun(**data))
        except Exception:
            continue
            
    if not runs:
        return None
        
    runs.sort(key=lambda r: r.timestamp, reverse=True)
    return runs[0]

def build_summary(results: List[QuestionEvaluation]) -> BenchmarkSummary:
    total = len(results)
    if total == 0:
        return BenchmarkSummary()
        
    retrieval = RetrievalMetrics(
        precision_at_5=sum(r.retrieval_precision for r in results) / total,
        recall_at_5=sum(r.retrieval_recall for r in results) / total,
        avg_similarity=0.0,
        avg_chunks=0.0,
        avg_tokens=0.0
    )
    
    generation = GenerationMetrics(
        faithfulness=sum(r.faithfulness for r in results) / total,
        groundedness=sum(r.groundedness for r in results) / total,
        hallucination_rate=sum(r.hallucination_score for r in results) / total
    )
    
    lats = [r.latency_ms for r in results]
    performance = PerformanceMetrics(
        avg_latency_ms=(sum(lats) / total) / 1000.0,
        min_latency_ms=min(lats) / 1000.0,
        max_latency_ms=max(lats) / 1000.0
    )
    
    return BenchmarkSummary(
        questions=total,
        retrieval=retrieval,
        generation=generation,
        performance=performance
    )

def build_failure_summary(results: List[QuestionEvaluation]) -> FailureSummary:
    f_sum = FailureSummary()
    
    for r in results:
        if r.failure_type != "NONE":
            f_sum.total_failed += 1
            
            if r.failure_type == "RETRIEVAL_FAILURE":
                f_sum.retrieval_failures += 1
            elif r.failure_type == "RERANK_FAILURE":
                f_sum.rerank_failures += 1
            elif r.failure_type == "CHUNKING_FAILURE":
                f_sum.chunking_failures += 1
            elif r.failure_type == "PROMPT_FAILURE":
                f_sum.prompt_failures += 1
            elif r.failure_type == "HALLUCINATION":
                f_sum.hallucinations += 1
            elif r.failure_type == "CITATION_FAILURE":
                f_sum.citation_failures += 1
            else:
                f_sum.unknown_failures += 1
                
            for doc in r.expected_documents:
                f_sum.top_failing_documents[doc] = f_sum.top_failing_documents.get(doc, 0) + 1
            for page in r.expected_pages:
                f_sum.top_failing_pages[str(page)] = f_sum.top_failing_pages.get(str(page), 0) + 1
                
    return f_sum

async def main():
    parser = argparse.ArgumentParser(description="Production RAG Evaluation Benchmark CLI")
    parser.add_argument("workspace_uuid", type=str, help="UUID of the workspace to evaluate against")
    parser.add_argument("--mode", type=str, choices=["fast", "full", "ci"], default="full")
    
    args = parser.parse_args()
    
    try:
        workspace_id = uuid.UUID(args.workspace_uuid)
    except ValueError:
        print("Invalid UUID format.")
        sys.exit(1)
        
    test_cases_path = Path(__file__).parent / "test_cases.json"
    if not test_cases_path.exists():
        print(f"Test cases file not found at {test_cases_path}")
        sys.exit(1)
        
    test_cases = load_test_cases(str(test_cases_path))
    
    if args.mode == "fast":
        test_cases = test_cases[:20]
        
    print(f"Loaded {len(test_cases)} test cases for mode {args.mode.upper()}.")
    
    RESULTS_DIR.mkdir(exist_ok=True)
    previous_run = load_latest_previous_run()
    
    classifier = FailureClassifier()
    q_results = []
    
    for idx, tc in enumerate(test_cases):
        print(f"Running test {idx+1}/{len(test_cases)}: {tc['id']} ...", end="", flush=True)
        res_dict = await run_evaluation_for_case(workspace_id, tc, mode=args.mode)
        q_eval = QuestionEvaluation(**res_dict)
        q_eval = classifier.classify(q_eval)
        q_results.append(q_eval)
        print(" Done")
        
    summary = build_summary(q_results)
    failure_summary = build_failure_summary(q_results)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    git_commit, git_branch = get_git_info()
    
    current_run = BenchmarkRun(
        run_id=str(uuid.uuid4()),
        timestamp=timestamp,
        git_commit=git_commit,
        branch=git_branch,
        workspace_id=str(workspace_id),
        mode=args.mode,
        summary=summary,
        failure_summary=failure_summary,
        question_results=q_results
    )
    
    engine = RegressionEngine()
    regression_results = engine.run(current_run, previous_run)
    
    reporter = ReportGenerator(current_run, regression_results)
    reporter.print_console_report()
    reporter.generate_markdown(RESULTS_DIR)
    
    out_file = RESULTS_DIR / f"run_{timestamp}_{args.mode}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(current_run.model_dump_json(indent=2))
        
    print(f"JSON results saved to {out_file}")
    
    if args.mode == "ci" and regression_results.get("overall") == "FAIL":
        print("\n\033[91mCI Pipeline failed due to evaluation metrics regression.\033[0m")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
