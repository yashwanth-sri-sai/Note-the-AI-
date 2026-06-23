import logging
from datetime import datetime, timedelta
from sqlalchemy import select, update
from app.db.session import async_session_factory
from app.db.models.document import ProcessingJob

logger = logging.getLogger("app.services.recovery_service")

STUCK_THRESHOLD_HOURS = 1
SYSTEM_INTERRUPTED_REASON = "SYSTEM_INTERRUPTED"


async def stuck_job_recovery_task() -> None:
    """On application startup, recover any processing jobs that are stuck.

    A job is considered stuck if it has been in 'processing' status for more
    than STUCK_THRESHOLD_HOURS without being updated. These are marked as
    'failed' with error reason 'SYSTEM_INTERRUPTED'.
    """
    cutoff = datetime.utcnow() - timedelta(hours=STUCK_THRESHOLD_HOURS)
    
    async with async_session_factory() as db:
        try:
            # Find all stuck processing jobs
            stmt = select(ProcessingJob).where(
                ProcessingJob.status == "processing",
                ProcessingJob.updated_at < cutoff
            )
            result = await db.execute(stmt)
            stuck_jobs = result.scalars().all()
            
            if not stuck_jobs:
                logger.info("Startup recovery: No stuck processing jobs found.")
                return
            
            count = len(stuck_jobs)
            logger.warning(f"Startup recovery: Found {count} stuck processing job(s). Marking as failed.")
            
            # Update each stuck job to failed state
            for job in stuck_jobs:
                job.status = "failed"
                job.error_message = SYSTEM_INTERRUPTED_REASON
            
            await db.commit()
            logger.info(f"Startup recovery: Successfully recovered {count} stuck job(s).")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Startup recovery: Failed to run stuck job recovery: {e}")
