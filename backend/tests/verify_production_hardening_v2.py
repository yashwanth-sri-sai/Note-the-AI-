"""
NoteAI Full Production Hardening Sprint - Verification Suite v2

Tests:
  1. Configurable Rate Limiter: Honors RATE_LIMIT_* settings
  2. Tenacity Retry Tracking: retry_count, failure_reason, last_attempt_at populated
  3. Token Cost Calculation: Provider/model cost estimates are correct
  4. Latency Metric Persistence: DB records created and queried correctly
  5. Stuck Job Recovery: Stale 'processing' jobs auto-transitioned to 'failed'
  6. Admin Metrics APIs: usage / tokens / latency / failures return correct aggregates
"""

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
from app.services.metrics_service import (
    calculate_token_cost,
    log_ai_request_and_tokens,
    log_latency_metric,
)
from app.services.recovery_service import stuck_job_recovery_task
from app.api.v1.endpoints.admin_metrics import (
    _calculate_percentile,
    _aggregate_for_period,
)
from app.db.session import async_session_factory, engine
from app.db.models.workspace import Workspace
from app.db.models.user import User
from app.db.models.document import Document, ProcessingJob
from app.db.models.metrics import APIRequestLog, LatencyMetric
from app.db.models.extensions import AIRequest, TokenUsage
from sqlalchemy import select, delete


# =========================================================================
# CHECK 1: Tenacity Retry with Tracking
# =========================================================================

async def test_retry_with_backoff():
    print("\n[CHECK 1] Testing tenacity-based retry_with_backoff with retry_tracker...")

    attempts = 0

    async def dummy_fail():
        nonlocal attempts
        attempts += 1
        raise ValueError("Simulated failure")

    tracker = {}
    try:
        await retry_with_backoff(dummy_fail, max_retries=3, initial_delay=0.01, backoff_factor=1.5, retry_tracker=tracker)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert str(e) == "Simulated failure"
        assert attempts == 3, f"Expected 3 attempts, got {attempts}"
        assert tracker.get("retry_count", 0) >= 2, f"Expected retry_count >= 2, got {tracker.get('retry_count')}"
        assert tracker.get("failure_reason") is not None, "failure_reason should be set"
        assert tracker.get("last_attempt_at") is not None, "last_attempt_at should be set"

    print(f"  retry_with_backoff retried 3 times with tracker: {tracker.get('retry_count')} retries recorded.")
    print("  [PASS] Tenacity retry tracking verified.")


# =========================================================================
# CHECK 2: Configurable Rate Limiter
# =========================================================================

async def test_rate_limiter():
    print("\n[CHECK 2] Testing configurable SlidingWindowRateLimiter...")
    from app.core.config import settings

    # Verify limiter was constructed with settings values
    from app.api.middlewares.rate_limiter import upload_limiter, chat_limiter, search_limiter
    assert upload_limiter.limit == settings.RATE_LIMIT_UPLOAD, (
        f"Upload limiter limit {upload_limiter.limit} != settings {settings.RATE_LIMIT_UPLOAD}"
    )
    assert chat_limiter.limit == settings.RATE_LIMIT_CHAT, (
        f"Chat limiter limit {chat_limiter.limit} != settings {settings.RATE_LIMIT_CHAT}"
    )
    assert search_limiter.limit == settings.RATE_LIMIT_SEARCH, (
        f"Search limiter limit {search_limiter.limit} != settings {settings.RATE_LIMIT_SEARCH}"
    )
    print(f"  Limiters aligned: upload={upload_limiter.limit}, chat={chat_limiter.limit}, search={search_limiter.limit}")

    # Verify window sliding behavior
    limiter = SlidingWindowRateLimiter(limit=3, window_seconds=1)
    assert limiter.is_allowed("test_key", "/test") is True
    assert limiter.is_allowed("test_key", "/test") is True
    assert limiter.is_allowed("test_key", "/test") is True
    assert limiter.is_allowed("test_key", "/test") is False
    print("  SlidingWindowRateLimiter blocks requests exceeding limit.")

    await asyncio.sleep(1.1)
    assert limiter.is_allowed("test_key", "/test") is True
    print("  SlidingWindowRateLimiter resets correctly after window expires.")
    print("  [PASS] Configurable rate limiting verified.")


# =========================================================================
# CHECK 3: Token Cost Calculator
# =========================================================================

