from typing import List, Dict, Any


class ChunkingService:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", " ", ""]

    def split_text(self, text: str) -> List[str]:
        """Split a document's plain text into overlapping chunks using a recursive splitter."""
        if not text:
            return []
        
        return self._recursive_split(text, self.separators)

    def split_text_with_offsets(self, text: str) -> List[Dict[str, Any]]:
        """Split document's text and calculate character offsets (start_offset, end_offset)."""
        chunks = self.split_text(text)
        results = []
        search_start = 0
        for chunk in chunks:
            # Locate chunk starting from search_start index
            idx = text.find(chunk, search_start)
            if idx == -1:
                # Fallback to general lookup
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

    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        """Split the text recursively using the provided separators."""
        # Find the first separator that actually splits the text or fallback to character level
        if not separators:
            # character-level fallback
            return self._slice_by_chars(text)
        
        separator = separators[0]
        next_separators = separators[1:]
        
        # Split text by separator
        if separator == "":
            splits = list(text)
        else:
            splits = text.split(separator)
            
        # Reconstruct splits keeping track of separator placements
        splits_with_seps = []
        for i, split in enumerate(splits):
            if i > 0 and separator != "":
                splits_with_seps.append(separator + split)
            else:
                splits_with_seps.append(split)
                
        # Now process each split. If a split is too large, recursively split it.
        final_splits = []
        for split in splits_with_seps:
            if len(split) <= self.chunk_size:
                final_splits.append(split)
            else:
                # Split recursively
                sub_splits = self._recursive_split(split, next_separators)
                final_splits.extend(sub_splits)
                
        # Merge splits into chunks under chunk_size with chunk_overlap
        return self._merge_splits(final_splits)

    def _slice_by_chars(self, text: str) -> List[str]:
        """Slice text by character chunks directly if we run out of separators."""
        chunks = []
        start = 0
        while start < len(text):
            chunks.append(text[start : start + self.chunk_size])
            start += self.chunk_size - self.chunk_overlap
            if start >= len(text) or self.chunk_size <= self.chunk_overlap:
                break
        return chunks

    def _merge_splits(self, splits: List[str]) -> List[str]:
        """Merge short split pieces into larger chunks up to chunk_size, keeping chunk_overlap."""
        chunks = []
        current_doc = []
        current_len = 0
        
        for split in splits:
            split_len = len(split)
            
            # If a single split exceeds chunk_size, we just have to output it
            if split_len > self.chunk_size:
                # If we have something in current_doc, flush it first
                if current_doc:
                    chunks.append("".join(current_doc))
                    current_doc = []
                    current_len = 0
                chunks.append(split)
                continue
                
            # If adding this split exceeds chunk_size, flush the current chunk
            if current_len + split_len > self.chunk_size:
                chunks.append("".join(current_doc))
                
                # Backtrack to satisfy overlap
                overlap_doc = []
                overlap_len = 0
                # Scan backwards in current_doc to build overlap context
                for doc_piece in reversed(current_doc):
                    if overlap_len + len(doc_piece) <= self.chunk_overlap:
                        overlap_doc.insert(0, doc_piece)
                        overlap_len += len(doc_piece)
                    else:
                        break
                current_doc = overlap_doc
                current_len = overlap_len
                
            current_doc.append(split)
            current_len += split_len
            
        if current_doc:
            chunks.append("".join(current_doc))
            
        # Strip outer whitespaces from final chunks to make them clean
        return [chunk.strip() for chunk in chunks if chunk.strip()]


# Factory method for default config
def get_chunking_service() -> ChunkingService:
    return ChunkingService(chunk_size=1000, chunk_overlap=200)
