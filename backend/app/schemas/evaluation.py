from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.evaluation.models import BenchmarkRun, QuestionEvaluation

class TrendPoint(BaseModel):
    timestamp: str
    metric: str
    value: float

class TrendResponse(BaseModel):
    trends: List[TrendPoint]

class FailureAnalyticsResponse(BaseModel):
    total_failures: int
    failure_distribution: Dict[str, int]
    top_failing_documents: Dict[str, int]
    top_failing_pages: Dict[str, int]
    top_failing_questions: List[Dict[str, Any]]

class PaginatedQuestionsResponse(BaseModel):
    total: int
    page: int
    size: int
    data: List[QuestionEvaluation]

class QualityScoreResponse(BaseModel):
    quality_score: float
    weights: Dict[str, str]
