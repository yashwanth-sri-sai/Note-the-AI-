import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, status, Response, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, get_db, get_current_workspace_id
from app.db.models.user import User
from app.db.models.document import Document, DocumentChunk, Embedding, ProcessingJob
from app.db.models.note import Note
from app.schemas.document import DocumentResponse, ProcessingJobResponse, ChunkNavigationResponse
from app.services.storage import StorageService
from app.services.extractor import get_extractor
from app.services.chunking import get_chunking_service
from app.services.embedding import get_embedding_provider
from app.services.token_estimator import TokenService
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
import os
try:
    import magic
except ImportError:
    magic = None
from pathlib import Path
from app.api.middlewares.rate_limiter import limiter

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
    correlation_id: str = None,
):
    """Asynchronous background worker executing page-by-page text extraction, chunking, and vector indexing."""
    import asyncio
    import time as _time
    import logging
    import traceback
    import re
    from app.services.metrics_service import log_latency_metric
    from app.core.config import settings
    from app.services.ai import AIService
    from app.db.models.note import Note
    from app.db.models.document import Document, DocumentChunk, Embedding, ProcessingJob
    from app.db.models.extensions import Flashcard, Quiz
    from sqlalchemy import select
    from datetime import datetime
    from app.core.logging_conf import correlation_id_ctx

    if correlation_id:
        correlation_id_ctx.set(correlation_id)

    logger = logging.getLogger("app.api.documents")
    logger.info(f"Starting ingestion pipeline for doc {document_id}, job {job_id}")

    async def update_status(status_str: str, error_msg: str = None, session = None):
        async def _update(db):
            job = await db.get(ProcessingJob, job_id)
            doc = await db.get(Document, document_id)
            if job:
                job.status = status_str
                if error_msg:
                    job.error_message = error_msg
                if status_str == "UPLOADING":
                    job.processing_started_at = datetime.utcnow()
                elif status_str in ["READY", "FAILED", "COMPLETED"]:
                    job.processing_completed_at = datetime.utcnow()
            if doc:
                if status_str not in ["SUMMARY_GENERATION", "FLASHCARD_GENERATION", "QUIZ_GENERATION"]:
                    doc.status = status_str
            await db.commit()

            # Record document processing status in Prometheus metrics
            from app.core.metrics import metrics_store
            metrics_store.set_gauge("noteai_document_processing_status", 1.0, {"status": status_str})

        if session:
            await _update(session)
        else:
            async with db_session_factory() as db:
                await _update(db)

    # 1. Initialize UPLOADING state
    logger.info(f"[PIPELINE] UPLOAD_STARTED — doc={document_id}")
    try:
        await update_status("UPLOADING")
        logger.info(f"[PIPELINE] UPLOAD_FINISHED — doc={document_id}")
    except Exception as e:
        logger.error(f"[PIPELINE] Failed to initialize UPLOADING status: {e}")

    # Load file bytes from storage if they were not passed (e.g. during startup recovery)
    _workspace_id = workspace_id
    _user_id = user_id
    if not file_bytes:
        logger.info(f"Loading file bytes from storage for document {document_id}")
        try:
            async with db_session_factory() as db:
                doc = await db.get(Document, document_id)
                if not doc:
                    logger.error(f"Document {document_id} not found in database. Aborting recovery.")
                    await update_status("FAILED", error_msg="Document not found in database.")
                    return
                _workspace_id = _workspace_id or doc.workspace_id
                _user_id = _user_id or doc.created_by
                storage_path = doc.storage_path
            
            from app.services.storage import StorageService
            storage_service = StorageService()
            file_bytes = await storage_service.get_file_bytes(storage_path)
            logger.info(f"Successfully loaded {len(file_bytes)} bytes from storage.")
        except Exception as e:
            logger.error(f"Failed to load file bytes from storage: {e}")
            await update_status("FAILED", error_msg=f"Storage retrieval error: {str(e)}")
            return

    max_retries = 3
    retry_delay = 2.0
    
    extracted_text = ""
    flat_chunks = []
    embedding_latency_ms = 0.0
    pipeline_start = _time.perf_counter()
    pipeline_completed = False

    try:
        for attempt in range(max_retries + 1):
            try:
                async with db_session_factory() as db:
                    # Update job's retry count in db
                    job = await db.get(ProcessingJob, job_id)
                    if job:
                        job.retry_count = attempt
                        await db.commit()

                    # Step A: Text Extraction
                    logger.info(f"[PIPELINE] TEXT_EXTRACTION_STARTED — attempt={attempt}, doc={document_id}")
                    _t_extract = _time.perf_counter()
                    await update_status("EXTRACTING", session=db)

                    extractor = get_extractor(filename, content_type)
                    extracted_data = extractor.extract_unified(file_bytes)
                    unified_text = extracted_data["text"]
                    page_map = extracted_data["page_map"]

                    if not unified_text.strip():
                        raise ValueError("No readable text content extracted from document.")

                    logger.info(
                        f"[PIPELINE] TEXT_EXTRACTION_FINISHED — "
                        f"chars={len(unified_text)}, pages={len(page_map)}, "
                        f"elapsed={(_time.perf_counter()-_t_extract)*1000:.1f}ms"
                    )
                    
                    # Step B: Chunking
                    logger.info(f"[PIPELINE] CHUNKING_STARTED — doc={document_id}")
                    _t_chunk = _time.perf_counter()
                    await update_status("CHUNKING", session=db)
                    
                    chunking_service = get_chunking_service()
                    sub_chunks = chunking_service.split_text_with_offsets(unified_text)
                    
                    flat_chunks = []
                    chunk_idx = 0
                    for sc in sub_chunks:
                        mapped_page = 1
                        mapped_section = None
                        for p in page_map:
                            if p["start_offset"] <= sc["start_offset"] < p["end_offset"]:
                                mapped_page = p["page_number"]
                                mapped_section = p["section_title"]
                                break
                        if not mapped_section and page_map and sc["start_offset"] >= page_map[-1]["end_offset"]:
                            mapped_page = page_map[-1]["page_number"]
                            mapped_section = page_map[-1]["section_title"]
                        
                        tokens = TokenService.estimate_tokens(sc["text"])
                        source_ref = f"{filename}#page={mapped_page}" if mapped_page else filename
                        
                        flat_chunks.append({
                            "text": sc["text"],
                            "chunk_index": chunk_idx,
                            "page_number": mapped_page,
                            "section_title": mapped_section,
                            "start_offset": sc["start_offset"],
                            "end_offset": sc["end_offset"],
                            "token_count": tokens,
                            "source_reference": source_ref
                        })
                        chunk_idx += 1

                    extracted_text = "\n\n".join([c["text"] for c in flat_chunks])
                    logger.info(
                        f"[PIPELINE] CHUNKING_FINISHED — "
                        f"chunks={len(flat_chunks)}, "
                        f"elapsed={(_time.perf_counter()-_t_chunk)*1000:.1f}ms"
                    )

                    # Step C: Embedding
                    logger.info(f"[PIPELINE] EMBEDDINGS_STARTED — doc={document_id}, chunks={len(flat_chunks)}")
                    _t_embed = _time.perf_counter()
                    await update_status("EMBEDDING", session=db)

                    # Check if chunks already exist (Idempotency)
                    stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id)
                    res = await db.execute(stmt)
                    existing_chunks = res.scalars().all()

                    if not existing_chunks:
                        # Chunks don't exist, generate and save them
                        logger.info(f"[PIPELINE] Generating batch embeddings for {len(flat_chunks)} chunks...")
                        embedding_provider = get_embedding_provider()
                        texts_to_embed = [c["text"] for c in flat_chunks]
                        embedding_start = _time.perf_counter()
                        vectors = await embedding_provider.get_embeddings(texts_to_embed)
                        embedding_latency_ms = (_time.perf_counter() - embedding_start) * 1000.0
                        logger.info(
                            f"[PIPELINE] EMBEDDINGS_FINISHED — "
                            f"vectors={len(vectors)}, elapsed={embedding_latency_ms:.1f}ms"
                        )

                        # Step C.5: Indexing
                        logger.info(f"[PIPELINE] INDEXING_STARTED — chunks={len(flat_chunks)}")
                        await update_status("INDEXING", session=db)
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
                        await db.commit()
                        logger.info(
                            f"[PIPELINE] INDEXING_FINISHED — "
                            f"chunks={len(flat_chunks)}, "
                            f"total_embed_elapsed={(_time.perf_counter()-_t_embed)*1000:.1f}ms"
                        )
                    else:
                        logger.info("[PIPELINE] Chunks and embeddings already exist. Skipping creation.")

                break # Success, break attempt loop!
                
            except Exception as e:
                logger.error(
                    f"[PIPELINE] PIPELINE_STAGE_FAILED — attempt={attempt}, doc={document_id}, "
                    f"error_type={type(e).__name__}, error={str(e)}"
                )
                logger.error(traceback.format_exc())

                # Determine if validation/unrecoverable error
                is_val = isinstance(e, (ValueError, TypeError, AttributeError)) or "MIME" in str(e)
                if is_val or attempt == max_retries:
                    raise e

                # Wait with exponential backoff
                logger.info(f"Retrying in {retry_delay} seconds...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2.0

        # Retrieve workspace/user params from Document if needed
        _workspace_id = workspace_id
        _user_id = user_id
        if not _workspace_id or not _user_id:
            async with db_session_factory() as db:
                doc = await db.get(Document, document_id)
                if doc:
                    _workspace_id = _workspace_id or doc.workspace_id
                    _user_id = _user_id or doc.created_by

        # Update corresponding Note content with the extracted text
        if extracted_text:
            async with db_session_factory() as db:
                note = await db.get(Note, document_id)
                if note:
                    note.content = extracted_text
                    db.add(note)
                    await db.commit()

        # Update Document and Job Status to READY (Non-blocking for optional AI tasks)
        await update_status("READY")
        document_processing_ms = (_time.perf_counter() - pipeline_start) * 1000.0
        asyncio.create_task(log_latency_metric(
            workspace_id=_workspace_id,
            user_id=_user_id,
            embedding_latency_ms=embedding_latency_ms,
            document_processing_ms=document_processing_ms,
        ))
        logger.info(
            f"[PIPELINE] DOCUMENT_COMPLETED — doc={document_id}, "
            f"total_elapsed={document_processing_ms:.1f}ms, "
            f"embed_ms={embedding_latency_ms:.1f}ms"
        )
        pipeline_completed = True

    except Exception as e:
        # Guarantee FAILED state
        logger.error(
            f"[PIPELINE] DOCUMENT_FAILED — doc={document_id}, "
            f"reason={str(e)[:200]}"
        )
        await update_status("FAILED", error_msg=str(e))
        # Update Note content to indicate failure
        async with db_session_factory() as db:
            note = await db.get(Note, document_id)
            if note:
                note.content = f"Failed to process document: {str(e)}"
                db.add(note)
                await db.commit()
        return  # Abort ingestion pipeline

    # ── Optional AI Tasks (Non-blocking) ──────────────────────────────────────────

    # Step D.5: Summary Generation (Optional, resilient)
    try:
        logger.info(f"[PIPELINE] SUMMARY_GENERATION_STARTED — doc={document_id}")
        await update_status("SUMMARY_GENERATION")
        # Placeholder for summary generation logic since there's no DB model for it, but log start and finish
        logger.info(f"[PIPELINE] SUMMARY_GENERATION_FINISHED — doc={document_id}")
    except Exception as e:
        logger.error(f"[PIPELINE] SUMMARY_GENERATION_FAILED — doc={document_id}: {e}")

    # Step D: Flashcard Generation (Resilient, try-except, idempotent)
    try:
        logger.info(f"[PIPELINE] FLASHCARDS_STARTED — doc={document_id}")
        _t_fc = _time.perf_counter()
        await update_status("FLASHCARD_GENERATION")
        async with db_session_factory() as db:
            # Check if flashcards already exist (Idempotency)
            fc_stmt = select(Flashcard).where(Flashcard.note_id == document_id)
            fc_res = await db.execute(fc_stmt)
            existing_fcs = fc_res.scalars().all()
            if not existing_fcs:
                ai_service = AIService(db)
                await ai_service.generate_note_flashcards(document_id, _workspace_id)
                logger.info(
                    f"[PIPELINE] FLASHCARDS_FINISHED — doc={document_id}, "
                    f"elapsed={(_time.perf_counter()-_t_fc)*1000:.1f}ms"
                )
            else:
                logger.info("[PIPELINE] Flashcards already exist. Skipping generation.")
    except Exception as e:
        logger.error(f"[PIPELINE] FLASHCARDS_FAILED — doc={document_id}: {e}")
        logger.error(traceback.format_exc())
        async with db_session_factory() as db:
            job = await db.get(ProcessingJob, job_id)
            if job:
                job.error_message = f"Flashcard Gen Error: {str(e)}"
                await db.commit()

    # Step E: Quiz Generation (Resilient, try-except, idempotent)
    try:
        logger.info(f"[PIPELINE] QUIZZES_STARTED — doc={document_id}")
        _t_qz = _time.perf_counter()
        await update_status("QUIZ_GENERATION")
        async with db_session_factory() as db:
            # Check if quizzes already exist (Idempotency)
            qz_stmt = select(Quiz).where(Quiz.note_id == document_id)
            qz_res = await db.execute(qz_stmt)
            existing_qzs = qz_res.scalars().all()
            if not existing_qzs:
                ai_service = AIService(db)
                await ai_service.generate_note_quiz(document_id, _workspace_id)
                logger.info(
                    f"[PIPELINE] QUIZZES_FINISHED — doc={document_id}, "
                    f"elapsed={(_time.perf_counter()-_t_qz)*1000:.1f}ms"
                )
            else:
                logger.info("[PIPELINE] Quizzes already exist. Skipping generation.")
    except Exception as e:
        logger.error(f"[PIPELINE] QUIZZES_FAILED — doc={document_id}: {e}")
        logger.error(traceback.format_exc())
        async with db_session_factory() as db:
            job = await db.get(ProcessingJob, job_id)
            if job:
                job.error_message = f"Quiz Gen Error: {str(e)}"
                await db.commit()

    # Finally set the job status back to READY (to indicate that optional tasks have completed)
    try:
        await update_status("READY")
    except Exception as e:
        logger.error(f"[PIPELINE] Failed to finalize status to READY: {e}")




async def run_document_reindex_pipeline(
    document_id: uuid.UUID,
    db_session_factory,
):
    """Re-embed chunks of a document using the active embedding provider."""
    async with db_session_factory() as db:
        doc = await db.get(Document, document_id)
        if not doc:
            return
            
        try:
            doc.status = "processing"
            await db.commit()
            
            # Load chunks
            stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index)
            res = await db.execute(stmt)
            chunks = res.scalars().all()
            
            if chunks:
                # Generate new embeddings
                embedding_provider = get_embedding_provider()
                provider_name = embedding_provider.__class__.__name__
                model_name = getattr(embedding_provider, "model", "LocalTrigram")
                
                texts = [c.chunk_text for c in chunks]
                vectors = await embedding_provider.get_embeddings(texts)
                
                # Update database
                for chunk, vector in zip(chunks, vectors):
                    # Delete existing embeddings for this chunk
                    stmt_del = select(Embedding).where(Embedding.chunk_id == chunk.id)
                    res_del = await db.execute(stmt_del)
                    old_embs = res_del.scalars().all()
                    for oe in old_embs:
                        await db.delete(oe)
                    await db.flush()
                    
                    # Add new embedding
                    new_emb = Embedding(
                        chunk_id=chunk.id,
                        embedding=vector,
                        provider=provider_name,
                        model_name=model_name
                    )
                    db.add(new_emb)
                    
            doc.status = "READY"
            await db.commit()
        except Exception as e:
            await db.rollback()
            doc = await db.get(Document, document_id)
            if doc:
                doc.status = "FAILED"
                await db.commit()




