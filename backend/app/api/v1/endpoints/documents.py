import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, status, Response, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.api.middlewares.rate_limiter import rate_limit_upload
from app.db.models.user import User
from app.db.models.document import Document, DocumentChunk, Embedding, ProcessingJob
from app.schemas.document import DocumentResponse, ProcessingJobResponse, ChunkNavigationResponse
from app.services.storage import StorageService
from app.services.extractor import get_extractor
from app.services.chunking import get_chunking_service
from app.services.embedding import get_embedding_provider
from app.services.token_estimator import TokenService
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
import os

router = APIRouter()


async def run_document_ingestion_pipeline(
    document_id: uuid.UUID,
    job_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    db_session_factory,
    workspace_id: uuid.UUID = None,
    user_id: uuid.UUID = None,
):
    """Asynchronous background worker executing page-by-page text extraction, chunking, and vector indexing."""
    import asyncio
    import time as _time
    from app.services.metrics_service import log_latency_metric
    from app.core.config import settings

    pipeline_start = _time.perf_counter()

    async with db_session_factory() as db:
        # Load job and doc
        job = await db.get(ProcessingJob, job_id)
        doc = await db.get(Document, document_id)
        if not job or not doc:
            return

        # Resolve workspace_id from doc if not provided
        _workspace_id = workspace_id or doc.workspace_id
        _user_id = user_id or doc.created_by

        try:
            # 1. Update status to processing
            job.status = "processing"
            doc.status = "processing"
            await db.commit()

            # 2. Extract page segments and split them with offsets
            extractor = get_extractor(filename, content_type)
            chunking_service = get_chunking_service()
            
            flat_chunks = []
            chunk_idx = 0
            for segment in extractor.extract_segments(file_bytes):
                page_text = segment["text"]
                page_num = segment["page_number"]
                section_title = segment["section_title"]
                
                # Split this segment's text with offsets
                sub_chunks = chunking_service.split_text_with_offsets(page_text)
                for sc in sub_chunks:
                    tokens = TokenService.estimate_tokens(sc["text"])
                    source_ref = f"{filename}#page={page_num}" if page_num else filename
                    
                    flat_chunks.append({
                        "text": sc["text"],
                        "chunk_index": chunk_idx,
                        "page_number": page_num,
                        "section_title": section_title,
                        "start_offset": sc["start_offset"],
                        "end_offset": sc["end_offset"],
                        "token_count": tokens,
                        "source_reference": source_ref
                    })
                    chunk_idx += 1

            if not flat_chunks:
                raise ValueError("No readable text content extracted from document.")

            # 3. Generate batch embeddings (track embedding latency)
            embedding_provider = get_embedding_provider()
            texts_to_embed = [c["text"] for c in flat_chunks]
            embedding_start = _time.perf_counter()
            vectors = await embedding_provider.get_embeddings(texts_to_embed)
            embedding_latency_ms = (_time.perf_counter() - embedding_start) * 1000.0

            # 4. Store chunks & embeddings in database
            for chunk_data, vector in zip(flat_chunks, vectors):
                chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=chunk_data["chunk_index"],
                    chunk_text=chunk_data["text"],
                    page_number=chunk_data["page_number"],
                    section_title=chunk_data["section_title"],
                    start_offset=chunk_data["start_offset"],
                    end_offset=chunk_data["end_offset"],
                    token_count=chunk_data["token_count"],
                    source_reference=chunk_data["source_reference"]
                )
                db.add(chunk)
                await db.flush()  # Generate chunk.id

                embedding_record = Embedding(
                    chunk_id=chunk.id,
                    embedding=vector,
                    provider=getattr(embedding_provider, "__class__").__name__,
                    model_name=getattr(embedding_provider, "model", "LocalTrigram")
                )
                db.add(embedding_record)

            # 5. Complete Job & Document Status
            job.status = "completed"
            doc.status = "completed"
            await db.commit()

            # 6. Log latency metrics asynchronously
            document_processing_ms = (_time.perf_counter() - pipeline_start) * 1000.0
            asyncio.create_task(log_latency_metric(
                workspace_id=_workspace_id,
                user_id=_user_id,
                embedding_latency_ms=embedding_latency_ms,
                document_processing_ms=document_processing_ms,
            ))

        except Exception as e:
            # Capture exception to Sentry if configured
            if settings.SENTRY_DSN:
                try:
                    import sentry_sdk
                    sentry_sdk.capture_exception(e)
                except Exception:
                    pass

            # Rollback transaction and mark job as failed
            await db.rollback()
            # Retrieve fresh job and doc instances from database
            job = await db.get(ProcessingJob, job_id)
            doc = await db.get(Document, document_id)
            if job and doc:
                job.status = "failed"
                job.error_message = str(e)
                doc.status = "failed"
                await db.commit()




