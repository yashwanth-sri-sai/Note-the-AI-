import asyncio
import sys
import os
import uuid
from datetime import datetime, timedelta

# Add backend directory to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

from app.core.retries import retry_with_backoff
from app.api.middlewares.rate_limiter import SlidingWindowRateLimiter
from app.services.metrics import log_request_metrics_task
from app.api.v1.endpoints.metrics import get_metrics_dashboard, calculate_percentile
from app.db.session import async_session_factory, engine
from app.db.models.workspace import Workspace
from app.db.models.user import User
from app.db.models.metrics import APIRequestLog
from sqlalchemy import select, delete


async def test_retry_with_backoff():
    print("\n[CHECK 1] Testing retry_with_backoff utility...")
    
    attempts = 0
    
    async def dummy_fail():
        nonlocal attempts
        attempts += 1
        raise ValueError("Simulated failure")

    # Run with max_retries=3, should call 3 times and then raise exception
    try:
        await retry_with_backoff(dummy_fail, max_retries=3, initial_delay=0.01, backoff_factor=1.5)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert str(e) == "Simulated failure"
        assert attempts == 3, f"Expected 3 attempts, got {attempts}"

    print("  retry_with_backoff successfully retried 3 times and raised exception.")
    print("  [PASS] Retry checks passed.")


async def test_rate_limiter():
    print("\n[CHECK 2] Testing SlidingWindowRateLimiter...")

    # Create a small rate limiter for testing
    limiter = SlidingWindowRateLimiter(limit=3, window_seconds=1)
    
    # Assert first 3 requests are allowed
    assert limiter.is_allowed("test_key", "/test") is True
    assert limiter.is_allowed("test_key", "/test") is True
    assert limiter.is_allowed("test_key", "/test") is True
    
    # Assert 4th request is blocked
    assert limiter.is_allowed("test_key", "/test") is False
    print("  SlidingWindowRateLimiter successfully blocks when limit is exceeded.")
    
    # Wait for window to expire
    await asyncio.sleep(1.1)
    
    # Assert requests are allowed again
    assert limiter.is_allowed("test_key", "/test") is True
    print("  SlidingWindowRateLimiter successfully resets after window expires.")
    print("  [PASS] Rate Limiter checks passed.")


async def test_percentile_calculation():
    print("\n[CHECK 3] Testing percentile helper logic...")
    
    data = [10.0, 20.0, 30.0, 40.0, 50.0]
    
    # P95 of [10, 20, 30, 40, 50]
    p95 = calculate_percentile(data, 0.95)
    # n=5, index=4*0.95=3.8 -> linear interp between index 3 (40) and index 4 (50)
    # 40 * (4 - 3.8) + 50 * (3.8 - 3) = 40 * 0.2 + 50 * 0.8 = 8 + 40 = 48.0
    assert p95 == 48.0, f"Expected 48.0, got {p95}"

    # P99
    p99 = calculate_percentile(data, 0.99)
    # idx = 4 * 0.99 = 3.96 -> 40 * 0.04 + 50 * 0.96 = 1.6 + 48 = 49.6
    assert p99 == 49.6, f"Expected 49.6, got {p99}"

    print("  Percentile linear interpolation calculation verified.")
    print("  [PASS] Percentile checks passed.")


