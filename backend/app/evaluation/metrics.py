import os
import json
import httpx
from typing import List, Dict, Any, Tuple
from app.core.config import settings
from app.core.retries import retry_with_backoff

async def evaluate_faithfulness_and_relevancy(question: str, answer: str, context: str) -> Tuple[float, float]:
    """Uses Gemini as an LLM-as-a-Judge to evaluate RAG generation quality."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return 0.0, 0.0

    prompt = f"""
You are an expert evaluator for a Retrieval-Augmented Generation (RAG) system.
Given a question, the context provided to the system, and the generated answer, evaluate three metrics on a scale of 0.0 to 1.0.

1. Faithfulness: Does the answer strictly rely on the provided context without hallucinating outside information? (1.0 = perfect adherence, 0.0 = completely hallucinated).
2. Answer Relevancy: Does the answer directly address the user's question? (1.0 = highly relevant, 0.0 = completely irrelevant).
3. Groundedness: Is every single claim made in the answer explicitly supported by an entailment in the context? (1.0 = fully grounded, 0.0 = ungrounded).

Provide your evaluation strictly as a JSON object with three keys: "faithfulness", "relevancy", and "groundedness". Do not include any markdown formatting.

Question: {question}
Context: {context}
Answer: {answer}
"""
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.0}
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await retry_with_backoff(
                client.post,
                url,
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            
            text_response = data["candidates"][0]["content"]["parts"][0]["text"]
            text_response = text_response.strip().replace("```json", "").replace("```", "")
            
            result = json.loads(text_response)
            
            faith = float(result.get("faithfulness", 0.0))
            rel = float(result.get("relevancy", 0.0))
            ground = float(result.get("groundedness", 0.0))
            
            return faith, rel, ground
    except Exception as e:
        print(f"Failed to evaluate metrics via LLM: {e}")
        return 0.0, 0.0, 0.0


def calculate_retrieval_metrics(expected_citations: List[str], retrieved_docs: List[str], k: int = 10) -> Tuple[float, float]:
    """Calculates classic Information Retrieval metrics (Precision@K and Recall@K)."""
    if not expected_citations:
        return 1.0, 1.0 # If no citations expected, perfect scores if we retrieve nothing? No, let's just return 1.0
        
    top_k_docs = retrieved_docs[:k]
    
    # Precision: How many of the retrieved docs were expected?
    relevant_retrieved = sum(1 for doc in top_k_docs if doc in expected_citations)
    precision = relevant_retrieved / k if k > 0 else 0.0
    
    # Recall: How many of the expected docs were retrieved?
    recall = relevant_retrieved / len(expected_citations) if len(expected_citations) > 0 else 0.0
    
    return precision, recall

def calculate_chunk_retrieval_metrics(expected_chunk_uuids: List[str], retrieved_chunk_uuids: List[str], k: int = 10) -> Tuple[float, float]:
    """Calculates granular Information Retrieval metrics (Precision@K and Recall@K) based on exact chunk IDs."""
    if not expected_chunk_uuids:
        # If no chunks expected (e.g. Adversarial test), we want recall 1.0 and precision 1.0 if we fetched nothing
        return 1.0, 1.0
        
    top_k_chunks = retrieved_chunk_uuids[:k]
    
    # Precision: How many of the retrieved chunks were expected?
    relevant_retrieved = sum(1 for chunk_id in top_k_chunks if str(chunk_id) in expected_chunk_uuids)
    precision = relevant_retrieved / len(top_k_chunks) if len(top_k_chunks) > 0 else 0.0
    
    # Recall: How many of the expected chunks were retrieved?
    recall = relevant_retrieved / len(expected_chunk_uuids) if len(expected_chunk_uuids) > 0 else 0.0
    
    return precision, recall

def calculate_citation_accuracy(expected_citations: List[str], generated_answer: str) -> float:
    """A naive check if the expected citations are mentioned in the answer."""
    if not expected_citations:
        return 1.0
        
    found = sum(1 for citation in expected_citations if citation.lower() in generated_answer.lower())
    return found / len(expected_citations)

def calculate_hallucination_rate(groundedness: float) -> float:
    """Inverse of groundedness."""
    return max(0.0, 1.0 - groundedness)
