import uuid
import time
import httpx
from typing import Dict, Any
from app.db.session import async_session_maker
from app.services.retrieval import RetrievalService
from app.services.context_builder import ContextBuilder
from app.services.rag_generation import RAGService
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
    
    async with async_session_maker() as db:
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
            rag_service = RAGService(db)
            sys_prompt = rag_service._build_system_prompt()
            
            # Manually invoke LLM to avoid saving to chat history DB
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{rag_service.settings.GEMINI_MODEL}:generateContent?key={rag_service.settings.GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            prompt = sys_prompt + f"\n\nContext:\n{context_str}\n\nQuestion: {question}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            
            llm_start = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    time_to_first_token = time.perf_counter() - llm_start
                    response.raise_for_status()
                    data = response.json()
                    answer = data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                answer = f"Error during generation: {str(e)}"
                
        total_latency = time.perf_counter() - start_time
        
        # Compute RAG Confidence (same logic as rag_generation.py)
        confidence = "LOW"
        top_chunks = accepted_chunks[:3]
        if top_chunks:
            avg_score = sum(c.get("similarity_score", 0.0) for c in top_chunks) / len(top_chunks)
            if avg_score >= 0.70:
                confidence = "HIGH"
            elif avg_score >= 0.50:
                confidence = "MEDIUM"
                
    # 4. Run Evaluation Metrics
    if mode != "fast":
        faithfulness, relevancy, groundedness = await evaluate_faithfulness_and_relevancy(question, answer, context_str)
    
    precision, recall = calculate_retrieval_metrics(expected_citations, retrieved_docs, k=10)
    chunk_precision, chunk_recall = calculate_chunk_retrieval_metrics(expected_chunk_uuids, retrieved_chunk_uuids, k=10)
    citation_accuracy = calculate_citation_accuracy(expected_citations, answer) if mode != "fast" else 0.0
    hallucination_rate = calculate_hallucination_rate(groundedness)
    
    return {
        "id": test_case["id"],
        "question": question,
        "answer": answer,
        "confidence": confidence,
        "latency": total_latency,
        "time_to_first_token": time_to_first_token,
        "retrieval_latency": retrieval_latency,
        "retrieved_docs": retrieved_docs,
        "metrics": {
            "precision_at_k": precision,
            "recall_at_k": recall,
            "chunk_precision_at_k": chunk_precision,
            "chunk_recall_at_k": chunk_recall,
            "faithfulness": faithfulness,
            "answer_relevancy": relevancy,
            "groundedness": groundedness,
            "hallucination_rate": hallucination_rate,
            "citation_accuracy": citation_accuracy
        }
    }