async def test_telemetry_and_dashboard():
    print("\n[CHECK 4] Testing telemetry logging and metrics dashboard...")

    async with async_session_factory() as db:
        # 1. Setup temporary workspace and user
        workspace = Workspace(name="Telemetry Test Workspace", slug="telemetry-test-workspace")
        db.add(workspace)
        
        user = User(
            id=uuid.uuid4(),
            email="telemetry_test_user@example.com",
            name="Telemetry Test User"
        )
        db.add(user)
        await db.commit()
        
        user_uuid = user.id
        workspace_id = workspace.id

        # 2. Insert metrics logs using the service task (we await it directly to ensure DB write completes)
        # Log 1: Success (retrieval=150ms, LLM=2500ms, total=2700ms)
        await log_request_metrics_task(
            user_id=user_uuid,
            workspace_id=workspace_id,
            endpoint="/chat/conversations/{conversation_id}/messages",
            method="POST",
            status_code=200,
            client_ip="127.0.0.1",
            total_response_ms=2700.0,
            retrieval_latency_ms=150.0,
            llm_latency_ms=2500.0,
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
            provider="openai",
            model_name="gpt-4o-mini"
        )
        
        # Log 2: Success (retrieval=200ms, LLM=1800ms, total=2100ms)
        await log_request_metrics_task(
            user_id=user_uuid,
            workspace_id=workspace_id,
            endpoint="/chat/conversations/{conversation_id}/messages",
            method="POST",
            status_code=200,
            client_ip="127.0.0.1",
            total_response_ms=2100.0,
            retrieval_latency_ms=200.0,
            llm_latency_ms=1800.0,
            prompt_tokens=800,
            completion_tokens=400,
            total_tokens=1200,
            provider="openai",
            model_name="gpt-4o-mini"
        )
        
        # Log 3: Client Error (400 Bad Request)
        await log_request_metrics_task(
            user_id=user_uuid,
            workspace_id=workspace_id,
            endpoint="/upload",
            method="POST",
            status_code=400,
            client_ip="127.0.0.1",
            total_response_ms=50.0,
            retrieval_latency_ms=0.0,
            llm_latency_ms=0.0,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            provider="None",
            model_name="None",
            error_message="Unsupported file extension .exe"
        )
        
        # Log 4: Server Error (500 Internal Error)
        await log_request_metrics_task(
            user_id=user_uuid,
            workspace_id=workspace_id,
            endpoint="/chat/conversations/{conversation_id}/messages",
            method="POST",
            status_code=500,
            client_ip="127.0.0.1",
            total_response_ms=1000.0,
            retrieval_latency_ms=100.0,
            llm_latency_ms=0.0,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            provider="openai",
            model_name="gpt-4o-mini",
            error_message="OpenAI rate limit exceeded"
        )
        
        await db.commit()

        try:
            # 3. Call the dashboard endpoint function
            dashboard = await get_metrics_dashboard(workspace_id=workspace_id, db=db)
            
            # Assert Usage metrics
            usage = dashboard["usage"]
            assert usage["requests_by_endpoint"]["/upload"] == 1
            assert usage["requests_by_endpoint"]["/chat/conversations/{conversation_id}/messages"] == 3
            assert usage["requests_by_user"][str(user_uuid)] == 4
            assert usage["total_prompt_tokens"] == 1800
            assert usage["total_completion_tokens"] == 900
            assert usage["total_tokens"] == 2700
            print("  Dashboard usage metrics verified successfully.")

            # Assert Failures metrics
            failures = dashboard["failures"]
            assert failures["total_requests"] == 4
            assert failures["success_count"] == 2
            assert failures["client_error_count"] == 1
            assert failures["server_error_count"] == 1
            assert failures["success_rate"] == 0.5000
            assert len(failures["last_errors"]) == 2
            assert failures["last_errors"][0]["status_code"] in [400, 500]
            print("  Dashboard failure metrics and error lists verified successfully.")

            # Assert Latency metrics
            latency = dashboard["latency"]
            # Retrieval latencies: [150.0, 200.0, 0.0, 100.0] -> Mean = 112.5
            assert latency["retrieval"]["mean"] == 112.5, f"Expected 112.5, got {latency['retrieval']['mean']}"
            # LLM latencies: [2500.0, 1800.0, 0.0, 0.0] -> Mean = 1075.0
            assert latency["llm"]["mean"] == 1075.0, f"Expected 1075.0, got {latency['llm']['mean']}"
            # Total latencies: [2700.0, 2100.0, 50.0, 1000.0] -> Mean = 1462.5
            assert latency["total"]["mean"] == 1462.5, f"Expected 1462.5, got {latency['total']['mean']}"
            print("  Dashboard latency metrics calculations verified successfully.")
            
            print("  [PASS] Operational Dashboard & Telemetry DB persistence verified.")

        finally:
            # 4. Clean up test records
            print("  Cleaning up temporary test records...")
            await db.execute(delete(APIRequestLog).where(APIRequestLog.workspace_id == workspace_id))
            await db.execute(delete(Workspace).where(Workspace.id == workspace_id))
            await db.execute(delete(User).where(User.id == user_uuid))
            await db.commit()


async def main():
    try:
        print("=============================================================")
        print("NoteAI Production Hardening Sprint Verification Suite")
        print("=============================================================")
        
        await test_retry_with_backoff()
        await test_rate_limiter()
        await test_percentile_calculation()
        await test_telemetry_and_dashboard()
        
        print("\n=============================================================")
        print("ALL PRODUCTION HARDENING Sprint VERIFICATIONS PASSED SUCCESSFULLY!")
        print("=============================================================")
    finally:
        await engine.dispose()



if __name__ == "__main__":
    asyncio.run(main())
