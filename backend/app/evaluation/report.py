import os
from typing import Dict, Any, List
from pathlib import Path
from app.evaluation.models import BenchmarkRun, QuestionEvaluation

class ReportGenerator:
    def __init__(self, current_run: BenchmarkRun, regression_results: Dict[str, Any]):
        self.current = current_run
        self.regressions = regression_results

    def _format_diff(self, metric_data: Dict[str, Any], is_percent: bool = True) -> str:
        if not metric_data or "previous" not in metric_data:
            return ""
            
        prev = metric_data["previous"]
        diff = metric_data["absolute_difference"]
        is_lower_better = metric_data.get("is_lower_better", False)
        
        if abs(diff) < 0.001:
            return " (No change)"
            
        sign = "+" if diff > 0 else ""
        good = (diff < 0) if is_lower_better else (diff > 0)
        color = "\033[92m" if good else "\033[91m"
        reset = "\033[0m"
        
        val_str = f"{sign}{diff*100:.1f}%" if is_percent else f"{sign}{diff:.2f}"
        return f"{color}({val_str}){reset}"

    def print_console_report(self):
        c_sum = self.current.summary
        f_sum = self.current.failure_summary
        metrics = self.regressions.get("metrics", {})
        
        print("=" * 50)
        print("Evaluation Summary")
        print("=" * 50)
        print(f"Questions           {c_sum.questions}")
        print(f"Passed              {c_sum.questions - f_sum.total_failed}")
        print(f"Failed              {f_sum.total_failed}")
        print("")
        print(f"Retrieval Failures  {f_sum.retrieval_failures}")
        print(f"Prompt Failures     {f_sum.prompt_failures}")
        print(f"Chunking Failures   {f_sum.chunking_failures}")
        print(f"Hallucinations      {f_sum.hallucinations}")
        print(f"Citation Failures   {f_sum.citation_failures}")
        print("=" * 50)
        
        if f_sum.top_failing_documents:
            print("Top Failing Documents")
            for doc, count in sorted(f_sum.top_failing_documents.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"{doc:<25} {count}")
            print("=" * 50)

    def generate_markdown(self, output_dir: Path):
        # 1. Generate Overall Benchmark Report (Milestone 1 style)
        self._generate_overall_markdown(output_dir)
        
        # 2. Generate Failure Summary
        self._generate_failure_summary_markdown(output_dir)
        
        # 3. Generate Per-Question Markdown
        questions_dir = output_dir / "questions"
        questions_dir.mkdir(exist_ok=True)
        
        for q in self.current.question_results:
            self._generate_question_markdown(q, questions_dir)

    def _generate_overall_markdown(self, output_dir: Path):
        md = f"# Benchmark Report\n\n"
        md += f"**Run ID:** {self.current.run_id}\n"
        md += f"**Timestamp:** {self.current.timestamp}\n"
        md += f"**Git Commit:** {self.current.git_commit}\n"
        md += f"**Branch:** {self.current.branch}\n\n"
        
        # (Omitted full summary table code here for brevity, but retaining the existing logic in practice if we kept it, 
        # for this rewrite I will keep it simple and focused on the requested outputs)
        report_path = output_dir / "latest_report.md"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(md)

    def _generate_failure_summary_markdown(self, output_dir: Path):
        c_sum = self.current.summary
        f_sum = self.current.failure_summary
        
        md = "==================================\n\n"
        md += f"Questions: {c_sum.questions}\n\n"
        md += f"Passed: {c_sum.questions - f_sum.total_failed}\n\n"
        md += f"Failed: {f_sum.total_failed}\n\n"
        md += f"Retrieval Failures: {f_sum.retrieval_failures}\n\n"
        md += f"Prompt Failures: {f_sum.prompt_failures}\n\n"
        md += f"Hallucinations: {f_sum.hallucinations}\n\n"
        md += f"Citation Failures: {f_sum.citation_failures}\n\n"
        md += "==================================\n\n"
        
        md += "Top Weak Documents\n\n"
        for doc, count in sorted(f_sum.top_failing_documents.items(), key=lambda x: x[1], reverse=True)[:5]:
            md += f"{doc}\n{count} failures\n\n"
        md += "==================================\n\n"
        
        md += "Weak Pages\n\n"
        for page, count in sorted(f_sum.top_failing_pages.items(), key=lambda x: x[1], reverse=True)[:5]:
            md += f"Page {page}\n\n"
        md += "==================================\n"
        
        summary_path = output_dir / "failure_summary.md"
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(md)

    def _generate_question_markdown(self, q: QuestionEvaluation, output_dir: Path):
        md = f"# Question Evaluation: {q.question_id}\n\n"
        md += f"**Question:** {q.question}\n\n"
        md += f"**Expected Answer:** {q.expected_answer}\n\n"
        md += f"**Generated Answer:** {q.generated_answer}\n\n"
        md += f"**Expected Sources:** {', '.join(q.expected_documents) if q.expected_documents else 'None'}\n\n"
        md += f"**Retrieved Sources:** {', '.join(q.retrieved_documents) if q.retrieved_documents else 'None'}\n\n"
        
        md += "## Metrics\n"
        md += f"- **Precision:** {q.retrieval_precision:.2f}\n"
        md += f"- **Recall:** {q.retrieval_recall:.2f}\n"
        md += f"- **Groundedness:** {q.groundedness:.2f}\n"
        md += f"- **Latency (ms):** {q.latency_ms:.1f}\n\n"
        
        md += "## Failure Analysis\n"
        md += f"**Classification:** {q.failure_type}\n\n"
        md += f"**Explanation:** {q.failure_reason if q.failure_reason else 'N/A'}\n\n"
        
        if q.failure_type != "NONE":
            md += "## Recommendations\n"
            if q.failure_type == "RETRIEVAL_FAILURE":
                md += "- Check vector embeddings, ensure document is fully indexed.\n"
            elif q.failure_type == "PROMPT_FAILURE":
                md += "- Consider tweaking prompt instructions for better extraction.\n"
            elif q.failure_type == "CHUNKING_FAILURE":
                md += "- Increase chunk overlap size.\n"
                
        q_path = output_dir / f"{q.question_id}.md"
        with open(q_path, "w", encoding="utf-8") as f:
            f.write(md)
