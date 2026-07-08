import re
from typing import List, Dict, Any

class ChunkingService:
    def __init__(self, chunk_size: int = 2000, chunk_overlap: int = 400):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.trailing_words_to_avoid = {
            "and", "or", "because", "which", "that", "the", "a", "an", 
            "but", "of", "to", "in", "with", "for", "as", "by", "on"
        }

    def split_text(self, text: str) -> List[str]:
        """
        Split a document's plain text into overlapping chunks using an educational concept-preserving strategy.
        Splits only at paragraph or sentence boundaries, never splitting mid-sentence or mid-list-item.
        """
        if not text or not text.strip():
            return []

        # Step 1: Split into paragraphs/blocks
        raw_paragraphs = re.split(r'\n\s*\n', text)
        atoms: List[str] = []

        for para in raw_paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # If paragraph fits within chunk_size, keep it whole
            if len(para) <= self.chunk_size:
                atoms.append(para)
            else:
                # Split paragraph into sentences, keeping list structures if present
                lines = para.split('\n')
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # If it's a list item or heading, treat as an atomic block
                    if line.startswith(("-", "*", "#")) or re.match(r'^\d+\.', line):
                        atoms.append(line)
                    else:
                        # Split standard text line into sentences
                        sentences = re.split(r'(?<=[.!?])\s+', line)
                        for sent in sentences:
                            sent = sent.strip()
                            if sent:
                                atoms.append(sent)

        # Step 2: Merge atoms into overlapping chunks
        chunks: List[str] = []
        current_chunk_parts: List[str] = []
        current_len = 0

        for atom in atoms:
            atom_len = len(atom)
            if atom_len > self.chunk_size:
                # If a single atom is larger than chunk_size, force split it
                if current_chunk_parts:
                    chunks.append("\n\n".join(current_chunk_parts))
                    current_chunk_parts = []
                    current_len = 0
                chunks.append(atom)
                continue

            if current_len + atom_len + (2 if current_chunk_parts else 0) > self.chunk_size:
                # Flush current chunk
                chunks.append("\n\n".join(current_chunk_parts))
                
                # Backtrack to satisfy overlap
                overlap_parts = []
                overlap_len = 0
                for part in reversed(current_chunk_parts):
                    if overlap_len + len(part) + (2 if overlap_parts else 0) <= self.chunk_overlap:
                        overlap_parts.insert(0, part)
                        overlap_len += len(part) + (2 if len(overlap_parts) > 1 else 0)
                    else:
                        break
                current_chunk_parts = overlap_parts
                current_len = overlap_len

            current_chunk_parts.append(atom)
            current_len += atom_len + (2 if len(current_chunk_parts) > 1 else 0)

        if current_chunk_parts:
            chunks.append("\n\n".join(current_chunk_parts))

        # Step 3: Post-process chunks to strip trailing prepositions/conjunctions and clean formatting
        cleaned_chunks: List[str] = []
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            
            # Avoid chunks ending with trailing conjunctions/prepositions
            chunk = self._trim_trailing_conjunctions(chunk)
            if chunk:
                cleaned_chunks.append(chunk)

        return cleaned_chunks

    def _trim_trailing_conjunctions(self, chunk: str) -> str:
        """Trim incomplete sentence endings or trailing conjunctions/prepositions."""
        while True:
            # Find last word in chunk (ignoring trailing punctuation)
            match = re.search(r'\b(\w+)\b\s*[.,?!:;]*\s*$', chunk)
            if not match:
                break
            
            last_word = match.group(1).lower()
            if last_word in self.trailing_words_to_avoid:
                # Strip the trailing word and everything after it
                idx = match.start(1)
                chunk = chunk[:idx].strip()
            else:
                break
        
        # Ensure we didn't empty the chunk entirely
        return chunk.strip()

    def split_text_with_offsets(self, text: str) -> List[Dict[str, Any]]:
        """Split document's text and calculate character offsets (start_offset, end_offset)."""
        chunks = self.split_text(text)
        results = []
        search_start = 0
        for chunk in chunks:
            idx = text.find(chunk, search_start)
            if idx == -1:
                idx = text.find(chunk)
            
            if idx != -1:
                start = idx
                end = idx + len(chunk)
                search_start = end
            else:
                start = 0
                end = len(chunk)
                
            results.append({
                "text": chunk,
                "start_offset": start,
                "end_offset": end
            })
        return results

def get_chunking_service() -> ChunkingService:
    return ChunkingService(chunk_size=2000, chunk_overlap=400)
