import asyncio
from pathlib import Path
from app.evaluation.models import BenchmarkRun, BenchmarkSummary, RetrievalMetrics, GenerationMetrics, PerformanceMetrics, QuestionEvaluation, FailureSummary
from app.evaluation.regression import RegressionEngine
from app.evaluation.report import ReportGenerator
from app.evaluation.failure_classifier import FailureClassifier

def test():
    q1 = QuestionEvaluation(
        question_id="tc-001",
        question="What is X?",
        expected_answer="X is 1",
        generated_answer="X is 2",
        expected_documents=["doc1.pdf"],
        retrieved_documents=["doc2.pdf"],
        expected_chunk_ids=["chunk1"],
        retrieved_chunk_ids=["chunk2"],
        expected_pages=[1],
        retrieved_pages=[2],
        latency_ms=1500.0,
        retrieval_recall=0.0,
        retrieval_precision=0.0,
        groundedness=0.0,
        faithfulness=0.0,
        hallucination_score=0.5,
        citation_accuracy=0.0,
        pre_rerank_chunk_ids=[]
    )
    
    q2 = QuestionEvaluation(
        question_id="tc-002",
        question="What is Y?",
        expected_answer="Y is 1",
        generated_answer="Y is 1",
        expected_documents=["doc2.pdf"],
        retrieved_documents=["doc2.pdf"],
        expected_chunk_ids=["chunk3"],
        retrieved_chunk_ids=["chunk4"],
        expected_pages=[3],
        retrieved_pages=[3],
        latency_ms=1000.0,
        retrieval_recall=0.0,
        retrieval_precision=0.5,
        groundedness=0.9,
        faithfulness=0.9,
        hallucination_score=0.0,
        citation_accuracy=1.0,
        pre_rerank_chunk_ids=["chunk3"]
    )
    
    classifier = FailureClassifier()
    q1 = classifier.classify(q1)
    q2 = classifier.classify(q2)
    
    curr_summary = BenchmarkSummary(
        questions=2,
        retrieval=RetrievalMetrics(precision_at_5=0.25, recall_at_5=0.0),
        generation=GenerationMetrics(groundedness=0.45, hallucination_rate=0.25),
        performance=PerformanceMetrics(avg_latency_ms=1.25)
    )
    
    # Simple manual fail count
    f_sum = FailureSummary(
        total_failed=2,
        retrieval_failures=1, # q1
        rerank_failures=1, # q2
        top_failing_documents={"doc1.pdf": 1, "doc2.pdf": 1},
        top_failing_pages={"1": 1, "3": 1}
    )
    
    curr_run = BenchmarkRun(
        run_id="curr_id", timestamp="20260703_103020", git_commit="def", branch="main",
        workspace_id="123", mode="fast", summary=curr_summary, failure_summary=f_sum, question_results=[q1, q2]
    )
    
    engine = RegressionEngine()
    regression_results = engine.run(curr_run, None)
    
    reporter = ReportGenerator(curr_run, regression_results)
    reporter.print_console_report()
    
    out_dir = Path(__file__).parent / "results"
    out_dir.mkdir(exist_ok=True)
    reporter.generate_markdown(out_dir)
    print("Markdown generated!")
    
    with open(out_dir / f"run_{curr_run.timestamp}_fast.json", "w", encoding="utf-8") as f:
        f.write(curr_run.model_dump_json(indent=2))
    print("JSON generated!")

if __name__ == "__main__":
    test()
