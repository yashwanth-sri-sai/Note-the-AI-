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
            logger.warning(f"Startup recovery: Found {count} unfinished job(s). Resuming execution...")
            
            for job in unfinished_jobs:
                # Fetch matching document
                doc = await db.get(Document, job.document_id)
                if not doc:
                    logger.error(f"Startup recovery: Document {job.document_id} not found for job {job.id}. Marking as failed.")
                    job.status = "FAILED"
                    job.error_message = "Document not found during recovery."
                    continue
                
                logger.info(f"Startup recovery: Re-enqueuing job {job.id} for document {doc.id} ({doc.filename})")
                
                # Spawn background task to process the document
                asyncio.create_task(
                    run_document_ingestion_pipeline(
                        document_id=doc.id,
                        job_id=job.id,
                        file_bytes=None,
                        filename=doc.filename,
                        content_type=doc.content_type,
                        db_session_factory=async_session_factory,
                        workspace_id=doc.workspace_id,
                        user_id=doc.created_by,
                    )
                )
            
            await db.commit()
            logger.info("Startup recovery: Recovery task completed successfully.")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Startup recovery: Recovery task failed: {e}")