@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF, DOCX, TXT, or Markdown document to S3/local and trigger the async ingestion pipeline."""
    import time
    import asyncio
    import logging
    import traceback
    from fastapi.responses import JSONResponse
    from app.services.metrics import log_request_metrics_task

    logger = logging.getLogger("app.api.documents")
    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else None
    
    logger.info(f"Upload request received from {client_ip} for user {current_user.id}")
    
    try:
        # 1. Basic validation
        logger.info("Starting file validation...")
        fn = file.filename or "uploaded_file"
        ext = os.path.splitext(fn)[1].lower()
        if ext not in [".pdf", ".docx", ".txt", ".md"]:
            raise BadRequestException(
                detail=f"Unsupported file extension {ext}. Only PDF, DOCX, TXT, and Markdown are supported."
            )

        logger.info("Reading multipart file bytes...")
        file_bytes = await file.read()
        file_size = len(file_bytes)
        logger.info(f"File read successfully. Size: {file_size} bytes")

        # 1.5 Strict MIME Type validation using magic bytes
        logger.info("Validating MIME type using magic bytes...")
        if magic is not None:
            try:
                detected_mime = magic.from_buffer(file_bytes, mime=True)
            except Exception as e:
                logger.warning(f"magic.from_buffer failed: {e}. Falling back to mimetypes.")
                import mimetypes
                detected_mime = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        else:
            import mimetypes
            detected_mime = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        valid_mimes = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt": "text/plain",
            ".md": "text/plain"  # markdown is often detected as text/plain
        }
        expected_mime = valid_mimes.get(ext)
        if not expected_mime or not detected_mime.startswith(expected_mime.split('/')[0]):
            if detected_mime in ["application/x-dosexec", "application/x-executable", "text/html"]:
                raise BadRequestException(
                    detail=f"Invalid file content detected. Uploaded file signature ({detected_mime}) does not match extension."
                )
        logger.info(f"MIME validation passed: {detected_mime}")

        # 2. Store in storage bucket/local
        logger.info("Initiating storage upload...")
        storage_service = StorageService()
        storage_path = await storage_service.upload_file(file_bytes, fn)
        logger.info(f"Storage upload successful. Path: {storage_path}")

        # 3. Create Document entry
        logger.info("Saving document to database...")
        doc = Document(
            workspace_id=workspace_id,
            filename=fn,
            file_size=file_size,
            content_type=file.content_type or "application/octet-stream",
            storage_path=storage_path,
            status="UPLOADING",
            created_by=current_user.id
        )
        db.add(doc)
        await db.flush()  # Generate doc.id

        # Create a matching Note entry for this document
        note = Note(
            id=doc.id,
            title=fn,
            content="Processing document...",
            workspace_id=workspace_id,
            created_by=current_user.id
        )
        db.add(note)
        await db.flush()

        # 4. Create ProcessingJob entry
        job = ProcessingJob(
            document_id=doc.id,
            status="UPLOADING"
        )
        db.add(job)
        await db.flush()

        # Commit initial state to release DB locks before background task runs
        await db.commit()
        logger.info(f"Database save successful. Document ID: {doc.id}")

        # 5. Enqueue background ingestion pipeline task
        from app.db.session import async_session_factory
        from app.core.logging_conf import correlation_id_ctx
        corr_id = correlation_id_ctx.get()
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
            corr_id,
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
        logger.info("Returning response successfully.")
        return doc

    except Exception as e:
        logger.error(f"Upload failed: {str(e)}")
        logger.error(traceback.format_exc())
        
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
        return JSONResponse(
            status_code=status_code,
            content={"detail": str(e), "code": "UPLOAD_FAILED"}
        )


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

    # Delete corresponding Note with same ID
    note_stmt = select(Note).where(Note.id == document_id, Note.workspace_id == workspace_id)
    note_result = await db.execute(note_stmt)
    note = note_result.scalar_one_or_none()
    if note:
        await db.delete(note)

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
    # Use pathlib for secure path resolution to prevent traversal
    base_dir = Path(__file__).resolve().parent.parent.parent.parent / "storage"
    target_path = (base_dir / folder / filename).resolve()
    
    if not target_path.is_relative_to(base_dir):
        raise ForbiddenException("Path traversal forbidden")
        
    if not target_path.exists() or not target_path.is_file():
        raise NotFoundException("File not found")
        
    return FileResponse(str(target_path))


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


@router.post("/{document_id}/reindex", response_model=DocumentResponse)
async def reindex_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Trigger background reindexing of a document's chunks using the active embedding provider."""
    stmt = select(Document).where(Document.id == document_id, Document.workspace_id == workspace_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException(detail="Document not found")
        
    doc.status = "pending"
    await db.commit()
    
    from app.db.session import async_session_factory
    background_tasks.add_task(
        run_document_reindex_pipeline,
        document_id,
        async_session_factory,
    )
    
    return doc


@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Re-enqueue a failed document to run through the ingestion pipeline from scratch using stored file bytes."""
    stmt = select(Document).where(Document.id == document_id, Document.workspace_id == workspace_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundException(detail="Document not found")
        
    doc.status = "UPLOADING"
    await db.commit()
    
    # Check if a processing job already exists for this document, or create a new one
    job_stmt = select(ProcessingJob).where(ProcessingJob.document_id == document_id)
    job_res = await db.execute(job_stmt)
    job = job_res.scalar_one_or_none()
    if not job:
        job = ProcessingJob(document_id=document_id, status="UPLOADING")
        db.add(job)
        await db.flush()
    else:
        job.status = "UPLOADING"
        job.error_message = None
        job.retry_count = 0
    await db.commit()
    
    from app.db.session import async_session_factory
    from app.core.logging_conf import correlation_id_ctx
    corr_id = correlation_id_ctx.get()
    
    background_tasks.add_task(
        run_document_ingestion_pipeline,
        document_id,
        job.id,
        None,  # Pass None to load from storage
        doc.filename,
        doc.content_type,
        async_session_factory,
        workspace_id,
        current_user.id,
        corr_id,
    )
    
    return doc



