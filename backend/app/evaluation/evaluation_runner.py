import uuid
import time
import httpx
from typing import Dict, Any
from app.db.session import async_session_factory
from app.services.retrieval import RetrievalService
from app.services.context_builder import ContextBuilder
from app.services.rag_generation import RAGGenerationService
from app.evaluation.metrics import (
    evaluate_faithfulness_and_relevancy, 
    calculate_retrieval_metrics, 
    calculate_chunk_retrieval_metrics,
    calculate_citation_accuracy,
    calculate_hallucination_rate
)

async def run_evaluation_for_case(workspace_id: uuid.UUID, test_case: Dict[str, Any], mode: str = "full") -> Dict[str, Any]:
    """Runs a single test case through the RAG pipeline and returns metrics."""
    question = test_case["question"]
    expected_citations = test_case.get("expected_citations", [])
    expected_chunk_uuids = test_case.get("expected_chunk_uuids", [])
    
    start_time = time.perf_counter()
    time_to_first_token = 0.0
    
    async with async_session_factory() as db:
        retrieval_service = RetrievalService(db)
        
        # 1. Retrieval + Reranker
        retrieval_start = time.perf_counter()
        raw_references = await retrieval_service.retrieve_context(
            workspace_id=workspace_id,
            query=question,
            limit=10
        )
        retrieval_latency = time.perf_counter() - retrieval_start
        
        # 2. Context Builder
        context_builder = ContextBuilder()
        context_str, accepted_chunks = context_builder.build_context(raw_references)
        
        # Extract returned document names
        retrieved_docs = list(set([chunk.get("document_name") for chunk in accepted_chunks if chunk.get("document_name")]))
        retrieved_chunk_uuids = [str(chunk.get("chunk_uuid")) for chunk in accepted_chunks if chunk.get("chunk_uuid")]
        
        answer = ""
        faithfulness, relevancy, groundedness = 0.0, 0.0, 0.0
        
        # 3. LLM Generation (Skip if FAST mode)
        if mode != "fast":
            rag_service = RAGGenerationService(db)
            sys_prompt = rag_service._build_system_prompt()
            
            # Manually invoke LLM to avoid saving to chat history DB
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{rag_service.settings.GEMINI_MODEL}:generateContent?key={rag_service.settings.GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            prompt = sys_prompt + f"\n\nContext:\n{context_str}\n\nQuestion: {question}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            
            llm_start = time.perf_counter()
            
            async def _make_call():
                async with httpx.AsyncClient(timeout=rag_service.settings.AI_GENERATION_TIMEOUT) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()

            from app.core.retries import retry_with_backoff
            try:
                data = await retry_with_backoff(_make_call)
                time_to_first_token = time.perf_counter() - llm_start
                answer = data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                answer = f"Error during generation: {str(e)}"
                
        total_latency = time.perf_counter() - start_time
        
        # Compute RAG Confidence (same logic as rag_generation.py)
        confidence = "LOW"
        if accepted_chunks:
            scores = [c.get("similarity_score", 0.0) for c in accepted_chunks]
            max_score = max(scores) if scores else 0.0
            
            top_5_refs = accepted_chunks[:5]
            unique_docs = set(str(c.get("document_id", "")) for c in top_5_refs if c.get("document_id"))
            diversity_bonus = min(0.15, max(0, len(unique_docs) - 1) * 0.05)
            
            supporting_chunks = sum(1 for s in scores[1:5] if s >= 0.50)
            depth_bonus = min(0.10, supporting_chunks * 0.02)
            
            composite_score = min(1.0, max(0.0, max_score + diversity_bonus + depth_bonus))
            
            if composite_score >= 0.70:
                confidence = "HIGH"
            elif composite_score >= 0.50:
                confidence = "MEDIUM"
                
    # 4. Run Evaluation Metrics
    if mode != "fast":
        faithfulness, relevancy, groundedness = await evaluate_faithfulness_and_relevancy(question, answer, context_str)
    
    precision, recall = calculate_retrieval_metrics(expected_citations, retrieved_docs, k=10)
    chunk_precision, chunk_recall = calculate_chunk_retrieval_metrics(expected_chunk_uuids, retrieved_chunk_uuids, k=10)
    citation_accuracy = calculate_citation_accuracy(expected_citations, answer) if mode != "fast" else 0.0
    hallucination_rate = calculate_hallucination_rate(groundedness)
    
    # 5. Get Pre-Rerank Chunks (Observe only, do not modify prod)
    # We execute the semantic search manually to peek at what the DB returns before reranking
    pre_rerank_chunk_ids = []
    try:
        from sqlalchemy import select
        from app.db.models.document import DocumentChunk, Document, Embedding
        query_vector = await retrieval_service.embedding_provider.get_embedding(question)
        distance_col = Embedding.embedding.cosine_distance(query_vector)
        stmt = (
            select(DocumentChunk.chunk_uuid)
            .join(Embedding, Embedding.chunk_id == DocumentChunk.id)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.workspace_id == workspace_id)
            .where(distance_col < 0.65)
            .order_by(distance_col).limit(50)
        )
        res = await db.execute(stmt)
        pre_rerank_chunk_ids = [str(r[0]) for r in res.all()]
    except Exception as e:
        print(f"Failed to peek pre-rerank chunks: {e}")
        
    retrieved_pages = list(set([chunk.get("page_number") for chunk in accepted_chunks if chunk.get("page_number")]))
    expected_pages = test_case.get("relevant_pages", [])
    
    return {
        "question_id": test_case["id"],
        "question": question,
        "expected_answer": test_case.get("expected_answer", ""),
        "generated_answer": answer,
        "expected_documents": expected_citations,
        "retrieved_documents": retrieved_docs,
        "expected_chunk_ids": expected_chunk_uuids,
        "retrieved_chunk_ids": retrieved_chunk_uuids,
        "expected_pages": expected_pages,
        "retrieved_pages": retrieved_pages,
        "latency_ms": total_latency * 1000.0,
        "retrieval_recall": chunk_recall,
        "retrieval_precision": chunk_precision,
        "groundedness": groundedness,
        "faithfulness": faithfulness,
        "hallucination_score": hallucination_rate,
        "citation_accuracy": citation_accuracy,
        "pre_rerank_chunk_ids": pre_rerank_chunk_ids
    }
