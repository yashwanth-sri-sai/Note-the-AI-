import asyncio
from app.evaluation.dashboard_service import DashboardService

def test():
    service = DashboardService()
    
    # 1. Test Caching & Latest Endpoint
    runs = service.get_all_runs()
    print(f"Loaded {len(runs)} runs from cache.")
    
    latest = service.get_latest_run()
    print(f"Latest run ID: {latest.run_id if latest else 'None'}")
    
    if not latest:
        print("No runs found, aborting test.")
        return
        
    # 2. Quality Score
    score = service.calculate_quality_score(latest)
    print(f"Latest Quality Score: {score}")
    
    # 3. Trends
    trends = service.get_trends()
    print(f"Generated {len(trends)} trend points.")
    if trends:
        print(f"Sample Trend: {trends[0]}")
        
    # 4. Failures
    fails = service.get_failure_analytics()
    print(f"Total Failures across history: {fails['total_failures']}")
    print(f"Failure Distribution: {fails['failure_distribution']}")
    print(f"Top Failing Documents: {fails['top_failing_documents']}")
    
    # 5. Paginated Questions
    qs = service.get_paginated_questions(page=1, size=5)
    print(f"Paginated total available: {qs['total']}")
    if qs["data"]:
        print(f"First Question from paginated: {qs['data'][0].question_id} ({qs['data'][0].failure_type})")

if __name__ == "__main__":
    test()
