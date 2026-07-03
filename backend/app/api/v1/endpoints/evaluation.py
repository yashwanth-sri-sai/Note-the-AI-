from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from app.evaluation.dashboard_service import DashboardService
from app.evaluation.models import BenchmarkRun
from app.schemas.evaluation import (
    TrendResponse, FailureAnalyticsResponse, 
    PaginatedQuestionsResponse, QualityScoreResponse
)
from app.api.deps import get_current_active_user
from app.models.user import User

router = APIRouter()
service = DashboardService()

@router.get("/latest", response_model=BenchmarkRun)
def get_latest_benchmark(current_user: User = Depends(get_current_active_user)):
    """Returns the most recent benchmark run metadata and metrics."""
    run = service.get_latest_run()
    if not run:
        raise HTTPException(status_code=404, detail="No benchmark runs found.")
    return run

@router.get("/latest/quality", response_model=QualityScoreResponse)
def get_latest_quality_score(current_user: User = Depends(get_current_active_user)):
    """Calculates and returns the automated overall quality score for the latest run."""
    run = service.get_latest_run()
    if not run:
        raise HTTPException(status_code=404, detail="No benchmark runs found.")
        
    score = service.calculate_quality_score(run)
    meta = service.get_quality_score_metadata()
    return QualityScoreResponse(quality_score=score, weights=meta["weights"])

@router.get("/history", response_model=List[BenchmarkRun])
def get_benchmark_history(current_user: User = Depends(get_current_active_user)):
    """Returns all benchmark runs ordered chronologically."""
    return service.get_all_runs()

@router.get("/trends", response_model=TrendResponse)
def get_evaluation_trends(
    mode: Optional[str] = Query(None, description="Filter by benchmark mode (fast, full, ci)"),
    workspace_id: Optional[str] = Query(None, description="Filter by specific workspace"),
    current_user: User = Depends(get_current_active_user)
):
    """Returns time-series data for core metrics and quality scores over time."""
    trends = service.get_trends(mode=mode, workspace_id=workspace_id)
    return TrendResponse(trends=trends)

@router.get("/failures", response_model=FailureAnalyticsResponse)
def get_failure_analytics(
    mode: Optional[str] = Query(None, description="Filter by benchmark mode"),
    workspace_id: Optional[str] = Query(None, description="Filter by specific workspace"),
    current_user: User = Depends(get_current_active_user)
):
    """Aggregates failure data across runs, exposing top failing documents and pages."""
    analytics = service.get_failure_analytics(mode=mode, workspace_id=workspace_id)
    return FailureAnalyticsResponse(**analytics)

@router.get("/questions", response_model=PaginatedQuestionsResponse)
def get_paginated_questions(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    mode: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    failure_type: Optional[str] = Query(None, description="Filter by specific failure classification"),
    date_prefix: Optional[str] = Query(None, description="Filter by date prefix (e.g. 20260703)"),
    current_user: User = Depends(get_current_active_user)
):
    """Returns a paginated, filterable list of all QuestionEvaluations."""
    res = service.get_paginated_questions(
        page=page, size=size, mode=mode, workspace_id=workspace_id,
        failure_type=failure_type, date_prefix=date_prefix
    )
    return PaginatedQuestionsResponse(**res)
