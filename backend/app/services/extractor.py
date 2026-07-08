import io
import re
from typing import Dict, Any, Protocol, List
from app.services.cleaner import DocumentCleaner

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
    def extract_unified(self, file_bytes: bytes) -> Dict[str, Any]:
        """Extracts the entire document as a single string and builds a metadata map."""
        ...


class PDFExtractor:
    def extract_unified(self, file_bytes: bytes) -> Dict[str, Any]:
        if not fitz:
            raise ImportError("PyMuPDF (fitz) is not installed.")
            
        full_text = []
        page_map = []
        current_offset = 0
        
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
                
                # Clean page text using DocumentCleaner
                text = DocumentCleaner.clean(text)
                if not text.strip():
                    continue

                # Add double newlines between pages to keep paragraph structures separated
                text = text + "\n\n"
                text_len = len(text)
                full_text.append(text)
                
                page_map.append({
                    "start_offset": current_offset,
                    "end_offset": current_offset + text_len,
                    "page_number": page_idx + 1,
                    "section_title": section_title
                })
                
                current_offset += text_len
                
        return {
            "text": "".join(full_text),
            "page_map": page_map
        }


class DOCXExtractor:
    def extract_unified(self, file_bytes: bytes) -> Dict[str, Any]:
        if not docx:
            raise ImportError("python-docx (docx) is not installed.")
            
        stream = io.BytesIO(file_bytes)
        doc = docx.Document(stream)
        
        full_text = []
        page_map = []
        current_offset = 0
        
        current_section = None
        paragraphs = []
        page_num = 1
        
        # Group paragraphs into arbitrary logical boundaries to build the page map
        for p in doc.paragraphs:
            if not p.text.strip():
                continue
            if p.style and p.style.name.startswith("Heading"):
                current_section = p.text.strip()
                
            paragraphs.append(p.text)
            if len(paragraphs) >= 15:
                segment_text = "\n\n".join(paragraphs) + "\n\n"
                segment_text = DocumentCleaner.clean(segment_text)
                if segment_text:
                    segment_text += "\n\n"
                    text_len = len(segment_text)
                    full_text.append(segment_text)
                    
                    page_map.append({
                        "start_offset": current_offset,
                        "end_offset": current_offset + text_len,
                        "page_number": page_num,
                        "section_title": current_section
                    })
                    current_offset += text_len
                paragraphs = []
                page_num += 1
                
        if paragraphs:
            segment_text = "\n\n".join(paragraphs) + "\n\n"
            segment_text = DocumentCleaner.clean(segment_text)
            if segment_text:
                segment_text += "\n\n"
                text_len = len(segment_text)
                full_text.append(segment_text)
                
                page_map.append({
                    "start_offset": current_offset,
                    "end_offset": current_offset + text_len,
                    "page_number": page_num,
                    "section_title": current_section
                })
            
        return {
            "text": "".join(full_text),
            "page_map": page_map
        }


class TXTExtractor:
    def extract_unified(self, file_bytes: bytes) -> Dict[str, Any]:
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1")
            
        cleaned_text = DocumentCleaner.clean(raw_text)
        return {
            "text": cleaned_text,
            "page_map": [{
                "start_offset": 0,
                "end_offset": len(cleaned_text),
                "page_number": 1,
                "section_title": None
            }]
        }


class MarkdownExtractor:
    def extract_unified(self, file_bytes: bytes) -> Dict[str, Any]:
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1")
            
        lines = raw_text.splitlines()
        current_section = None
        current_content = []
        
        full_text = []
        page_map = []
        current_offset = 0
        
        for line in lines:
            match = re.match(r'^(#+)\s+(.*)$', line)
            if match:
                if current_content and any(c.strip() for c in current_content):
                    segment_text = "\n".join(current_content) + "\n"
                    segment_text = DocumentCleaner.clean(segment_text)
                    if segment_text:
                        segment_text += "\n\n"
                        text_len = len(segment_text)
                        full_text.append(segment_text)
                        page_map.append({
                            "start_offset": current_offset,
                            "end_offset": current_offset + text_len,
                            "page_number": 1,
                            "section_title": current_section
                        })
                        current_offset += text_len
                    
                current_section = match.group(2).strip()
                current_content = [line]
            else:
                current_content.append(line)
                
        if current_content and any(c.strip() for c in current_content):
            segment_text = "\n".join(current_content) + "\n"
            segment_text = DocumentCleaner.clean(segment_text)
            if segment_text:
                segment_text += "\n\n"
                text_len = len(segment_text)
                full_text.append(segment_text)
                page_map.append({
                    "start_offset": current_offset,
                    "end_offset": current_offset + text_len,
                    "page_number": 1,
                    "section_title": current_section
                })
            
        return {
            "text": "".join(full_text),
            "page_map": page_map
        }


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
