import re
import uuid
import logging
from typing import List, Dict, Any, Tuple, Optional
from app.db.models.extensions import Flashcard, QuizQuestion

logger = logging.getLogger("app.services.local_generators")

# Common English stop words
STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for", "with", "about", 
    "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", 
    "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", 
    "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", 
    "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now",
    "is", "was", "were", "are", "been", "have", "has", "had", "having", "do", "does", "did", "doing",
    "this", "that", "these", "those", "their", "its", "them", "they", "which", "who", "whom", "whose"
}

def clean_and_tokenize(text: str) -> List[str]:
    """Extract lowercased alphabetic tokens from text, discarding stop words."""
    words = re.findall(r'\b[a-zA-Z]{3,20}\b', text.lower())
    return [w for w in words if w not in STOP_WORDS]

def calculate_word_frequencies(text: str) -> Dict[str, int]:
    """Calculate frequency of non-stop words in the text block."""
    tokens = clean_and_tokenize(text)
    freq: Dict[str, int] = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    return freq

def extract_sentences(text: str) -> List[str]:
    """Parse text context into clean lines or sentence strings, preserving structural items."""
    blocks = re.split(r'\n\n+', text)
    sentences = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Treat list items or headings as single units
            if line.startswith(("-", "*", "#")) or re.match(r'^\d+\.', line):
                sentences.append(line)
            else:
                # Otherwise split line into standard sentences
                sub_sents = re.split(r'(?<=[.!?])\s+', line)
                for s in sub_sents:
                    s = s.strip()
                    if s:
                        sentences.append(s)
    return sentences

def score_sentences(sentences: List[str], word_freqs: Dict[str, int]) -> List[Tuple[str, float]]:
    """Rank sentences based on length, keyword density, and structural weight/formatting."""
    scored: List[Tuple[str, float]] = []
    for s in sentences:
        clean_s = s.strip()
        length = len(clean_s)
        if length < 25 or length > 400:
            continue
        
        tokens = clean_and_tokenize(clean_s)
        if not tokens:
            continue
        
        # Base score on average frequency of words in sentence
        keyword_density = sum(word_freqs.get(t, 0) for t in tokens) / len(tokens)
        
        # Structure bonuses
        bonus = 0.0
        if "**" in clean_s or "__" in clean_s:
            bonus += 6.0  # High bonus for explicit bold terms
        if re.search(r'\b(is defined as|refers to|means|denotes|stands for|is a type of)\b', clean_s, re.IGNORECASE):
            bonus += 5.0  # High bonus for definition structure
        if ":" in clean_s:
            bonus += 3.0  # Colon definitions
        if clean_s.startswith(("-", "*", "1.", "2.", "3.")):
            bonus += 2.0  # List/bullet elements
        
        scored.append((clean_s, keyword_density + bonus))
        
    # Sort in descending order of score
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored

