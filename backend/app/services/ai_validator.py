import re
from typing import Dict, Any, List, Optional, Tuple

STOP_WORDS = {
    "the", "and", "but", "for", "nor", "yet", "so", "with", "from", "into", "during", "including",
    "until", "against", "among", "throughout", "despite", "towards", "upon", "concerning", "what",
    "which", "who", "whom", "this", "that", "these", "those", "their", "them", "they", "your",
    "some", "many", "such", "than", "then", "their", "would", "could", "should", "will", "shall",
    "are", "was", "were", "been", "have", "has", "had", "does", "doesnt", "dont", "what is", "about"
}

class AIValidator:
    """Validator and quality scoring engine for AI-generated educational content."""
    
    @staticmethod
    def clean_text_field(text: str) -> str:
        """Helper to trim and normalize minor spacing issues."""
        if not text:
            return ""
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    @classmethod
    def validate_flashcard(cls, question: str, answer: str, context: str) -> Tuple[bool, str]:
        """
        Validates flashcard question and answer fields.
        Returns (is_valid, error_reason).
        """
        question = cls.clean_text_field(question)
        answer = cls.clean_text_field(answer)
        
        if not question or not answer:
            return False, "Empty question or answer fields."
            
        if len(question) < 15:
            return False, f"Question too short ({len(question)} chars < 15)."
            
        if len(answer) < 5:
            return False, f"Answer too short ({len(answer)} chars < 5)."
            
        if question.lower() == answer.lower():
            return False, "Question is identical to answer."

        # Unmatched brackets check
        for open_b, close_b in [('[', ']'), ('(', ')'), ('{', '}')]:
            if question.count(open_b) != question.count(close_b):
                return False, "Unmatched brackets in question."
            if answer.count(open_b) != answer.count(close_b):
                return False, "Unmatched brackets in answer."

        # Trailing incomplete sentences / prepositions
        trailing_stop_words = {"and", "or", "the", "because", "which", "that", "a", "an", "with", "of", "to", "but"}
        # Match trailing word ignoring punctuation
        q_match = re.search(r'\b(\w+)\b\s*[.,?!]*$', question)
        if q_match and q_match.group(1).lower() in trailing_stop_words:
            return False, f"Question ends with trailing word '{q_match.group(1)}'."
            
        a_match = re.search(r'\b(\w+)\b\s*[.,?!]*$', answer)
        if a_match and a_match.group(1).lower() in trailing_stop_words:
            return False, f"Answer ends with trailing word '{a_match.group(1)}'."

        # Starts with invalid punctuation
        if re.match(r'^[-–—*#,:;!?.]', question):
            return False, "Question starts with punctuation."
            
        # OCR artifacts and page numbers
        ocr_patterns = [
            r'â€¢', r'ï¿½', r'\[\s*\d+\s*\]', r'(?i)page\s*\d+', r'pg\.\s*\d+'
        ]
        for pattern in ocr_patterns:
            if re.search(pattern, question) or re.search(pattern, answer):
                return False, "Content contains OCR artifacts or page numbers."

        # Repeated words check (e.g. "what what is")
        if re.search(r'\b(\w+)\s+\1\b', question.lower()) or re.search(r'\b(\w+)\s+\1\b', answer.lower()):
            return False, "Content contains consecutive repeated words."

        return True, ""

    @classmethod
    def score_flashcard(cls, question: str, answer: str, context: str) -> float:
        """
        Computes a semantic and educational quality score from 0.0 to 1.0.
        Score checks: completeness, clarity, educational depth, context grounding.
        """
        question = cls.clean_text_field(question)
        answer = cls.clean_text_field(answer)
        
        if not question or not answer:
            return 0.0

        score = 0.0
        max_score = 10.0

        # 1. Question Completeness (has proper question word) (up to 2.0 pts)
        question_lower = question.lower()
        if question_lower.startswith(("what", "how", "why", "explain", "describe", "define", "compare", "contrast", "list", "identify", "which")):
            score += 2.0
        elif "?" in question:
            score += 1.0

        # 2. Context Grounding (up to 3.0 pts)
        # Extract unique content words from question and answer and check overlap with context
        context_lower = context.lower()
        q_words = {w for w in re.findall(r'\b\w{3,15}\b', question_lower) if w not in STOP_WORDS}
        a_words = {w for w in re.findall(r'\b\w{3,15}\b', answer.lower()) if w not in STOP_WORDS}
        
        grounded_q = [w for w in q_words if w in context_lower]
        grounded_a = [w for w in a_words if w in context_lower]
        
        q_overlap = len(grounded_q) / len(q_words) if q_words else 0.0
        a_overlap = len(grounded_a) / len(a_words) if a_words else 0.0
        
        # We need the answer to be highly grounded in the context
        score += a_overlap * 2.0
        score += q_overlap * 1.0

        # 3. Educational Depth / Concept indicators (up to 3.0 pts)
        # Check if the Q or A targets key concepts (defined terms, cause-effect, lists, comparisons)
        depth_indicators = [
            r'\b(because|due to|leads to|consequence|result|since|therefore|why)\b', # Cause & effect
            r'\b(differs|compares|versus|vs|contrast|similar|opposite|difference)\b', # Comparison
            r'\b(defined as|refers to|means|stands for|is a type of|what is|what are|define|function of|role of)\b', # Definition
            r'\b(first|second|third|steps|list|elements|phases|components|features)\b' # Structure/Lists
        ]
        
        matches = 0
        for pattern in depth_indicators:
            if re.search(pattern, question_lower) or re.search(pattern, answer.lower()):
                matches += 1
        
        score += min(3.0, matches * 1.0)

        # 4. Length/Clarity optimization (up to 2.0 pts)
        # Question: 6-25 words, Answer: 10-60 words is ideal
        q_word_len = len(question.split())
        a_word_len = len(answer.split())
        
        if 6 <= q_word_len <= 25:
            score += 1.0
        elif 4 <= q_word_len <= 35:
            score += 0.5
            
        if 8 <= a_word_len <= 60:
            score += 1.0
        elif 5 <= a_word_len <= 100:
            score += 0.5

        return score / max_score

    @classmethod
    def validate_quiz_question(cls, question_text: str, choices: List[str], correct_answer: str, explanation: str) -> Tuple[bool, str]:
        """
        Validates multiple-choice quiz question elements.
        """
        question_text = cls.clean_text_field(question_text)
        correct_answer = cls.clean_text_field(correct_answer)
        explanation = cls.clean_text_field(explanation)

        if not question_text:
            return False, "Empty quiz question text."
            
        if len(question_text) < 15:
            return False, "Quiz question text too short (< 15 chars)."

        if not choices or len(choices) != 4:
            return False, f"Quiz question must have exactly 4 choices (has {len(choices) if choices else 0})."

        cleaned_choices = [cls.clean_text_field(c) for c in choices]
        if any(not c for c in cleaned_choices):
            return False, "Quiz choice cannot be empty."

        # Choices must be unique
        if len(set(cleaned_choices)) != 4:
            return False, "Quiz choices must be unique."

        # Correct answer must match one of the choices exactly
        if correct_answer not in cleaned_choices:
            return False, f"Correct answer '{correct_answer}' must match one of the choices: {cleaned_choices}."

        if not explanation:
            return False, "Empty quiz explanation."

        return True, ""

    @classmethod
    def auto_repair_flashcard(cls, question: str, answer: str) -> Tuple[str, str]:
        """
        Performs minor repairs on typical generation issues like stripping extra 
        whitespace, repairing punctuation, or fixing basic capitalization.
        """
        # Basic cleanup
        q = cls.clean_text_field(question)
        a = cls.clean_text_field(answer)
        
        # Ensure question capitalized
        if q and q[0].islower():
            q = q[0].upper() + q[1:]
            
        # Ensure answer capitalized
        if a and a[0].islower():
            a = a[0].upper() + a[1:]

        # Ensure question ends with a question mark
        if q and not q.endswith("?"):
            # Strip trailing period if present
            if q.endswith("."):
                q = q[:-1]
            q = q + "?"

        # Ensure answer ends with period if it ends in a word
        if a and a[-1].isalnum():
            a = a + "."

        return q, a