async def test_token_cost_calculator():
    print("\n[CHECK 3] Testing token cost calculator...")

    # GPT-4o-mini: Input $0.150/1M, Output $0.600/1M
    cost_gpt4o_mini = calculate_token_cost("openai", "gpt-4o-mini", 1_000_000, 1_000_000)
    expected_gpt4o_mini = 0.00000015 * 1_000_000 + 0.00000060 * 1_000_000  # = 0.15 + 0.60 = 0.75
    assert abs(cost_gpt4o_mini - expected_gpt4o_mini) < 0.001, f"GPT-4o-mini cost incorrect: {cost_gpt4o_mini}"
    print(f"  GPT-4o-mini cost for 1M+1M tokens = ${cost_gpt4o_mini:.4f} (expected ${expected_gpt4o_mini:.4f})")

    # Gemini flash: Input $0.075/1M, Output $0.300/1M
    cost_flash = calculate_token_cost("google", "gemini-1.5-flash", 1_000_000, 1_000_000)
    expected_flash = 0.000000075 * 1_000_000 + 0.00000030 * 1_000_000  # = 0.075 + 0.30 = 0.375
    assert abs(cost_flash - expected_flash) < 0.001, f"Gemini flash cost incorrect: {cost_flash}"
    print(f"  Gemini Flash cost for 1M+1M tokens = ${cost_flash:.4f} (expected ${expected_flash:.4f})")

    # Free local provider
    cost_local = calculate_token_cost("local", "LocalTrigram", 5000, 0)
    assert cost_local == 0.0, f"Local cost should be 0.0, got {cost_local}"
    print(f"  Local provider cost = ${cost_local:.4f} (free, as expected)")
    print("  [PASS] Token cost calculation verified.")


# =========================================================================
# CHECK 4: DB Persistence – Latency Metrics + Token Usage
# =========================================================================

async def test_db_persistence():
    print("\n[CHECK 4] Testing database persistence: token usage and latency metrics...")

    async with async_session_factory() as db:
        # Setup temp workspace and user
        workspace = Workspace(name="Hardening Test WS", slug="hardening-test-ws")
        db.add(workspace)
        user = User(
            id=uuid.uuid4(),
            email=f"hardening_test_{uuid.uuid4().hex[:6]}@example.com",
            name="Hardening Test User"
        )
        db.add(user)
        await db.commit()

        workspace_id = workspace.id
        user_id = user.id

        try:
            # 1. Log token usage + AI request
            await log_ai_request_and_tokens(
                workspace_id=workspace_id,
                user_id=user_id,
                provider="openai",
                model="gpt-4o-mini",
                request_type="chat",
                prompt_tokens=800,
                completion_tokens=400,
            )

            # 2. Log latency metric
            await log_latency_metric(
                workspace_id=workspace_id,
                user_id=user_id,
                retrieval_latency_ms=150.0,
                llm_latency_ms=1800.0,
                total_response_ms=2000.0,
                embedding_latency_ms=45.0,
                document_processing_ms=3200.0,
            )

            # 3. Verify AI request was written
            ai_req_result = await db.execute(
                select(AIRequest).where(AIRequest.workspace_id == workspace_id)
            )
            ai_reqs = ai_req_result.scalars().all()
            assert len(ai_reqs) == 1, f"Expected 1 AIRequest, got {len(ai_reqs)}"
            assert ai_reqs[0].provider == "openai"
            assert ai_reqs[0].user_id == user_id
            print("  AIRequest log record persisted with user_id and provider.")

            # 4. Verify TokenUsage was written with cost
            tok_result = await db.execute(
                select(TokenUsage).where(TokenUsage.workspace_id == workspace_id)
            )
            tok_usages = tok_result.scalars().all()
            assert len(tok_usages) == 1, f"Expected 1 TokenUsage, got {len(tok_usages)}"
            assert tok_usages[0].prompt_tokens == 800
            assert tok_usages[0].completion_tokens == 400
            assert tok_usages[0].estimated_cost is not None
            assert tok_usages[0].estimated_cost > 0.0
            print(f"  TokenUsage persisted: estimated_cost=${tok_usages[0].estimated_cost:.8f}")

            # 5. Verify LatencyMetric was written
            lat_result = await db.execute(
                select(LatencyMetric).where(LatencyMetric.workspace_id == workspace_id)
            )
            lat_metrics = lat_result.scalars().all()
            assert len(lat_metrics) == 1, f"Expected 1 LatencyMetric, got {len(lat_metrics)}"
            assert lat_metrics[0].retrieval_latency_ms == 150.0
            assert lat_metrics[0].embedding_latency_ms == 45.0
            assert lat_metrics[0].document_processing_ms == 3200.0
            print("  LatencyMetric persisted with embedding and document processing latencies.")

            print("  [PASS] Database persistence for token usage and latency metrics verified.")

        finally:
            # Cleanup
            await db.execute(delete(LatencyMetric).where(LatencyMetric.workspace_id == workspace_id))
            await db.execute(delete(TokenUsage).where(TokenUsage.workspace_id == workspace_id))
            await db.execute(delete(AIRequest).where(AIRequest.workspace_id == workspace_id))
            await db.execute(delete(Workspace).where(Workspace.id == workspace_id))
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()


# =========================================================================
# CHECK 5: Stuck Job Recovery
# =========================================================================