@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit_upload),
):
    """Upload a PDF, DOCX, TXT, or Markdown document to S3/local and trigger the async ingestion pipeline."""
    import time
    import asyncio
    from app.services.metrics import log_request_metrics_task

    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else None
    
    try:
        # 1. Basic validation
        fn = file.filename or "uploaded_file"
        ext = os.path.splitext(fn)[1].lower()
        if ext not in [".pdf", ".docx", ".txt", ".md"]:
            raise BadRequestException(
                detail=f"Unsupported file extension {ext}. Only PDF, DOCX, TXT, and Markdown are supported."
            )

        file_bytes = await file.read()
        file_size = len(file_bytes)

        # 2. Store in storage bucket/local
        storage_service = StorageService()
        storage_path = await storage_service.upload_file(file_bytes, fn)

        # 3. Create Document entry
        doc = Document(
            workspace_id=workspace_id,
            filename=fn,
            file_size=file_size,
            content_type=file.content_type or "application/octet-stream",
            storage_path=storage_path,
            status="pending",
            created_by=current_user.id
        )
        db.add(doc)
        await db.flush()  # Generate doc.id

        # 4. Create ProcessingJob entry
        job = ProcessingJob(
            document_id=doc.id,
            status="pending"
        )
        db.add(job)
        await db.flush()

        # Commit initial state to release DB locks before background task runs
        await db.commit()

        # 5. Enqueue background ingestion pipeline task
        from app.db.session import async_session_factory
        background_tasks.add_task(
            run_document_ingestion_pipeline,
            doc.id,
            job.id,
            file_bytes,
            fn,
            file.content_type or "",
            async_session_factory,
            workspace_id,
            current_user.id,
        )


        total_response_ms = (time.perf_counter() - start_time) * 1000.0
        asyncio.create_task(
            log_request_metrics_task(
                user_id=current_user.id,
                workspace_id=workspace_id,
                endpoint="/upload",
                method="POST",
                status_code=201,
                client_ip=client_ip,
                total_response_ms=total_response_ms,
                retrieval_latency_ms=0.0,
                llm_latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                provider="None",
                model_name="None"
            )
        )
        return doc

    except Exception as e:
        total_response_ms = (time.perf_counter() - start_time) * 1000.0
        status_code = 400 if isinstance(e, BadRequestException) else 500
        asyncio.create_task(
            log_request_metrics_task(
                user_id=current_user.id if current_user else None,
                workspace_id=workspace_id,
                endpoint="/upload",
                method="POST",
                status_code=status_code,
                client_ip=client_ip,
                total_response_ms=total_response_ms,
                retrieval_latency_ms=0.0,
                llm_latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                provider="None",
                model_name="None",
                error_message=str(e)
            )
        )
        raise e


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve metadata of all uploaded documents inside the active workspace."""
    stmt = (
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/jobs/{job_id}", response_model=ProcessingJobResponse)
async def get_processing_job_status(
    job_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Poll the status of an active document text extraction and embedding ingestion task."""
    stmt = (
        select(ProcessingJob)
        .join(Document, ProcessingJob.document_id == Document.id)
        .where(ProcessingJob.id == job_id, Document.workspace_id == workspace_id)
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise NotFoundException(detail="Processing job not found in this workspace")
    return job


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a document, its storage files, vector embeddings, and chunk records."""
    stmt = select(Document).where(Document.id == document_id, Document.workspace_id == workspace_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException(detail="Document not found")

    # Delete S3/local file
    storage_service = StorageService()
    await storage_service.delete_file(doc.storage_path)

    # Cascading deletes will remove chunks, embeddings, and jobs
    await db.delete(doc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/download/{folder}/{filename}")
async def download_local_file(
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Download a file from local storage fallback (for development environment only)."""
    # Enforce standard security checks to avoid path traversal
    if ".." in folder or ".." in filename:
        raise ForbiddenException("Path traversal forbidden")
        
    local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage"))
    file_path = os.path.join(local_dir, folder, filename)
    if not os.path.exists(file_path):
        raise NotFoundException("File not found")
        
    return FileResponse(file_path)


@router.get("/chunks/{chunk_uuid}", response_model=ChunkNavigationResponse)
async def resolve_document_chunk(
    chunk_uuid: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve full context of a single document chunk for citation deep linking/navigation."""
    stmt = (
        select(
            DocumentChunk.chunk_uuid,
            DocumentChunk.chunk_text,
            DocumentChunk.page_number,
            DocumentChunk.section_title,
            DocumentChunk.source_reference,
            Document.id.label("document_id"),
            Document.filename.label("document_name")
        )
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(DocumentChunk.chunk_uuid == chunk_uuid, Document.workspace_id == workspace_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise NotFoundException(detail="Document chunk not found in this workspace")
        
    return {
        "chunk_uuid": row.chunk_uuid,
        "document_id": row.document_id,
        "document_name": row.document_name,
        "page_number": row.page_number,
        "section_title": row.section_title,
        "chunk_text": row.chunk_text,
        "source_reference": row.source_reference
    }

