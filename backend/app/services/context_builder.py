import hashlib
from typing import List, Dict, Any, Tuple
from app.services.token_estimator import TokenService
from app.core.config import settings

class ContextBuilder:
    def __init__(self, token_limit: int = None):
        self.token_limit = token_limit or settings.DEFAULT_CONTEXT_TOKEN_LIMIT

    def build_context(self, chunks: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
        """Sort by relevance, cap within the token budget, and format the context strings.
        
        Returns:
            Tuple[context_str, accepted_chunks]
        """
        # Phase 4 Null & Type Safety Guard
        if chunks is None:
            chunks = []
        chunks = [c for c in chunks if isinstance(c, dict) and c is not None]

        # 1. Sort by similarity score descending (just in case they are not pre-sorted)
        sorted_chunks = sorted(
            chunks,
            key=lambda x: x.get("similarity_score", 0.0) or 0.0,
            reverse=True
        )

        # 2. Assemble up to the token limit
        current_token_count = 0
        accepted_chunks = []
        context_parts = []

        for i, chunk in enumerate(sorted_chunks):
            chunk_text = chunk.get("chunk_text", "")
            chunk_tokens = chunk.get("token_count") or TokenService.estimate_tokens(chunk_text)
            
            # Check if this chunk fits in our budget
            if current_token_count + chunk_tokens > self.token_limit:
                # If budget is full, don't include this chunk
                if not accepted_chunks:
                    # In case the single first chunk is extremely large, truncate it to fit
                    truncated_len = self.token_limit * 4
                    chunk_text = chunk_text[:truncated_len]
                    chunk["chunk_text"] = chunk_text
                    chunk["token_count"] = self.token_limit
                    accepted_chunks.append(chunk)
                    
                    doc_info = f"[Document: {chunk.get('document_name')}]"
                    if chunk.get("page_number"):
                        doc_info += f"\n[Page: {chunk.get('page_number')}]"
                    if chunk.get("section_title"):
                        doc_info += f"\n[Section: {chunk.get('section_title')}]"
                    
                    context_parts.append(f"{doc_info}\nContent: {chunk_text}\n")
                break
                
            current_token_count += chunk_tokens
            accepted_chunks.append(chunk)
            
            doc_info = f"[Document: {chunk.get('document_name')}]"
            if chunk.get("page_number"):
                doc_info += f"\n[Page: {chunk.get('page_number')}]"
            if chunk.get("section_title"):
                doc_info += f"\n[Section: {chunk.get('section_title')}]"
            
            context_parts.append(f"{doc_info}\nContent: {chunk_text}\n")

        # 4. Join parts
        context_str = "\n".join(context_parts)
        return context_str, accepted_chunks
