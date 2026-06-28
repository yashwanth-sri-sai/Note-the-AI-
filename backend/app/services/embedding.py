import os
import httpx
import hashlib
import numpy as np
from typing import List, Protocol, Optional
from app.core.retries import retry_with_backoff


class EmbeddingProvider(Protocol):
    async def get_embedding(self, text: str) -> List[float]:
        """Generate a vector representation of a single text segment."""
        ...

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector representations of a batch of text segments."""
        ...


class GeminiEmbeddingProvider:
    def __init__(self, api_key: Optional[str] = None):
        from app.core.config import settings
        self.api_key = api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
        self.url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:embedContent"

    async def get_embedding(self, text: str) -> List[float]:
        results = await self.get_embeddings([text])
        return results[0]

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")
        
        headers = {"Content-Type": "application/json"}
        params = {"key": self.api_key}
        
        # Build batch requests
        embedded_vectors = []
        
        async def _make_call(text_str: str) -> List[float]:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "content": {"parts": [{"text": text_str}]}
                }
                response = await client.post(self.url, headers=headers, params=params, json=payload)
                if response.status_code != 200:
                    raise Exception(f"Gemini API returned error {response.status_code}: {response.text}")
                
                data = response.json()
                return data["embedding"]["values"]

        for text in texts:
            vector = await retry_with_backoff(_make_call, text)
            
            # Zero pad to 1536 dimensions
            if len(vector) < 1536:
                vector = vector + [0.0] * (1536 - len(vector))
            elif len(vector) > 1536:
                vector = vector[:1536]
            embedded_vectors.append(vector)
                
        return embedded_vectors


class OpenAIEmbeddingProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        self.url = "https://api.openai.com/v1/embeddings"

    async def get_embedding(self, text: str) -> List[float]:
        results = await self.get_embeddings([text])
        return results[0]

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "input": texts,
            "model": self.model
        }
        
        async def _make_call() -> dict:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.url, headers=headers, json=payload)
                if response.status_code != 200:
                    raise Exception(f"OpenAI API returned error {response.status_code}: {response.text}")
                return response.json()
            
        data = await retry_with_backoff(_make_call)
        # Sort by index to preserve order
        results = sorted(data["data"], key=lambda x: x["index"])
        
        vectors = []
        for r in results:
            vector = r["embedding"]
            if len(vector) < 1536:
                vector = vector + [0.0] * (1536 - len(vector))
            elif len(vector) > 1536:
                vector = vector[:1536]
            vectors.append(vector)
        return vectors


class LocalEmbeddingProvider:
    """Fallback local pseudo-semantic embedding generator using a deterministic random projection of n-gram counts."""
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    async def get_embedding(self, text: str) -> List[float]:
        return self._generate_vector(text)

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]

    def _generate_vector(self, text: str) -> List[float]:
        """Generate a deterministic 1536-dimensional vector based on character frequencies."""
        # Simple character 3-gram counts
        trigrams = {}
        for i in range(len(text) - 2):
            tg = text[i : i + 3].lower()
            trigrams[tg] = trigrams.get(tg, 0) + 1
            
        # Create embedding vector by hashing trigrams to coordinate indexes with weight
        vector = np.zeros(self.dimension)
        for tg, count in trigrams.items():
            # Seed pseudo-random generator with the hash of the trigram
            h = int(hashlib.md5(tg.encode("utf-8")).hexdigest(), 16)
            
            # Project onto multiple dimensions
            for step in range(3):
                idx = (h + step * 997) % self.dimension
                # Add sign weight
                sign = 1 if ((h >> step) % 2 == 0) else -1
                vector[idx] += count * sign
                
        # Normalization to unit length
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
            
        return vector.tolist()


def get_embedding_provider() -> EmbeddingProvider:
    """Factory helper to load active provider based on environment variables."""
    from app.core.config import settings
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    if openai_key:
        return OpenAIEmbeddingProvider(openai_key)
    elif gemini_key:
        return GeminiEmbeddingProvider(gemini_key)
    else:
        # Default fallback
        return LocalEmbeddingProvider()
