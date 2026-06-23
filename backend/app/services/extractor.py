import io
import re
from typing import Generator, Dict, Any, Protocol

# Conditional imports for PyMuPDF and python-docx
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import docx  # python-docx
except ImportError:
    docx = None


class DocumentExtractor(Protocol):
    def extract_segments(self, file_bytes: bytes) -> Generator[Dict[str, Any], None, None]:
        """Extract segments of text page-by-page to avoid memory bloat, yielding metadata."""
        ...


class PDFExtractor:
    def extract_segments(self, file_bytes: bytes) -> Generator[Dict[str, Any], None, None]:
        if not fitz:
            raise ImportError("PyMuPDF (fitz) is not installed.")
            
        # Open PDF from memory stream
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page_idx, page in enumerate(doc):
                text = page.get_text()
                if not text.strip():
                    continue
                
                # Guess section title by scanning lines on this page
                section_title = None
                for line in text.splitlines():
                    line_clean = line.strip()
                    if 3 < len(line_clean) < 65 and (
                        line_clean.isupper() or 
                        line_clean.startswith(("Section", "Chapter", "Introduction", "Abstract", "Conclusion", "1", "2", "3", "4", "5"))
                    ):
                        section_title = line_clean
                        break
                
                yield {
                    "text": text,
                    "page_number": page_idx + 1,
                    "section_title": section_title
                }


class DOCXExtractor:
    def extract_segments(self, file_bytes: bytes) -> Generator[Dict[str, Any], None, None]:
        if not docx:
            raise ImportError("python-docx (docx) is not installed.")
            
        stream = io.BytesIO(file_bytes)
        doc = docx.Document(stream)
        
        current_section = None
        paragraphs = []
        page_num = 1
        
        # Group paragraphs into chunks representing "pages" (approx. 15 paragraphs per page)
        for p in doc.paragraphs:
            if not p.text.strip():
                continue
            if p.style and p.style.name.startswith("Heading"):
                current_section = p.text.strip()
                
            paragraphs.append(p.text)
            if len(paragraphs) >= 15:
                yield {
                    "text": "\n\n".join(paragraphs),
                    "page_number": page_num,
                    "section_title": current_section
                }
                paragraphs = []
                page_num += 1
                
        if paragraphs:
            yield {
                "text": "\n\n".join(paragraphs),
                "page_number": page_num,
                "section_title": current_section
            }


class TXTExtractor:
    def extract_segments(self, file_bytes: bytes) -> Generator[Dict[str, Any], None, None]:
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1")
            
        # Group raw text into chunks of approx. 3000 chars as estimated "pages"
        chunk_size = 3000
        current_page = 1
        for i in range(0, len(raw_text), chunk_size):
            segment = raw_text[i : i + chunk_size]
            if segment.strip():
                yield {
                    "text": segment,
                    "page_number": current_page,
                    "section_title": None
                }
                current_page += 1


class MarkdownExtractor:
    def extract_segments(self, file_bytes: bytes) -> Generator[Dict[str, Any], None, None]:
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1")
            
        # Clean markdown formatting characters
        cleaned_text = re.sub(r'^#+\s+', '', raw_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', cleaned_text)
        cleaned_text = re.sub(r'[\*_]{1,3}', '', cleaned_text)
        cleaned_text = re.sub(r'```[a-zA-Z]*\n(.*?)\n```', r'\1', cleaned_text, flags=re.DOTALL)
        cleaned_text = re.sub(r'`([^`]+)`', r'\1', cleaned_text)
        cleaned_text = re.sub(r'^[ \t]*[\*\-\+]\s+', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'^[ \t]*\d+\.\s+', '', cleaned_text, flags=re.MULTILINE)

        # Estimate sections by checking raw markdown lines
        lines = raw_text.splitlines()
        sections_map = []
        char_idx = 0
        current_section = None
        for line in lines:
            match = re.match(r'^#+\s+(.*)$', line)
            if match:
                current_section = match.group(1).strip()
            sections_map.append((char_idx, current_section))
            char_idx += len(line) + 1

        # Yield pages based on 3000-character segments
        chunk_size = 3000
        current_page = 1
        for i in range(0, len(cleaned_text), chunk_size):
            segment = cleaned_text[i : i + chunk_size]
            if not segment.strip():
                continue
                
            # Match section title at current character index
            sect = None
            for idx, section_title in sections_map:
                if idx <= i:
                    sect = section_title
                else:
                    break
                    
            yield {
                "text": segment,
                "page_number": current_page,
                "section_title": sect
            }
            current_page += 1


def get_extractor(filename: str, content_type: str = "") -> DocumentExtractor:
    """Factory resolver to retrieve the correct extractor based on filename extension or MIME-type."""
    fn_lower = filename.lower()
    ct_lower = content_type.lower()

    if fn_lower.endswith(".pdf") or "pdf" in ct_lower:
        return PDFExtractor()
    elif fn_lower.endswith(".docx") or "officedocument.wordprocessingml" in ct_lower:
        return DOCXExtractor()
    elif fn_lower.endswith(".md") or "markdown" in ct_lower:
        return MarkdownExtractor()
    elif fn_lower.endswith(".txt") or "text/plain" in ct_lower:
        return TXTExtractor()
    else:
        return TXTExtractor()