async def test_stuck_job_recovery():
    print("\n[CHECK 5] Testing stuck job recovery service...")

    async with async_session_factory() as db:
        # Setup temp workspace and document
        workspace = Workspace(name="Recovery Test WS", slug="recovery-test-ws")
        db.add(workspace)
        await db.flush()

        doc = Document(
            workspace_id=workspace.id,
            filename="test.pdf",
            file_size=1000,
            content_type="application/pdf",
            storage_path="/tmp/test.pdf",
            status="processing",
        )
        db.add(doc)
        await db.flush()

        # Create a stuck job (updated_at = 2 hours ago)
        stuck_job = ProcessingJob(
            document_id=doc.id,
            status="processing",
        )
        db.add(stuck_job)
        await db.commit()

        # Manually set updated_at to 2 hours in the past
        from sqlalchemy import update as sa_update
        await db.execute(
            sa_update(ProcessingJob)
            .where(ProcessingJob.id == stuck_job.id)
            .values(updated_at=datetime.utcnow() - timedelta(hours=2))
        )
        await db.commit()

        job_id = stuck_job.id
        workspace_id = workspace.id
        doc_id = doc.id

        try:
            # Run the recovery task
            await stuck_job_recovery_task()

            # Expire the session identity map so next query hits the DB (not the stale cache)
            db.expire_all()

            recovered_result = await db.execute(
                select(ProcessingJob).where(ProcessingJob.id == job_id)
            )
            recovered_job = recovered_result.scalar_one()
            assert recovered_job.status == "failed", f"Expected 'failed', got {recovered_job.status!r}"
            assert recovered_job.error_message == "SYSTEM_INTERRUPTED", (
                f"Expected SYSTEM_INTERRUPTED, got {recovered_job.error_message!r}"
            )
            print("  Stuck processing job successfully recovered to 'failed' with SYSTEM_INTERRUPTED.")
            print("  [PASS] Stuck job recovery service verified.")

        finally:
            await db.execute(delete(ProcessingJob).where(ProcessingJob.document_id == doc_id))
            await db.execute(delete(Document).where(Document.id == doc_id))
            await db.execute(delete(Workspace).where(Workspace.id == workspace_id))
            await db.commit()


# =========================================================================
# CHECK 6: Admin Metrics Aggregation
# =========================================================================

async def test_admin_metrics():
    print("\n[CHECK 6] Testing admin metrics aggregation helpers...")

    # Simulate LatencyMetric-like objects for aggregation
    class FakeLatency:
        def __init__(self, retrieval, llm, total, embedding, doc_proc, created_at):
            self.retrieval_latency_ms = retrieval
            self.llm_latency_ms = llm
            self.total_response_ms = total
            self.embedding_latency_ms = embedding
            self.document_processing_ms = doc_proc
            self.created_at = created_at

    now = datetime.utcnow()
    rows = [
        FakeLatency(100.0, 1500.0, 1700.0, 50.0, 3000.0, now - timedelta(hours=1)),
        FakeLatency(200.0, 2000.0, 2300.0, 80.0, 4500.0, now - timedelta(hours=2)),
        FakeLatency(150.0, 1800.0, 2000.0, 60.0, 3500.0, now - timedelta(days=3)),  # weekly only
        FakeLatency(120.0, 1600.0, 1800.0, 55.0, 3200.0, now - timedelta(days=15)),  # monthly only
    ]

    daily_rows = _aggregate_for_period(rows, "daily")
    weekly_rows = _aggregate_for_period(rows, "weekly")
    monthly_rows = _aggregate_for_period(rows, "monthly")

    assert len(daily_rows) == 2, f"Expected 2 daily rows, got {len(daily_rows)}"
    assert len(weekly_rows) == 3, f"Expected 3 weekly rows, got {len(weekly_rows)}"
    assert len(monthly_rows) == 4, f"Expected 4 monthly rows, got {len(monthly_rows)}"
    print(f"  Period filtering: daily={len(daily_rows)}, weekly={len(weekly_rows)}, monthly={len(monthly_rows)}")

    # Test percentile calculations
    values = [100.0, 150.0, 200.0, 250.0, 300.0]
    p95 = _calculate_percentile(values, 0.95)
    assert abs(p95 - 290.0) < 0.1, f"p95 expected ~290.0, got {p95}"
    print(f"  Percentile P95={p95:.1f} verified for dataset {values}")

    print("  [PASS] Admin metrics aggregation helpers verified.")


# =========================================================================
# MAIN
# =========================================================================

async def main():
    try:
        print("=============================================================")
        print("NoteAI Full Production Hardening Sprint - Verification Suite v2")
        print("=============================================================")

        await test_retry_with_backoff()
        await test_rate_limiter()
        await test_token_cost_calculator()
        await test_db_persistence()
        await test_stuck_job_recovery()
        await test_admin_metrics()

        print("\n=============================================================")
        print("ALL PRODUCTION HARDENING SPRINT v2 VERIFICATIONS PASSED!")
        print("=============================================================")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
