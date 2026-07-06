import os
import httpx
from typing import List, Dict, Any, Protocol


class RerankerProvider(Protocol):
    async def rerank(self, query: str, candidates: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
        """Rerank retrieval candidates and return the top_n results."""
        ...


class ScoreBasedReranker:
    """Fallback reranker that sorts candidates by vector similarity score."""
    async def rerank(self, query: str, candidates: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
        sorted_candidates = sorted(candidates, key=lambda x: x.get("final_score", x.get("similarity_score", 0.0)), reverse=True)
        return sorted_candidates[:top_n]


class CohereReranker:
    """True cross-encoder reranker using Cohere API."""
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.cohere.com/v1/rerank"
        self.model = "rerank-english-v3.0"

    async def rerank(self, query: str, candidates: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
        if not candidates:
            return []

        # Maintain original vector rank for diagnostics, prioritizing final_score
        sorted_by_vector = sorted(candidates, key=lambda x: x.get("final_score", x.get("similarity_score", 0.0)), reverse=True)
        
        from app.core.config import settings
        from app.core.circuit_breaker import reranker_breaker
        from app.core.retries import retry_with_backoff
        import logging
        logger = logging.getLogger("app.services.reranking")

        # Prepare docs for Cohere
        docs = [c.get("chunk_text", "") for c in sorted_by_vector]
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "model": self.model,
            "query": query,
            "documents": docs,
            "top_n": top_n
        }

        async def _make_call():
            async with httpx.AsyncClient(timeout=settings.AI_RERANK_TIMEOUT) as client:
                response = await client.post(self.url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()

        async def _run_rerank():
            data = await retry_with_backoff(_make_call)
            # Process results
            reranked_results = []
            for new_rank, result in enumerate(data.get("results", [])):
                original_idx = result["index"]
                reranker_score = result["relevance_score"]
                chunk = sorted_by_vector[original_idx]
                # Update the similarity score with the reranker's relevance score
                chunk["similarity_score"] = reranker_score
                reranked_results.append(chunk)
            return reranked_results

        def _fallback():
            logger.warning("Cohere Reranker circuit breaker is OPEN. Falling back to vector similarity scores.")
            return sorted_by_vector[:top_n]

        try:
            return await reranker_breaker.execute(_run_rerank, _fallback)
        except Exception as e:
            logger.error(f"Cohere reranker execution failed: {e}. Falling back to vector scores.")
            return sorted_by_vector[:top_n]


def get_reranker_provider() -> RerankerProvider:
    """Factory resolver returning active reranker provider."""
    cohere_key = os.getenv("COHERE_API_KEY")
    if cohere_key:
        return CohereReranker(cohere_key)
    return ScoreBasedReranker()
