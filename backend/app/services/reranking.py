from typing import List, Dict, Any, Protocol


class RerankerProvider(Protocol):
    async def rerank(self, query: str, candidates: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
        """Rerank retrieval candidates and return the top_n results."""
        ...


class ScoreBasedReranker:
    """Fallback reranker that sorts candidates by vector similarity score."""
    async def rerank(self, query: str, candidates: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
        # Sort by similarity score descending (or distance ascending)
        sorted_candidates = sorted(candidates, key=lambda x: x.get("similarity_score", 0.0), reverse=True)
        return sorted_candidates[:top_n]


def get_reranker_provider() -> RerankerProvider:
    """Factory resolver returning active reranker provider."""
    # Cohere / Cross-Encoder integration can be configured here in the future
    return ScoreBasedReranker()
