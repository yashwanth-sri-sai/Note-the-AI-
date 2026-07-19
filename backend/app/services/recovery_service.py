import logging
from datetime import datetime, timedelta
from sqlalchemy import select, update
from app.db.session import async_session_factory
from app.db.models.document import ProcessingJob

logger = logging.getLogger("app.services.recovery_service")

STUCK_THRESHOLD_HOURS = 1
SYSTEM_INTERRUPTED_REASON = "SYSTEM_INTERRUPTED"


async def stuck_job_recovery_task() -> None:
    """On application startup, find any unfinished processing jobs and resume them.
    
    Unfinished jobs are those whose status is not in ('COMPLETED', 'completed', 'FAILED', 'failed').
    """
    import asyncio
    from app.db.models.document import Document
    from app.api.v1.endpoints.documents import run_document_ingestion_pipeline
    
    logger.info("Startup recovery: Scanning for unfinished processing jobs...")
    
    jobs_to_recover = []
    async with async_session_factory() as db:
        try:
            # Select all jobs that are not in a terminal state
            stmt = select(ProcessingJob).where(
                ~ProcessingJob.status.in_(["COMPLETED", "completed", "FAILED", "failed", "READY", "ready"])
            )
            result = await db.execute(stmt)
            unfinished_jobs = result.scalars().all()
            
            if not unfinished_jobs:
                logger.info("Startup recovery: No unfinished processing jobs found.")
                return
            
            count = len(unfinished_jobs)
            logger.warning(f"Startup recovery: Found {count} unfinished job(s). Preparing to resume...")
            
            for job in unfinished_jobs:
                # Fetch matching document
                doc = await db.get(Document, job.document_id)
                if not doc:
                    logger.error(f"Startup recovery: Document {job.document_id} not found for job {job.id}. Marking as failed.")
                    job.status = "FAILED"
                    job.error_message = "Document not found during recovery."
                    continue
                
                # Capture metadata for spawn
                jobs_to_recover.append({
                    "document_id": doc.id,
                    "job_id": job.id,
                    "filename": doc.filename,
                    "content_type": doc.content_type,
                    "workspace_id": doc.workspace_id,
                    "created_by": doc.created_by
                })
            
            await db.commit()
            logger.info("Startup recovery: Recovery query session committed and closed.")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Startup recovery: Scanning/Commit phase failed: {e}")
            return

    # Safely spawn recovery tasks outside of the active DB session block to prevent deadlocks
    for task_data in jobs_to_recover:
        logger.info(f"Startup recovery: Re-enqueuing job {task_data['job_id']} for document {task_data['document_id']} ({task_data['filename']})")
        
        asyncio.create_task(
            run_document_ingestion_pipeline(
                document_id=task_data["document_id"],
                job_id=task_data["job_id"],
                file_bytes=None,
                filename=task_data["filename"],
                content_type=task_data["content_type"],
                db_session_factory=async_session_factory,
                workspace_id=task_data["workspace_id"],
                user_id=task_data["created_by"],
            )
        )
    logger.info(f"Startup recovery: Successfully spawned {len(jobs_to_recover)} recovery tasks.")
