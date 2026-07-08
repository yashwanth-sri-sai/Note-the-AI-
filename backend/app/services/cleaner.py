import re
import unicodedata
from typing import List

class DocumentCleaner:
    @staticmethod
    def normalize_unicode(text: str) -> str:
        """Normalize Unicode characters, replace smart quotes and dashes."""
        if not text:
            return ""
        # Normalize NFKC
        text = unicodedata.normalize("NFKC", text)
        # Smart quotes
        text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
        # Smart dashes
        text = text.replace("—", " - ").replace("–", " - ")
        return text

    @staticmethod
    def remove_page_numbers_and_headers(text: str) -> str:
        """Strip running page numbers, headers, and footers from page text."""
        lines = text.splitlines()
        if not lines:
            return ""

        cleaned_lines = []
        for line in lines:
            trimmed = line.strip()
            # Skip empty lines
            if not trimmed:
                continue
            # Match standalone page numbers: "Page 5", "5 of 12", "pg. 12", "[12]", "- 12 -"
            if re.match(r'(?i)^(?:page|pg\.?|part)?\s*\d+\s*(?:of\s*\d+)?$', trimmed):
                continue
            if re.match(r'^[-–—\s]*\d+[-–—\s]*$', trimmed):
                continue
            # Header line filters (skip lines containing just URL, email or date patterns)
            if re.match(r'(?i)^(?:https?://\S+|www\.\S+|\S+@\S+\.\S+|(?:\d{1,2}[-/.]){2}\d{2,4})$', trimmed):
                continue
            
            cleaned_lines.append(line)
        
        return "\n".join(cleaned_lines)

    @staticmethod
    def remove_broken_ocr(text: str) -> str:
        """Filter out corrupted OCR character streams and strange control characters."""
        # Remove control characters except tab and newline
        text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\xff]', '', text)
        # Remove typical broken PDF/OCR sequences like "â€¢", "ï¿½", etc.
        text = re.sub(r'(?:â€¢|ï¿½)', '', text)
        # Remove consecutive punctuation marks of different types like "??!!--"
        text = re.sub(r'([!?.,;:])\1+', r'\1', text)
        return text

    @staticmethod
    def clean_whitespaces(text: str) -> str:
        """Normalize line breaks, multiple spaces, and sentence spacing."""
        # Convert multiple vertical spaces to single newline, first removing spaces on empty lines
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        
        # Merge hyphenated words at the end of a line
        text = re.sub(r'(\w+)-\n\s*(\w+)', r'\1\2', text)
        
        # Replace single newlines inside sentences with spaces, but keep paragraph double newlines
        paragraphs = re.split(r'\n\s*\n', text)
        clean_paras = []
        for para in paragraphs:
            para_lines = [l.strip() for l in para.splitlines() if l.strip()]
            if not para_lines:
                continue
            # Join line wraps
            joined = " ".join(para_lines)
            # Remove multiple spaces
            joined = re.sub(r'\s+', ' ', joined)
            clean_paras.append(joined)
            
        text = "\n\n".join(clean_paras)
        return text.strip()

    @staticmethod
    def repair_unmatched_brackets(text: str) -> str:
        """Remove or balance unmatched brackets to avoid malformed questions or content."""
        # Bracket pairs to validate
        pairs = [('[', ']'), ('(', ')'), ('{', '}')]
        for open_char, close_char in pairs:
            # Quick check if there is an unmatched count
            open_count = text.count(open_char)
            close_count = text.count(close_char)
            if open_count != close_count:
                # To be safe, strip out bracket characters if unmatched to avoid raw brackets in generation
                text = text.replace(open_char, "").replace(close_char, "")
        return text

    @classmethod
    def clean(cls, text: str) -> str:
        """Run the full unified document cleaning pipeline on a raw text block."""
        if not text:
            return ""
        
        text = cls.remove_broken_ocr(text)
        text = cls.normalize_unicode(text)
        text = cls.remove_page_numbers_and_headers(text)
        text = cls.clean_whitespaces(text)
        text = cls.repair_unmatched_brackets(text)
        
        # Post-clean: deduplicate empty lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()