def extract_term_definition(sentence: str) -> Optional[Tuple[str, str]]:
    """Attempt to extract term and definition from a sentence using regex rules."""
    # Check for bold term pattern e.g., "**Term** is definition"
    bold_match = re.search(r'(?:\*\*|__)(.*?)(?:\*\*|__)\s+(?:is defined as|refers to|means|is a|is the)\s+(.*)', sentence, re.IGNORECASE)
    if bold_match:
        return bold_match.group(1).strip(), bold_match.group(2).strip()
    
    # Check for colon definition e.g., "Term: Definition"
    if ":" in sentence:
        parts = sentence.split(":", 1)
        term = parts[0].strip()
        definition = parts[1].strip()
        # Ensure term is short (1-4 words) and definition is substantial
        if 1 <= len(term.split()) <= 4 and len(definition) > 10:
            # Clean list formatting if present
            term = re.sub(r'^[-\*\d\.\s]+', '', term).strip()
            return term, definition

    # Check for standard verbs "refers to", "is defined as", "means"
    verb_patterns = [
        r'\s+is defined as\s+',
        r'\s+refers to\s+',
        r'\s+means\s+',
        r'\s+stands for\s+'
    ]
    for pattern in verb_patterns:
        parts = re.split(pattern, sentence, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2:
            term = parts[0].strip()
            definition = parts[1].strip()
            # Clean list formatting
            term = re.sub(r'^[-\*\d\.\s]+', '', term).strip()
            if 1 <= len(term.split()) <= 5 and len(definition) > 10:
                return term, definition
            
    return None

def generate_local_flashcards(context: str, note_id: uuid.UUID, limit: int = 5) -> List[Flashcard]:
    """Generate exactly `limit` flashcards locally from document context using deterministic heuristic rules."""
    logger.info(f"Generating local fallback flashcards for note {note_id} (context length: {len(context)})")
    
    flashcards: List[Flashcard] = []
    seen_questions = set()
    
    if not context or not context.strip():
        # Safeguard fallback if context is completely empty
        return _get_default_flashcards(note_id, limit)
    
    sentences = extract_sentences(context)
    word_freqs = calculate_word_frequencies(context)
    ranked = score_sentences(sentences, word_freqs)
    
    # Heuristic 1: Explicit Term/Definition matching
    for s, _ in ranked:
        res = extract_term_definition(s)
        if res:
            term, definition = res
            question = f"What is '{term}'?"
            # Clean definition of trailing punctuation/md tags
            definition = re.sub(r'[\*\s]+$', '', definition)
            if question not in seen_questions and len(definition) > 10:
                fc = Flashcard(note_id=note_id, question=question, answer=definition)
                flashcards.append(fc)
                seen_questions.add(question)
                if len(flashcards) >= limit:
                    break

    # Heuristic 2: Bold Terms without explicit definition verbs
    if len(flashcards) < limit:
        for s, _ in ranked:
            bold_terms = re.findall(r'(?:\*\*|__)(.*?)(?:\*\*|__)', s)
            for term in bold_terms:
                term = term.strip()
                if len(term) > 2 and len(term.split()) <= 4:
                    question = f"Explain the concept of '{term}' based on the document."
                    # Clean out markdown stars from answer
                    answer = s.replace("**", "").replace("__", "").strip()
                    if question not in seen_questions:
                        fc = Flashcard(note_id=note_id, question=question, answer=answer)
                        flashcards.append(fc)
                        seen_questions.add(question)
                        if len(flashcards) >= limit:
                            break
            if len(flashcards) >= limit:
                break

    # Heuristic 3: Key concepts from highest ranked sentences
    if len(flashcards) < limit:
        for s, _ in ranked:
            # Clean sentence for display
            clean_s = s.replace("**", "").replace("__", "").strip()
            # Find the most important keyword in this sentence
            tokens = clean_and_tokenize(clean_s)
            if not tokens:
                continue
            # Sort tokens by overall frequency in document to find key concept
            tokens.sort(key=lambda t: word_freqs.get(t, 0), reverse=True)
            key_concept = tokens[0].capitalize()
            
            question = f"What key information does the document provide regarding {key_concept}?"
            if question not in seen_questions:
                fc = Flashcard(note_id=note_id, question=question, answer=clean_s)
                flashcards.append(fc)
                seen_questions.add(question)
                if len(flashcards) >= limit:
                    break

    # Enforce exactly `limit` flashcards
    while len(flashcards) < limit:
        defaults = _get_default_flashcards(note_id, limit)
        for dfc in defaults:
            if dfc.question not in seen_questions:
                flashcards.append(dfc)
                seen_questions.add(dfc.question)
            if len(flashcards) >= limit:
                break

    return flashcards[:limit]

def _get_default_flashcards(note_id: uuid.UUID, limit: int) -> List[Flashcard]:
    """Provide default robust flashcards to ensure generation never fails."""
    defaults = [
        Flashcard(
            note_id=note_id,
            question="What is the primary topic of the document?",
            answer="This document serves as a reference node in your AI Workspace. You can upload files or write notes to analyze and query them semantically."
        ),
        Flashcard(
            note_id=note_id,
            question="How is semantic search performed on notes?",
            answer="The system generates vector embeddings from document chunks using Gemini, indexes them, and runs similarity queries via pgvector to retrieve relevant RAG context."
        ),
        Flashcard(
            note_id=note_id,
            question="What is the function of the background worker?",
            answer="It runs text extraction, chunking, and vector indexing asynchronously upon document upload to ensure the main server thread is never blocked."
        ),
        Flashcard(
            note_id=note_id,
            question="How does spaced repetition benefit studying?",
            answer="It schedules flashcard reviews at optimized intervals using algorithms like SM-2, targeting concepts just as you are about to forget them to maximize retention."
        ),
        Flashcard(
            note_id=note_id,
            question="What does RAG stand for and what does it do?",
            answer="RAG stands for Retrieval-Augmented Generation. It retrieves matching source document fragments and injects them to ground the LLM's responses."
        )
    ]
    return defaults[:limit]

def generate_local_quiz(context: str, quiz_id: uuid.UUID, limit: int = 3) -> List[QuizQuestion]:
    """Generate exactly `limit` multiple choice questions locally using heuristic definitions and distractors."""
    logger.info(f"Generating local fallback quiz for quiz {quiz_id} (context length: {len(context)})")
    
    questions: List[QuizQuestion] = []
    seen_questions = set()
    
    if not context or not context.strip():
        return _get_default_quiz_questions(quiz_id, limit)
        
    sentences = extract_sentences(context)
    word_freqs = calculate_word_frequencies(context)
    ranked = score_sentences(sentences, word_freqs)
    
    # Collect generic definitions and keywords to use as global distractors
    all_definitions: List[str] = []
    all_keywords: List[str] = []
    for s, _ in ranked:
        res = extract_term_definition(s)
        if res:
            all_definitions.append(res[1])
        tokens = clean_and_tokenize(s)
        all_keywords.extend(tokens)
        
    all_definitions = list(set([d for d in all_definitions if len(d) > 10]))
    all_keywords = list(set([k for k in all_keywords if len(k) > 3]))
    
    # Fallback lists if the document is too short
    default_distractor_definitions = [
        "A caching mechanism to reduce DB queries",
        "A security policy enforcing workspace isolation",
        "An asynchronous background pipeline processing documents",
        "A vector indexing configuration to match RAG queries"
    ]
    default_distractor_words = ["Database", "Pipeline", "Schema", "Token"]

    # Heuristic 1: Term / Definition questions
    for s, _ in ranked:
        res = extract_term_definition(s)
        if res:
            term, definition = res
            question_text = f"According to the document, what is the definition or role of '{term}'?"
            if question_text not in seen_questions:
                # Find distractors from other definitions
                distractors = [d for d in all_definitions if d != definition][:3]
                while len(distractors) < 3:
                    candidate = default_distractor_definitions[len(distractors) % len(default_distractor_definitions)]
                    if candidate not in distractors:
                        distractors.append(candidate)
                
                choices = [definition] + distractors
                # Shuffle choices deterministically based on term length so they look mixed
                import random
                # Set a deterministic seed per question to avoid raw random fluctuations
                seed_val = sum(ord(c) for c in term)
                rng = random.Random(seed_val)
                rng.shuffle(choices)
                
                q = QuizQuestion(
                    quiz_id=quiz_id,
                    question_text=question_text,
                    choices=choices,
                    correct_answer=definition,
                    explanation=f"The document states that '{term}' refers to: {definition}."
                )
                questions.append(q)
                seen_questions.add(question_text)
                if len(questions) >= limit:
                    break

    # Heuristic 2: Fill-in-the-blank questions
    if len(questions) < limit:
        for s, _ in ranked:
            clean_s = s.replace("**", "").replace("__", "").strip()
            # Look for a good key noun/word to blank out
            tokens = clean_and_tokenize(clean_s)
            if not tokens:
                continue
            # Find the most frequent token in the document that is present in the sentence
            tokens.sort(key=lambda t: word_freqs.get(t, 0), reverse=True)
            blank_word = tokens[0]
            
            # Find case-preserved word in the sentence
            match = re.search(rf'\b({blank_word})\b', clean_s, re.IGNORECASE)
            if not match:
                continue
            actual_word = match.group(1)
            
            # Create question by replacing word with blank line
            blanked_sentence = re.sub(rf'\b{actual_word}\b', "________", clean_s, flags=re.IGNORECASE)
            question_text = f"Complete the following statement from the document: \"{blanked_sentence}\""
            
            if question_text not in seen_questions and len(blanked_sentence) > 30:
                distractors = [w.capitalize() for w in all_keywords if w.lower() != actual_word.lower()][:3]
                while len(distractors) < 3:
                    candidate = default_distractor_words[len(distractors) % len(default_distractor_words)]
                    if candidate.lower() != actual_word.lower() and candidate not in distractors:
                        distractors.append(candidate)
                        
                choices = [actual_word.capitalize()] + distractors
                import random
                rng = random.Random(sum(ord(c) for c in actual_word))
                rng.shuffle(choices)
                
                q = QuizQuestion(
                    quiz_id=quiz_id,
                    question_text=question_text,
                    choices=choices,
                    correct_answer=actual_word.capitalize(),
                    explanation=f"The correct sentence is: \"{clean_s}\"."
                )
                questions.append(q)
                seen_questions.add(question_text)
                if len(questions) >= limit:
                    break

    # Enforce exactly `limit` questions
    while len(questions) < limit:
        defaults = _get_default_quiz_questions(quiz_id, limit)
        for dq in defaults:
            if dq.question_text not in seen_questions:
                questions.append(dq)
                seen_questions.add(dq.question_text)
            if len(questions) >= limit:
                break

    return questions[:limit]

def _get_default_quiz_questions(quiz_id: uuid.UUID, limit: int) -> List[QuizQuestion]:
    """Provide default robust quiz questions to ensure generation never fails."""
    defaults = [
        QuizQuestion(
            quiz_id=quiz_id,
            question_text="What does the acronym RAG represent in modern AI applications?",
            choices=[
                "Retrieval-Augmented Generation",
                "Robust Assertion Gateway",
                "Relational Aggregation Worker",
                "Randomized Assessment Graph"
            ],
            correct_answer="Retrieval-Augmented Generation",
            explanation="RAG stands for Retrieval-Augmented Generation. It retrieves matching source document fragments and injects them to ground the LLM's responses."
        ),
        QuizQuestion(
            quiz_id=quiz_id,
            question_text="Which database extension is utilized in NoteAI to execute fast semantic search vector comparisons?",
            choices=[
                "pgvector",
                "postgis",
                "hstore",
                "uuid-ossp"
            ],
            correct_answer="pgvector",
            explanation="pgvector is a specialized PostgreSQL extension that supports vector type columns and cosine/inner product similarity operators."
        ),
        QuizQuestion(
            quiz_id=quiz_id,
            question_text="What is the default initial learning Ease Factor assigned to generated flashcards in SM-2?",
            choices=[
                "250%",
                "130%",
                "100%",
                "500%"
            ],
            correct_answer="250%",
            explanation="Under the SM-2 spaced repetition algorithm, new cards start with a default ease factor of 250% (stored in database as 250)."
        )
    ]
    return defaults[:limit]
