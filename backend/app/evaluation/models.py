from pydantic import BaseModel, Field
from typing import List, Optional

class RetrievalMetrics(BaseModel):
    precision_at_5: float = 0.0
    recall_at_5: float = 0.0
    avg_similarity: float = 0.0
    avg_chunks: float = 0.0
    avg_tokens: float = 0.0

class GenerationMetrics(BaseModel):
    faithfulness: float = 0.0
    groundedness: float = 0.0
    hallucination_rate: float = 0.0

class PerformanceMetrics(BaseModel):
    avg_latency_ms: float = 0.0
    min_latency_ms: float = 0.0
    max_latency_ms: float = 0.0

class BenchmarkSummary(BaseModel):
    questions: int = 0
    retrieval: RetrievalMetrics = Field(default_factory=RetrievalMetrics)
    generation: GenerationMetrics = Field(default_factory=GenerationMetrics)
    performance: PerformanceMetrics = Field(default_factory=PerformanceMetrics)

class QuestionEvaluation(BaseModel):
    question_id: str
    question: str
    expected_answer: str
    generated_answer: str
    expected_documents: List[str]
    retrieved_documents: List[str]
    expected_chunk_ids: List[str]
    retrieved_chunk_ids: List[str]
    expected_pages: List[int]
    retrieved_pages: List[int]
    latency_ms: float
    retrieval_recall: float
    retrieval_precision: float
    groundedness: float
    faithfulness: float
    hallucination_score: float
    citation_accuracy: float
    failure_type: str = "NONE"
    failure_reason: str = ""
    # Added for debugging classification rules without changing prod RAG
    pre_rerank_chunk_ids: List[str] = Field(default_factory=list)

class FailureSummary(BaseModel):
    total_failed: int = 0
    retrieval_failures: int = 0
    rerank_failures: int = 0
    chunking_failures: int = 0
    prompt_failures: int = 0
    hallucinations: int = 0
    citation_failures: int = 0
    unknown_failures: int = 0
    top_failing_documents: dict[str, int] = Field(default_factory=dict)
    top_failing_pages: dict[str, int] = Field(default_factory=dict)

class BenchmarkRun(BaseModel):
    run_id: str
    timestamp: str
    git_commit: str
    branch: str
    workspace_id: str
    mode: str
    summary: BenchmarkSummary
    failure_summary: FailureSummary = Field(default_factory=FailureSummary)
    question_results: List[QuestionEvaluation]
