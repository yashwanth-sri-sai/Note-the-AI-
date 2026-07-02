import os
import sys
import json
import uuid
import asyncio
import glob
import argparse
from datetime import datetime
from pathlib import Path
from app.evaluation.evaluation_runner import run_evaluation_for_case

RESULTS_DIR = Path(__file__).parent / "results"

def load_test_cases(filepath: str) -> list:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def load_latest_previous_run() -> dict:
    if not RESULTS_DIR.exists():
        return {}
    files = glob.glob(str(RESULTS_DIR / "run_*.json"))
    if not files:
        return {}
    latest_file = max(files, key=os.path.getctime)
    with open(latest_file, "r", encoding="utf-8") as f:
        return json.load(f)

def print_dashboard(results: list, previous_summary: dict, mode: str):
    print("\n" + "="*60)
    print(f" " * 15 + f"RAG EVALUATION DASHBOARD [{mode.upper()} MODE]")
    print("="*60)
    
    avg_precision = sum(r["metrics"]["precision_at_k"] for r in results) / len(results)
    avg_recall = sum(r["metrics"]["recall_at_k"] for r in results) / len(results)
    avg_chunk_precision = sum(r["metrics"]["chunk_precision_at_k"] for r in results) / len(results)
    avg_chunk_recall = sum(r["metrics"]["chunk_recall_at_k"] for r in results) / len(results)
    
    avg_latency = sum(r["latency"] for r in results) / len(results)
    
    if mode != "fast":
        avg_faithfulness = sum(r["metrics"]["faithfulness"] for r in results) / len(results)
        avg_relevancy = sum(r["metrics"]["answer_relevancy"] for r in results) / len(results)
        avg_groundedness = sum(r["metrics"]["groundedness"] for r in results) / len(results)
        avg_hallucination = sum(r["metrics"]["hallucination_rate"] for r in results) / len(results)
        avg_citation_acc = sum(r["metrics"]["citation_accuracy"] for r in results) / len(results)
        high_conf = sum(1 for r in results if r["confidence"] == "HIGH")
    
    print(f"Total Cases Run: {len(results)}")
    
    def format_diff(curr, prev, is_lower_better=False):
        if prev is None:
            return ""
        diff = curr - prev
        if abs(diff) < 0.01:
            return "(No change)"
        good = (diff < 0) if is_lower_better else (diff > 0)
        sign = "+" if diff > 0 else ""
        color = "\033[92m" if good else "\033[91m"
        reset = "\033[0m"
        return f"{color}({sign}{diff:.2f}){reset}"

    prev_p = previous_summary.get("avg_precision")
    prev_r = previous_summary.get("avg_recall")
    prev_cp = previous_summary.get("avg_chunk_precision")
    prev_cr = previous_summary.get("avg_chunk_recall")
    prev_lat = previous_summary.get("avg_latency")

    print(f"Doc Precision@10:        {avg_precision:.2f} {format_diff(avg_precision, prev_p)}")
    print(f"Doc Recall@10:           {avg_recall:.2f} {format_diff(avg_recall, prev_r)}")
    print(f"Chunk Precision@10:      {avg_chunk_precision:.2f} {format_diff(avg_chunk_precision, prev_cp)}")
    print(f"Chunk Recall@10:         {avg_chunk_recall:.2f} {format_diff(avg_chunk_recall, prev_cr)}")
    print(f"Average Latency (s):     {avg_latency:.2f} {format_diff(avg_latency, prev_lat, True)}")
    
    summary = {
        "avg_precision": avg_precision,
        "avg_recall": avg_recall,
        "avg_chunk_precision": avg_chunk_precision,
        "avg_chunk_recall": avg_chunk_recall,
        "avg_latency": avg_latency
    }

    if mode != "fast":
        prev_f = previous_summary.get("avg_faithfulness")
        prev_rel = previous_summary.get("avg_relevancy")
        prev_g = previous_summary.get("avg_groundedness")
        prev_h = previous_summary.get("avg_hallucination")
        prev_cit = previous_summary.get("avg_citation_accuracy")
        
        print(f"Average Faithfulness:    {avg_faithfulness:.2f} {format_diff(avg_faithfulness, prev_f)}")
        print(f"Average Answer Relevancy:{avg_relevancy:.2f} {format_diff(avg_relevancy, prev_rel)}")
        print(f"Average Groundedness:    {avg_groundedness:.2f} {format_diff(avg_groundedness, prev_g)}")
        print(f"Hallucination Rate:      {avg_hallucination:.2f} {format_diff(avg_hallucination, prev_h, True)}")
        print(f"Average Citation Acc:    {avg_citation_acc:.2f} {format_diff(avg_citation_acc, prev_cit)}")
        print(f"HIGH Confidence Rate:    {(high_conf/len(results))*100:.0f}%")
        
        summary.update({
            "avg_faithfulness": avg_faithfulness,
            "avg_relevancy": avg_relevancy,
            "avg_groundedness": avg_groundedness,
            "avg_hallucination": avg_hallucination,
            "avg_citation_accuracy": avg_citation_acc
        })
        
        best = max(results, key=lambda x: x["metrics"]["answer_relevancy"])
        worst = min(results, key=lambda x: x["metrics"]["answer_relevancy"])
        
        print("\nBest Performing Question:")
        print(f"Q: {best['question']} (Relevancy: {best['metrics']['answer_relevancy']:.2f})")
        print("\nWorst Performing Question:")
        print(f"Q: {worst['question']} (Relevancy: {worst['metrics']['answer_relevancy']:.2f})")
    
    print("="*60 + "\n")
    
    # CI Mode Regression Check
    if mode == "ci":
        has_regression = False
        print("Running CI Regression Checks...")
        if prev_cr is not None and (prev_cr - avg_chunk_recall) > 0.05:
            print(f"\033[91mFAIL: Chunk Recall dropped significantly from {prev_cr:.2f} to {avg_chunk_recall:.2f}\033[0m")
            has_regression = True
        
        if prev_g is not None and (prev_g - avg_groundedness) > 0.05:
            print(f"\033[91mFAIL: Groundedness dropped significantly from {prev_g:.2f} to {avg_groundedness:.2f}\033[0m")
            has_regression = True
            
        if has_regression:
            print("\033[91mCI Pipeline failed due to evaluation metrics regression.\033[0m")
            sys.exit(1)
        else:
            print("\033[92mCI Pipeline passed. No major regressions detected.\033[0m")
    
    return summary

async def main():
    parser = argparse.ArgumentParser(description="RAG Evaluation Benchmark CLI")
    parser.add_argument("workspace_uuid", type=str, help="UUID of the workspace to evaluate against")
    parser.add_argument("--mode", type=str, choices=["fast", "full", "ci"], default="full", help="fast (retrieval-only, top 20), full (all cases + LLM), ci (fails on regression)")
    
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
    previous_summary = previous_run.get("summary", {})
    
    results = []
    for idx, tc in enumerate(test_cases):
        print(f"Running test {idx+1}/{len(test_cases)}: {tc['id']} ...", end="", flush=True)
        res = await run_evaluation_for_case(workspace_id, tc, mode=args.mode)
        results.append(res)
        print(" Done")
        
    summary = print_dashboard(results, previous_summary, args.mode)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file = RESULTS_DIR / f"run_{timestamp}_{args.mode}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": timestamp,
            "workspace_id": str(workspace_id),
            "mode": args.mode,
            "summary": summary,
            "results": results
        }, f, indent=2)
        
    print(f"Full results saved to {out_file}")

if __name__ == "__main__":
    asyncio.run(main())
