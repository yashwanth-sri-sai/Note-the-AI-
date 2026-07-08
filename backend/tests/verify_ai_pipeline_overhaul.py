import sys
import os
import uuid
import asyncio
from unittest.mock import AsyncMock

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.cleaner import DocumentCleaner
from app.services.chunking import ChunkingService
from app.services.ai_validator import AIValidator
from app.services.local_generators import generate_local_flashcards, generate_local_quiz
from app.services.ai import AIService
from app.db.models.extensions import Flashcard, QuizQuestion

def test_document_cleaner():
    print("[TEST] Running DocumentCleaner tests...")
    
    # 1. Page numbers & headers
    raw_text = "Running Header Text\nPage 5 of 12\n\nThis is the actual text.\n- 12 -\n\nAnother line."
    cleaned = DocumentCleaner.clean(raw_text)
    assert "Page 5" not in cleaned
    assert "- 12 -" not in cleaned
    assert "Running Header Text" in cleaned
    
    # 2. OCR symbols
    raw_text_ocr = "Here is some text â€¢ with broken ï¿½ characters."
    cleaned_ocr = DocumentCleaner.clean(raw_text_ocr)
    assert "â€¢" not in cleaned_ocr
    assert "ï¿½" not in cleaned_ocr
    assert "with broken characters" in cleaned_ocr
    
    # 3. Smart quotes and spacing
    raw_text_quotes = "He said, “This is ‘smart’ text.”\n\n\n\nWord1    Word2"
    cleaned_quotes = DocumentCleaner.clean(raw_text_quotes)
    assert '“' not in cleaned_quotes
    assert '’' not in cleaned_quotes
    assert 'Word1 Word2' in cleaned_quotes
    
    # 4. Unmatched brackets
    raw_text_brackets = "Some text with [unmatched brackets (like this."
    cleaned_brackets = DocumentCleaner.clean(raw_text_brackets)
    assert "[" not in cleaned_brackets
    assert "(" not in cleaned_brackets
    
    print("  [PASS] DocumentCleaner verified successfully.")

def test_chunking_service():
    print("[TEST] Running ChunkingService tests...")
    
    # Text ending in preposition
    text = "Artificial Intelligence refers to the development of software systems that can perform tasks that usually require human intelligence, such as visual perception, decision-making, and"
    chunker = ChunkingService(chunk_size=100, chunk_overlap=10)
    chunks = chunker.split_text(text)
    
    for c in chunks:
        # Check that chunk does not end in trailing prepositions or conjunctions
        words = c.lower().split()
        if words:
            assert words[-1] not in chunker.trailing_words_to_avoid, f"Chunk ended with forbidden trailing word: {words[-1]}"
            
    print("  [PASS] ChunkingService verified successfully.")

def test_ai_validator():
    print("[TEST] Running AIValidator tests...")
    
    # Valid flashcard
    context = "SuperMemo-2 (SM-2) is an algorithm that schedules reviews at optimized intervals to maximize retention."
    valid_q = "What is the primary function of the SM-2 algorithm?"
    valid_a = "It schedules flashcard reviews at optimized intervals to maximize retention."
    
    is_valid, err = AIValidator.validate_flashcard(valid_q, valid_a, context)
    assert is_valid is True, f"Valid card failed: {err}"
    
    # Too short question
    is_valid, err = AIValidator.validate_flashcard("Short?", "Valid answer text is here.", context)
    assert is_valid is False
    assert "Question too short" in err
    
    # Question equals answer
    is_valid, err = AIValidator.validate_flashcard(valid_q, valid_q, context)
    assert is_valid is False
    
    # Auto-repair checks
    q_rep, a_rep = AIValidator.auto_repair_flashcard("what is SM-2", "an algorithm")
    assert q_rep.startswith("What")
    assert q_rep.endswith("?")
    assert a_rep.endswith(".")
    
    # Score checks
    high_score = AIValidator.score_flashcard(valid_q, valid_a, context)
    low_score = AIValidator.score_flashcard("Who created this?", "I don't know.", context)
    assert high_score > 0.70
    assert low_score < 0.40
    
    # Quiz validation
    is_quiz_valid, q_err = AIValidator.validate_quiz_question(
        "According to the document, what is SM-2?",
        ["An algorithm", "A database", "A server", "A pipeline"],
        "An algorithm",
        "It schedules reviews."
    )
    assert is_quiz_valid is True
    
    # Incorrect choices count
    is_quiz_valid, q_err = AIValidator.validate_quiz_question(
        "According to the document, what is SM-2?",
        ["An algorithm", "A database"],
        "An algorithm",
        "Explanation."
    )
    assert is_quiz_valid is False
    
    print("  [PASS] AIValidator verified successfully.")

def test_local_fallbacks():
    print("[TEST] Running local fallback generators tests...")
    
    context = "NoteAI is defined as an educational tool. Spaced repetition refers to reviewing information at increasing intervals."
    note_id = uuid.uuid4()
    
    # Generate fallbacks
    cards = generate_local_flashcards(context, note_id, limit=3)
    assert len(cards) == 3
    for c in cards:
        assert c.note_id == note_id
        # Ensure fallback cards are valid
        valid, err = AIValidator.validate_flashcard(c.question, c.answer, context)
        assert valid is True, f"Generated fallback card is invalid: {err}"
        
    quiz_questions = generate_local_quiz(context, uuid.uuid4(), limit=2)
    assert len(quiz_questions) == 2
    for q in quiz_questions:
        valid, err = AIValidator.validate_quiz_question(
            q.question_text, q.choices, q.correct_answer, q.explanation
        )
        assert valid is True, f"Generated fallback quiz question is invalid: {err}"
        
    print("  [PASS] Local fallback generators verified successfully.")

async def test_ai_service_overhaul():
    print("[TEST] Running AIService integration tests...")
    
    mock_db = AsyncMock()
    # Mock add method as synchronous to prevent coroutine execution warning
    mock_db.add = lambda x: None
    
    ai_service = AIService(db=mock_db)
    
    # Context
    context = "Retrieval-Augmented Generation (RAG) is defined as a technique that combines retrieval with generative LLMs."
    note_id = uuid.uuid4()
    
    # Mock call_gemini_json to return invalid layout
    ai_service._call_gemini_json = AsyncMock(return_value=[
        {"question": "What is RAG?", "answer": "A technique that combines retrieval with LLMs."}
    ])
    
    # Mock get_workspace_context
    ai_service._get_workspace_context = AsyncMock(return_value=context)
    
    # Generate
    cards = await ai_service.generate_note_flashcards(note_id, uuid.uuid4())
    # Should fall back to local generators if LLM returns fewer than 5 valid high quality cards
    assert len(cards) == 5
    
    print("  [PASS] AIService overhaul verified successfully.")

async def main():
    print("====================================================")
    print("RUNNING AI PIPELINE OVERHAUL SPRINT VERIFICATION SUITE")
    print("====================================================")
    
    test_document_cleaner()
    test_chunking_service()
    test_ai_validator()
    test_local_fallbacks()
    await test_ai_service_overhaul()
    
    print("====================================================")
    print("ALL VERIFICATION SUITE CHECKS PASSED [PASS]")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(main())
