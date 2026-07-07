import sys
import uuid
import asyncio
from unittest.mock import AsyncMock

# Add backend directory to path to allow direct imports
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.local_generators import (
    generate_local_flashcards,
    generate_local_quiz,
    extract_sentences,
    score_sentences,
    calculate_word_frequencies,
    extract_term_definition
)
from app.services.ai import AIService
from app.db.models.extensions import Flashcard, QuizQuestion

# Sample context text containing bold terms, definitions, headings, and lists
SAMPLE_TEXT = """
# Introduction to RAG Systems

Retrieval-Augmented Generation (RAG) is defined as a technique that combines retrieval models with generative LLMs.
The primary purpose of **RAG** is to reduce model hallucinations by grounding prompt queries in relevant source facts.

Key components of RAG:
1. **Document Loader** refers to the system utility that extracts plain text from uploaded files like PDF or DOCX.
2. **Chunker** is defined as a module that splits large text blocks into overlapping snippets of text.
3. **Embedding Model** means a model that projects text strings into high-dimensional vector representations.

Vector similarity search is executed using the pgvector extension.
This ensures notes semantic search is fast and efficient.
"""

def test_extract_sentences():
    sentences = extract_sentences(SAMPLE_TEXT)
    assert len(sentences) > 0
    assert any(s.startswith("1. ") for s in sentences)
    assert any("Retrieval-Augmented Generation" in s for s in sentences)
    print("[OK] test_extract_sentences passed!")

def test_score_sentences():
    sentences = extract_sentences(SAMPLE_TEXT)
    freqs = calculate_word_frequencies(SAMPLE_TEXT)
    scored = score_sentences(sentences, freqs)
    
    assert len(scored) > 0
    highest_s, highest_score = scored[0]
    assert highest_score > 0
    assert any(indicator in highest_s for indicator in ["is defined as", "refers to", "means", "**"])
    print("[OK] test_score_sentences passed!")

def test_extract_term_definition():
    s1 = "Retrieval-Augmented Generation (RAG) is defined as a technique that combines retrieval models with generative LLMs."
    res = extract_term_definition(s1)
    assert res is not None
    assert "Retrieval-Augmented Generation" in res[0]
    assert "technique that combines" in res[1]

    s2 = "Chunker: a module that splits large text blocks into overlapping snippets."
    res2 = extract_term_definition(s2)
    assert res2 is not None
    assert res2[0] == "Chunker"
    assert "module that splits" in res2[1]
    print("[OK] test_extract_term_definition passed!")

def test_generate_local_flashcards():
    note_id = uuid.uuid4()
    flashcards = generate_local_flashcards(SAMPLE_TEXT, note_id, limit=5)
    
    assert len(flashcards) == 5
    for fc in flashcards:
        assert isinstance(fc, Flashcard)
        assert fc.note_id == note_id
        assert fc.question is not None
        assert fc.answer is not None
        assert len(fc.question) > 0
        assert len(fc.answer) > 0
    print("[OK] test_generate_local_flashcards passed!")

def test_generate_local_quiz():
    quiz_id = uuid.uuid4()
    questions = generate_local_quiz(SAMPLE_TEXT, quiz_id, limit=3)
    
    assert len(questions) == 3
    for q in questions:
        assert isinstance(q, QuizQuestion)
        assert q.quiz_id == quiz_id
        assert len(q.question_text) > 0
        assert len(q.choices) == 4
        assert q.correct_answer in q.choices
        assert len(q.explanation) > 0
    print("[OK] test_generate_local_quiz passed!")

async def test_ai_service_fallback_integration():
    mock_db = AsyncMock()
    ai_service = AIService(db=mock_db)
    
    note_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    
    # Mock workspace context retriever and call_gemini_json
    ai_service._get_workspace_context = AsyncMock(return_value=SAMPLE_TEXT)
    ai_service._call_gemini_json = AsyncMock(return_value=None)
    
    flashcards = await ai_service.generate_note_flashcards(note_id, workspace_id)
    
    assert len(flashcards) == 5
    assert mock_db.add.call_count == 5
    mock_db.flush.assert_called_once()
    print("[OK] test_ai_service_fallback_integration passed!")

async def main():
    print("====================================================")
    print("RUNNING LOCAL FALLBACK GENERATORS VERIFICATION SUITE")
    print("====================================================")
    
    test_extract_sentences()
    test_score_sentences()
    test_extract_term_definition()
    test_generate_local_flashcards()
    test_generate_local_quiz()
    await test_ai_service_fallback_integration()
    
    print("====================================================")
    print("VERIFICATION SUITE COMPLETED SUCCESSFULLY [PASS]")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(main())
