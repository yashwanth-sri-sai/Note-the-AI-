import os
import json
import httpx
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, AsyncGenerator, Optional
from app.core.exceptions import LLMProviderNotConfiguredException
from app.services.retrieval import RetrievalService
from app.services.context_builder import ContextBuilder
from app.db.session import AsyncSession
from app.db.models.chat import Message
from app.core.retries import retry_with_backoff


class RAGGenerationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.retrieval_service = RetrievalService(db)
        
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        self.openai_model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        self.gemini_model = os.getenv("GEMINI_CHAT_MODEL", "gemini-1.5-flash")

    def _calculate_confidence(self, references: List[Dict[str, Any]]) -> str:
        """Calculate confidence level (LOW, MEDIUM, HIGH) based on average similarity score."""
        if not references:
            return "LOW"
        scores = [ref.get("similarity_score", 0.0) for ref in references[:3]]
        avg_score = sum(scores) / len(scores)
        
        if avg_score >= 0.82:
            return "HIGH"
        elif avg_score >= 0.65:
            return "MEDIUM"
        else:
            return "LOW"

    def _make_references_serializable(self, references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert any UUID objects in references to string for JSON serialization safety."""
        serializable = []
        for ref in references:
            ref_copy = dict(ref)
            if "chunk_uuid" in ref_copy:
                ref_copy["chunk_uuid"] = str(ref_copy["chunk_uuid"])
            if "document_id" in ref_copy:
                ref_copy["document_id"] = str(ref_copy["document_id"])
            serializable.append(ref_copy)
        return serializable

    async def generate_answer(
        self,
        workspace_id: uuid.UUID,
        question: str,
        document_ids: Optional[List[uuid.UUID]] = None,
        file_types: Optional[List[str]] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        conversation_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Tuple[str, List[Dict[str, Any]], str]:
        """Synchronously generate a cited RAG answer and persist user and assistant messages in the DB."""
        import time
        import asyncio
        from app.services.token_estimator import TokenService
        from app.services.metrics import log_request_metrics_task

        start_time = time.perf_counter()
        retrieval_latency_ms = None
        llm_latency_ms = None
        prompt_tokens = None
        completion_tokens = None
        total_tokens = None
        model_used = "None"

        # 1. Check if LLM provider is configured
        if not self.openai_key and not self.gemini_key:
            raise LLMProviderNotConfiguredException()

        try:
            # 2. Save User Message if conversation_id is provided
            if conversation_id:
                user_msg = Message(
                    conversation_id=conversation_id,
                    sender_role="user",
                    content=question
                )
                self.db.add(user_msg)
                await self.db.flush()

            # 3. Retrieve matching document segments
            retrieval_start = time.perf_counter()
            raw_references = await self.retrieval_service.retrieve_context(
                workspace_id=workspace_id,
                query=question,
                limit=20,
                document_ids=document_ids,
                file_types=file_types,
                date_start=date_start,
                date_end=date_end
            )
            retrieval_latency_ms = (time.perf_counter() - retrieval_start) * 1000.0
            
            if not raw_references:
                no_context_msg = (
                    "I could not find sufficient information in the uploaded documents."
                )
                if conversation_id:
                    assistant_msg = Message(
                        conversation_id=conversation_id,
                        sender_role="assistant",
                        content=no_context_msg,
                        model_used="None",
                        retrieved_chunks=[],
                        citation_metadata={"confidence_score": "LOW"}
                    )
                    self.db.add(assistant_msg)
                    await self.db.commit()
                
                # Log search failure/empty metrics
                total_response_ms = (time.perf_counter() - start_time) * 1000.0
                asyncio.create_task(
                    log_request_metrics_task(
                        user_id=user_id,
                        workspace_id=workspace_id,
                        endpoint="/chat/conversations/{conversation_id}/messages",
                        method="POST",
                        status_code=200,
                        client_ip=None,
                        total_response_ms=total_response_ms,
                        retrieval_latency_ms=retrieval_latency_ms,
                        llm_latency_ms=0.0,
                        prompt_tokens=0,
                        completion_tokens=0,
                        total_tokens=0,
                        provider="None",
                        model_name="None"
                    )
                )
                return no_context_msg, [], "LOW"

            # 4. Assemble context using ContextBuilder
            context_builder = ContextBuilder(token_limit=4000)
            context_str, references = context_builder.build_context(raw_references)
            references = self._make_references_serializable(references)
            
            # 5. Calculate confidence score
            confidence = self._calculate_confidence(references)

            system_instruction = (
                "You are NoteAI, a production-grade citation-aware AI knowledge assistant.\n"
                "Your task is to answer the user's question using ONLY the provided retrieved context chunks.\n"
                "If the context does not contain the answer, respond exactly: 'I could not find sufficient information in the uploaded documents.'\n"
                "Never hallucinate. Do not use any external knowledge.\n"
                "For every statement you make based on a source, you MUST cite the source index inline, e.g. [1] or [2].\n"
                "Keep your answer clear, concise, and professional."
            )

            user_prompt = (
                f"Here is the retrieved context from the workspace:\n\n"
                f"{context_str}\n"
                f"Question: {question}\n\n"
                f"Answer:"
            )

            # 6. Invoke LLM API
            generated_text = ""
            
            async def _call_openai():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.openai_key}"
                    }
                    payload = {
                        "model": self.openai_model,
                        "messages": [
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.0
                    }
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers=headers,
                        json=payload
                    )
                    if response.status_code != 200:
                        raise Exception(f"OpenAI Chat API returned error {response.status_code}: {response.text}")
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()

            async def _call_gemini():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
                    params = {"key": self.gemini_key}
                    full_prompt = f"{system_instruction}\n\n{user_prompt}"
                    payload = {
                        "contents": [
                            {"role": "user", "parts": [{"text": full_prompt}]}
                        ],
                        "generationConfig": {
                            "temperature": 0.0
                        }
                    }
                    response = await client.post(url, params=params, json=payload)
                    if response.status_code != 200:
                        raise Exception(f"Gemini Chat API returned error {response.status_code}: {response.text}")
                    data = response.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()

            llm_start = time.perf_counter()
            if self.openai_key:
                model_used = self.openai_model
                generated_text = await retry_with_backoff(_call_openai)
            elif self.gemini_key:
                model_used = self.gemini_model
                generated_text = await retry_with_backoff(_call_gemini)
            llm_latency_ms = (time.perf_counter() - llm_start) * 1000.0

            # 7. Format sources footnotes
            source_footnotes = []
            citation_metadata = {"confidence_score": confidence, "citations": []}
            
            for i, ref in enumerate(references):
                doc_info = ref['document_name']
                if ref.get("page_number"):
                    doc_info += f" (Page {ref['page_number']})"
                elif ref.get("section_title"):
                    doc_info += f" (Section {ref['section_title']})"
                    
                source_footnotes.append(f"[{i+1}] {doc_info}")
                citation_metadata["citations"].append({
                    "index": i + 1,
                    "chunk_uuid": str(ref["chunk_uuid"]),
                    "document_name": ref["document_name"],
                    "document_id": str(ref["document_id"]),
                    "page_number": ref.get("page_number"),
                    "section_title": ref.get("section_title")
                })

            formatted_sources = "\n\nSources:\n" + "\n".join(source_footnotes)
            final_answer = f"{generated_text}{formatted_sources}"

            # 8. Save Assistant Message if conversation_id is provided
            if conversation_id:
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    sender_role="assistant",
                    content=final_answer,
                    model_used=model_used,
                    retrieved_chunks=references,
                    citation_metadata=citation_metadata
                )
                self.db.add(assistant_msg)
                await self.db.commit()

            # Estimate and log token metrics
            prompt_tokens = TokenService.estimate_tokens(system_instruction + user_prompt)
            completion_tokens = TokenService.estimate_tokens(final_answer)
            total_tokens = prompt_tokens + completion_tokens

            total_response_ms = (time.perf_counter() - start_time) * 1000.0
            asyncio.create_task(
                log_request_metrics_task(
                    user_id=user_id,
                    workspace_id=workspace_id,
                    endpoint="/chat/conversations/{conversation_id}/messages",
                    method="POST",
                    status_code=200,
                    client_ip=None,
                    total_response_ms=total_response_ms,
                    retrieval_latency_ms=retrieval_latency_ms,
                    llm_latency_ms=llm_latency_ms,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    provider="openai" if self.openai_key else "gemini",
                    model_name=model_used
                )
            )

            return final_answer, references, confidence

        except Exception as e:
            # Log failure metrics before raising
            total_response_ms = (time.perf_counter() - start_time) * 1000.0
            asyncio.create_task(
                log_request_metrics_task(
                    user_id=user_id,
                    workspace_id=workspace_id,
                    endpoint="/chat/conversations/{conversation_id}/messages",
                    method="POST",
                    status_code=500,
                    client_ip=None,
                    total_response_ms=total_response_ms,
                    retrieval_latency_ms=retrieval_latency_ms,
                    llm_latency_ms=0.0,
                    error_message=str(e),
                    provider="openai" if self.openai_key else "gemini",
                    model_name=model_used
                )
            )
            raise e

    async def generate_answer_stream(
        self,
        workspace_id: uuid.UUID,
        question: str,
        document_ids: Optional[List[uuid.UUID]] = None,
        file_types: Optional[List[str]] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        conversation_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream RAG answers in SSE format, yielding text tokens and final metadata footnotes, and persist context."""
        import time
        import asyncio
        from app.services.token_estimator import TokenService
        from app.services.metrics import log_request_metrics_task

        start_time = time.perf_counter()
        retrieval_latency_ms = None
        llm_latency_ms = None
        model_used = "None"
        provider = "openai" if self.openai_key else "gemini"

        # 1. Check if LLM provider is configured
        if not self.openai_key and not self.gemini_key:
            yield f"data: {json.dumps({'type': 'error', 'error': 'LLM_PROVIDER_NOT_CONFIGURED', 'message': 'Configure Gemini or OpenAI API key.'})}\n\n"
            return

        # 2. Save User Message if conversation_id is provided
        if conversation_id:
            user_msg = Message(
                conversation_id=conversation_id,
                sender_role="user",
                content=question
            )
            self.db.add(user_msg)
            await self.db.flush()

        # 3. Retrieve matching document segments
        retrieval_start = time.perf_counter()
        raw_references = await self.retrieval_service.retrieve_context(
            workspace_id=workspace_id,
            query=question,
            limit=20,
            document_ids=document_ids,
            file_types=file_types,
            date_start=date_start,
            date_end=date_end
        )
        retrieval_latency_ms = (time.perf_counter() - retrieval_start) * 1000.0
        
        if not raw_references:
            no_context_msg = (
                "I could not find sufficient information in the uploaded documents."
            )
            yield f"data: {json.dumps({'type': 'content', 'delta': no_context_msg})}\n\n"
            
            citation_meta = {"confidence_score": "LOW", "citations": []}
            yield f"data: {json.dumps({'type': 'metadata', 'confidence_score': 'LOW', 'model_used': 'None', 'references': [], 'citations': []})}\n\n"
            yield "data: [DONE]\n\n"
            
            if conversation_id:
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    sender_role="assistant",
                    content=no_context_msg,
                    model_used="None",
                    retrieved_chunks=[],
                    citation_metadata=citation_meta
                )
                self.db.add(assistant_msg)
                await self.db.commit()
            
            # Log metrics for empty search
            total_response_ms = (time.perf_counter() - start_time) * 1000.0
            asyncio.create_task(
                log_request_metrics_task(
                    user_id=user_id,
                    workspace_id=workspace_id,
                    endpoint="/chat/conversations/{conversation_id}/messages",
                    method="POST",
                    status_code=200,
                    client_ip=None,
                    total_response_ms=total_response_ms,
                    retrieval_latency_ms=retrieval_latency_ms,
                    llm_latency_ms=0.0,
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                    provider="None",
                    model_name="None"
                )
            )
            return

        # 4. Assemble context using ContextBuilder
        context_builder = ContextBuilder(token_limit=4000)
        context_str, references = context_builder.build_context(raw_references)
        references = self._make_references_serializable(references)
        
        # 5. Calculate confidence score
        confidence = self._calculate_confidence(references)

        system_instruction = (
            "You are NoteAI, a production-grade citation-aware AI knowledge assistant.\n"
            "Your task is to answer the user's question using ONLY the provided retrieved context chunks.\n"
            "If the context does not contain the answer, respond exactly: 'I could not find sufficient information in the uploaded documents.'\n"
            "Never hallucinate. Do not use any external knowledge.\n"
            "For every statement you make based on a source, you MUST cite the source index inline, e.g. [1] or [2].\n"
            "Keep your answer clear, concise, and professional."
        )

        user_prompt = (
            f"Here is the retrieved context from the workspace:\n\n"
            f"{context_str}\n"
            f"Question: {question}\n\n"
            f"Answer:"
        )

        generated_text = ""

        # 6. Stream from LLM API
        llm_start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if self.openai_key:
                    model_used = self.openai_model
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.openai_key}"
                    }
                    payload = {
                        "model": self.openai_model,
                        "messages": [
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.0,
                        "stream": True
                    }
                    
                    async def _send_openai_stream(c):
                        req = c.build_request("POST", "https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
                        resp = await c.send(req, stream=True)
                        if resp.status_code != 200:
                            err_text = await resp.aread()
                            raise Exception(f"OpenAI returned error: {resp.status_code} - {err_text.decode()}")
                        return resp
                    
                    response = await retry_with_backoff(_send_openai_stream, client)
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(data_str)
                                delta = chunk_json["choices"][0]["delta"].get("content", "")
                                if delta:
                                    generated_text += delta
                                    yield f"data: {json.dumps({'type': 'content', 'delta': delta})}\n\n"
                            except Exception:
                                pass
                    await response.aclose()
                                    
                elif self.gemini_key:
                    model_used = self.gemini_model
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:streamGenerateContent"
                    params = {"key": self.gemini_key}
                    full_prompt = f"{system_instruction}\n\n{user_prompt}"
                    payload = {
                        "contents": [
                            {"role": "user", "parts": [{"text": full_prompt}]}
                        ],
                        "generationConfig": {
                            "temperature": 0.0
                        }
                    }
                    
                    async def _send_gemini_stream(c):
                        req = c.build_request("POST", url, params=params, json=payload)
                        resp = await c.send(req, stream=True)
                        if resp.status_code != 200:
                            err_text = await resp.aread()
                            raise Exception(f"Gemini returned error: {resp.status_code} - {err_text.decode()}")
                        return resp
                    
                    response = await retry_with_backoff(_send_gemini_stream, client)
                    async for line in response.aiter_lines():
                        line_stripped = line.strip()
                        if not line_stripped:
                            continue
                        
                        # Strip JSON array wrapper chars
                        if line_stripped.startswith(","):
                            line_stripped = line_stripped[1:].strip()
                        if line_stripped.startswith("["):
                            line_stripped = line_stripped[1:].strip()
                        if line_stripped.endswith("]"):
                            line_stripped = line_stripped[:-1].strip()
                            
                        if not line_stripped:
                            continue
                            
                        try:
                            chunk_json = json.loads(line_stripped)
                            delta = chunk_json["candidates"][0]["content"]["parts"][0]["text"]
                            if delta:
                                generated_text += delta
                                yield f"data: {json.dumps({'type': 'content', 'delta': delta})}\n\n"
                        except Exception:
                            pass
                    await response.aclose()
            llm_latency_ms = (time.perf_counter() - llm_start) * 1000.0
        except Exception as e:
            total_response_ms = (time.perf_counter() - start_time) * 1000.0
            asyncio.create_task(
                log_request_metrics_task(
                    user_id=user_id,
                    workspace_id=workspace_id,
                    endpoint="/chat/conversations/{conversation_id}/messages",
                    method="POST",
                    status_code=500,
                    client_ip=None,
                    total_response_ms=total_response_ms,
                    retrieval_latency_ms=retrieval_latency_ms,
                    llm_latency_ms=0.0,
                    error_message=str(e),
                    provider=provider,
                    model_name=model_used
                )
            )
            yield f"data: {json.dumps({'type': 'error', 'message': f'{provider.upper()} stream error: {str(e)}'})}\n\n"
            return

        # 7. Formulate and Yield Citations Footnote
        source_footnotes = []
        citation_meta = {"confidence_score": confidence, "citations": []}
        
        for i, ref in enumerate(references):
            doc_info = ref['document_name']
            if ref.get("page_number"):
                doc_info += f" (Page {ref['page_number']})"
            elif ref.get("section_title"):
                doc_info += f" (Section {ref['section_title']})"
                
            source_footnotes.append(f"[{i+1}] {doc_info}")
            citation_meta["citations"].append({
                "index": i + 1,
                "chunk_uuid": str(ref["chunk_uuid"]),
                "document_name": ref["document_name"],
                "document_id": str(ref["document_id"]),
                "page_number": ref.get("page_number"),
                "section_title": ref.get("section_title")
            })

        formatted_sources = "\n\nSources:\n" + "\n".join(source_footnotes)
        final_answer = f"{generated_text}{formatted_sources}"

        # Yield footnote sources block
        yield f"data: {json.dumps({'type': 'footnote', 'footnote': formatted_sources})}\n\n"

        # Yield complete RAG metadata block
        yield f"data: {json.dumps({'type': 'metadata', 'confidence_score': confidence, 'model_used': model_used, 'references': references, 'citations': citation_meta['citations']})}\n\n"
        yield "data: [DONE]\n\n"

        # 8. Save Assistant Message in DB
        if conversation_id:
            assistant_msg = Message(
                conversation_id=conversation_id,
                sender_role="assistant",
                content=final_answer,
                model_used=model_used,
                retrieved_chunks=references,
                citation_metadata=citation_meta
            )
            self.db.add(assistant_msg)
            await self.db.commit()

        # 9. Estimate and log token metrics
        prompt_tokens = TokenService.estimate_tokens(system_instruction + user_prompt)
        completion_tokens = TokenService.estimate_tokens(final_answer)
        total_tokens = prompt_tokens + completion_tokens
        total_response_ms = (time.perf_counter() - start_time) * 1000.0

        asyncio.create_task(
            log_request_metrics_task(
                user_id=user_id,
                workspace_id=workspace_id,
                endpoint="/chat/conversations/{conversation_id}/messages",
                method="POST",
                status_code=200,
                client_ip=None,
                total_response_ms=total_response_ms,
                retrieval_latency_ms=retrieval_latency_ms,
                llm_latency_ms=llm_latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                provider=provider,
                model_name=model_used
            )
        )
