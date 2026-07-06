import uuid
import re
import json
import os
import httpx
import hashlib
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import logging
logger = logging.getLogger(__name__)

from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.db.models.note import Note
from app.db.models.document import Document, DocumentChunk, Embedding
from app.db.models.extensions import (
    Flashcard,
    FlashcardReview,
    Quiz,
    QuizQuestion,
    KnowledgeGraphEdge,
)
from app.schemas.ai import KnowledgeGraphNode, KnowledgeGraphEdgeResponse, KnowledgeGraphResponse, KnowledgeGraphEdgeCreate
from app.services.retrieval import RetrievalService
from app.services.embedding import get_embedding_provider


class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.retrieval_service = RetrievalService(db)

    async def search_notes_semantic(self, workspace_id: uuid.UUID, query_str: str, limit: int = 5) -> List[Any]:
        """Perform real pgvector semantic similarity search, mapping top document matches into the response format."""
        # 1. Retrieve matching chunks from the RAG layer
        references = await self.retrieval_service.retrieve_context(workspace_id, query_str, limit)
        
        # 2. Extract unique matching documents
        doc_ids = list(set([ref["document_id"] for ref in references]))
        if not doc_ids:
            return []
            
        # 3. Load documents from database
        stmt = select(Document).where(Document.id.in_(doc_ids))
        res = await self.db.execute(stmt)
        documents = res.scalars().all()
        
        # 4. Map documents to NoteResponse-like dictionary/objects to preserve frontend API compatibility
        mapped_results = []
        for doc in documents:
            # Find the best chunk text for this document to use as preview content
            best_chunk = next((ref["chunk_text"] for ref in references if ref["document_id"] == doc.id), "")
            mapped_results.append({
                "id": doc.id,
                "title": doc.filename,
                "content": best_chunk,
                "folder_id": None,
                "workspace_id": doc.workspace_id,
                "created_by": doc.created_by or uuid.uuid4(),
                "is_favorite": False,
                "created_at": doc.created_at,
                "updated_at": doc.updated_at
            })
            
        return mapped_results

    # =========================================================================
    # FLASHCARDS (Spaced Repetition SM-2 & RAG Ingestion)
    # =========================================================================

    async def get_note_flashcards(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> List[Flashcard]:
        """List all flashcards generated for a specific note."""
        query_fc = select(Flashcard).where(Flashcard.note_id == note_id).order_by(Flashcard.created_at)
        result_fc = await self.db.execute(query_fc)
        return list(result_fc.scalars().all())

    async def _call_gemini_json(self, prompt: str) -> Optional[Any]:
        """Call Gemini API and parse JSON from the response. Returns None on failure."""
        from app.core.config import settings
        from app.core.retries import retry_with_backoff
        from app.core.circuit_breaker import llm_breaker

        gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        gemini_model = settings.GEMINI_MODEL or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
        if not gemini_key:
            return None
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"}
        }

        async def _make_call():
            async with httpx.AsyncClient(timeout=settings.AI_GENERATION_TIMEOUT) as client:
                resp = await client.post(url, params={"key": gemini_key}, json=payload)
                if resp.status_code != 200:
                    raise Exception(f"Gemini API returned error {resp.status_code}: {resp.text}")
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                # Strip markdown code fences if Gemini wraps in ```json
                raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
                raw_text = re.sub(r'\s*```$', '', raw_text)
                return json.loads(raw_text)

        async def _run_with_retry():
            return await retry_with_backoff(_make_call)

        def _fallback():
            logger.error("Circuit breaker fallback triggered for Gemini JSON call.")
            return None

        try:
            return await llm_breaker.execute(_run_with_retry, _fallback)
        except Exception as e:
            logger.error(f"Gemini JSON API call failed: {e}")
            return None

    async def _get_workspace_context(self, workspace_id: uuid.UUID, note_id: uuid.UUID, limit: int = 10) -> str:
        """Fetch specific document chunk text if note_id represents a document, else fallback to note content."""
        # Check if this note_id actually represents an ingested Document
        doc_stmt = select(Document).where(Document.id == note_id, Document.workspace_id == workspace_id)
        doc_res = await self.db.execute(doc_stmt)
        doc = doc_res.scalar_one_or_none()
        
        if doc:
            stmt_chunks = (
                select(DocumentChunk.chunk_text, Document.filename)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(Document.id == note_id)
                .where(Document.status == "completed")
                .order_by(DocumentChunk.chunk_index)
                .limit(limit)
            )
            res_chunks = await self.db.execute(stmt_chunks)
            rows = res_chunks.all()
            if rows:
                parts = []
                for r in rows:
                    parts.append(f"[{r.filename}]\n{r.chunk_text}")
                return "\n\n".join(parts)

        # Fallback: note content
        note_stmt = select(Note).where(Note.id == note_id, Note.workspace_id == workspace_id)
        res_note = await self.db.execute(note_stmt)
        note = res_note.scalar_one_or_none()
        if note and note.content and note.content.strip():
            return note.content
        return ""

    async def generate_note_flashcards(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> List[Flashcard]:
        """Generate flashcards from document chunks using Gemini LLM with JSON output."""
        context = await self._get_workspace_context(workspace_id, note_id, limit=10)

        flashcards: List[Flashcard] = []

        if context:
            prompt = (
                "You are an expert educational content creator. "
                "Read the following document content and generate exactly 5 flashcards as a JSON array. "
                "Each flashcard must have a 'question' and an 'answer' field. "
                "Questions should test understanding of key concepts, facts, and ideas in the text. "
                "Answers should be concise (1-3 sentences). "
                "Return ONLY a JSON array, no extra text.\n\n"
                f"Document content:\n{context[:4000]}\n\n"
                "Format: [{\"question\": \"...\", \"answer\": \"...\"}]"
            )
            result = await self._call_gemini_json(prompt)
            if result and isinstance(result, list):
                for item in result[:5]:
                    q_text = item.get("question", "").strip()
                    a_text = item.get("answer", "").strip()
                    if q_text and a_text:
                        fc = Flashcard(note_id=note_id, question=q_text, answer=a_text)
                        self.db.add(fc)
                        flashcards.append(fc)

        # Fallback if LLM unavailable or returned nothing
        if not flashcards:
            if context:
                # Safe sentence split approach as last resort
                sentences = re.split(r'[.!?]+', context)
                for m in sentences:
                    m = m.strip()
                    if len(m) < 30 or len(m) > 400:
                        continue
                    parts = re.split(r'\s+(?:is|defines|refers to|means)\s+', m, maxsplit=1, flags=re.IGNORECASE)
                    if len(parts) == 2 and 5 <= len(parts[0].strip()) <= 150:
                        term, desc = parts[0].strip(), parts[1].strip()
                        fc = Flashcard(note_id=note_id, question=f"What is '{term}'?", answer=desc)
                        self.db.add(fc)
                        flashcards.append(fc)
                        if len(flashcards) >= 5:
                            break

        if not flashcards:
            fc = Flashcard(
                note_id=note_id,
                question="What is the primary topic of the documents in this workspace?",
                answer="Upload and process documents to generate content-specific flashcards."
            )
            self.db.add(fc)
            flashcards.append(fc)

        await self.db.flush()
        return flashcards

    async def review_flashcard(self, flashcard_id: uuid.UUID, user_id: uuid.UUID, rating: int) -> Flashcard:
        """Submit flashcard score rating and adjust schedule using SuperMemo-2 (SM-2) algorithm."""
        fc = await self.db.get(Flashcard, flashcard_id)
        if not fc:
            raise NotFoundException(detail="Flashcard not found")

        q = max(1, min(5, rating))
        ef = fc.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)) * 100
        ef = max(130, int(ef))
        fc.ease_factor = ef

        if q < 3:
            fc.repetitions = 0
            fc.interval_days = 1
        else:
            if fc.repetitions == 0:
                fc.interval_days = 1
            elif fc.repetitions == 1:
                fc.interval_days = 6
            else:
                fc.interval_days = max(1, int(round(fc.interval_days * (ef / 100.0))))
            fc.repetitions += 1

        fc.next_review = datetime.now(timezone.utc) + timedelta(days=fc.interval_days)
        fc.updated_at = datetime.utcnow()
        self.db.add(fc)

        review_log = FlashcardReview(
            flashcard_id=fc.id,
            user_id=user_id,
            rating=q
        )
        self.db.add(review_log)
        await self.db.flush()
        return fc

    # =========================================================================
    # QUIZZES (RAG Ingestion)
    # =========================================================================

    async def get_note_quizzes(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> List[Quiz]:
        """Fetch quizzes associated with a note."""
        query_qz = select(Quiz).where(Quiz.note_id == note_id).options(selectinload(Quiz.questions))
        result_qz = await self.db.execute(query_qz)
        return list(result_qz.scalars().all())

    async def generate_note_quiz(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> Quiz:
        """Create a multiple-choice quiz from workspace document chunks using Gemini LLM with JSON output."""
        context = await self._get_workspace_context(workspace_id, note_id, limit=10)

        quiz = Quiz(note_id=note_id, title="Knowledge Quiz")
        self.db.add(quiz)
        await self.db.flush()

        question_count = 0

        if context:
            prompt = (
                "You are an expert quiz creator. "
                "Read the following document content and generate exactly 3 multiple-choice questions as a JSON array. "
                "Each question must have: 'question_text' (string), 'choices' (array of 4 strings), "
                "'correct_answer' (string matching one of the choices exactly), 'explanation' (string). "
                "Base all questions strictly on facts found in the provided text. "
                "Return ONLY a JSON array, no extra text.\n\n"
                f"Document content:\n{context[:4000]}\n\n"
                "Format: [{\"question_text\": \"...\", \"choices\": [\"A\",\"B\",\"C\",\"D\"], "
                "\"correct_answer\": \"A\", \"explanation\": \"...\"}]"
            )
            result = await self._call_gemini_json(prompt)
            if result and isinstance(result, list):
                for item in result[:3]:
                    q_text = item.get("question_text", "").strip()
                    choices = item.get("choices", [])
                    correct = item.get("correct_answer", "").strip()
                    explanation = item.get("explanation", "").strip()
                    if q_text and choices and correct:
                        q = QuizQuestion(
                            quiz_id=quiz.id,
                            question_text=q_text,
                            choices=choices,
                            correct_answer=correct,
                            explanation=explanation
                        )
                        self.db.add(q)
                        question_count += 1

        # Fallback: safe sentence split approach if LLM unavailable
        if question_count == 0 and context:
            sentences = re.split(r'[.!?]+', context)
            for m in sentences:
                m = m.strip()
                if len(m) < 30 or len(m) > 400:
                    continue
                parts = re.split(r'\s+(?:is|defines|refers to|means)\s+', m, maxsplit=1, flags=re.IGNORECASE)
                if len(parts) == 2 and 5 <= len(parts[0].strip()) <= 150:
                    term, desc = parts[0].strip(), parts[1].strip()
                    q = QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=f"What does '{term}' refer to in the document?",
                        choices=[desc, "A database migration tool", "A network protocol", "None of the above"],
                        correct_answer=desc,
                        explanation=f"The document states: '{m}'"
                    )
                    self.db.add(q)
                    question_count += 1
                    if question_count >= 3:
                        break

        # Final fallback
        if question_count == 0:
            q = QuizQuestion(
                quiz_id=quiz.id,
                question_text="What is the primary purpose of the documents in this workspace?",
                choices=[
                    "To provide knowledge for AI-assisted research",
                    "To store CSS stylesheets",
                    "To run automated tests",
                    "None of the above"
                ],
                correct_answer="To provide knowledge for AI-assisted research",
                explanation="Upload and process documents to generate content-specific quiz questions."
            )
            self.db.add(q)

        await self.db.flush()

        # Reload with relations
        query_reload = select(Quiz).where(Quiz.id == quiz.id).options(selectinload(Quiz.questions))
        result = await self.db.execute(query_reload)
        return result.scalar_one()

    async def submit_quiz(self, quiz_id: uuid.UUID, answers: Dict[uuid.UUID, str]) -> Dict:
        """Evaluate user responses for a quiz and grade performance."""
        query = select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions))
        res = await self.db.execute(query)
        quiz = res.scalar_one_or_none()
        if not quiz:
            raise NotFoundException(detail="Quiz not found")

        score = 0
        results_map = {}
        for question in quiz.questions:
            user_ans = answers.get(question.id, "").strip()
            is_correct = user_ans.lower() == question.correct_answer.lower()
            if is_correct:
                score += 1
            results_map[question.id] = {
                "is_correct": is_correct,
                "correct_answer": question.correct_answer,
                "user_answer": user_ans,
                "explanation": question.explanation
            }

        return {
            "quiz_id": quiz_id,
            "score": score,
            "total_questions": len(quiz.questions),
            "results": results_map
        }

    # =========================================================================
    # KNOWLEDGE SOURCE GENERATION (context-injected variants)
    # =========================================================================

    async def generate_flashcards_with_context(self, note_id: uuid.UUID, context: str) -> List[Flashcard]:
        """Generate flashcards using pre-fetched context text. Used by KnowledgeService endpoints."""
        flashcards: List[Flashcard] = []
        logger.info(f"[AUDIT] AI Service - generate_flashcards_with_context called for note_id: {note_id}, context length: {len(context) if context else 0}")

        if context:
            prompt = (
                "You are an expert educational content creator. "
                "Read the following document content and generate exactly 5 flashcards as a JSON array. "
                "Each flashcard must have a 'question' and an 'answer' field. "
                "Questions should test understanding of key concepts, facts, and ideas in the text. "
                "Answers should be concise (1-3 sentences). "
                "Return ONLY a JSON array, no extra text.\n\n"
                f"Document content:\n{context[:4000]}\n\n"
                "Format: [{\"question\": \"...\", \"answer\": \"...\"}]"
            )
            result = await self._call_gemini_json(prompt)
            if result and isinstance(result, list):
                for item in result[:5]:
                    q_text = item.get("question", "").strip()
                    a_text = item.get("answer", "").strip()
                    if q_text and a_text:
                        fc = Flashcard(note_id=note_id, question=q_text, answer=a_text)
                        self.db.add(fc)
                        flashcards.append(fc)
            else:
                logger.warning("[AUDIT] LLM returned empty or invalid response for flashcards")

        # Fallback if LLM unavailable or returned nothing
        if not flashcards:
            logger.info("[AUDIT] Falling back to regex extraction for flashcards")
            if context:
                sentences = re.split(r'[.!?]+', context)
                for m in sentences:
                    m = m.strip()
                    if len(m) < 30 or len(m) > 400:
                        continue
                    parts = re.split(r'\s+(?:is|defines|refers to|means)\s+', m, maxsplit=1, flags=re.IGNORECASE)
                    if len(parts) == 2 and 5 <= len(parts[0].strip()) <= 150:
                        term, desc = parts[0].strip(), parts[1].strip()
                        fc = Flashcard(note_id=note_id, question=f"What is '{term}'?", answer=desc)
                        self.db.add(fc)
                        flashcards.append(fc)
                        if len(flashcards) >= 5:
                            break

        if not flashcards:
            fc = Flashcard(
                note_id=note_id,
                question="What is the primary topic of this knowledge source?",
                answer="Add more content to generate context-specific flashcards."
            )
            self.db.add(fc)
            flashcards.append(fc)

        await self.db.flush()
        return flashcards

    async def generate_quiz_with_context(self, note_id: uuid.UUID, context: str) -> Quiz:
        """Generate a quiz using pre-fetched context text. Used by KnowledgeService endpoints."""
        logger.info(f"[AUDIT] AI Service - generate_quiz_with_context called for note_id: {note_id}, context length: {len(context) if context else 0}")
        quiz = Quiz(note_id=note_id, title="Knowledge Quiz")
        self.db.add(quiz)
        await self.db.flush()

        question_count = 0

        if context:
            prompt = (
                "You are an expert quiz creator. "
                "Read the following document content and generate exactly 3 multiple-choice questions as a JSON array. "
                "Each question must have: 'question_text' (string), 'choices' (array of 4 strings), "
                "'correct_answer' (string matching one of the choices exactly), 'explanation' (string). "
                "Base all questions strictly on facts found in the provided text. "
                "Return ONLY a JSON array, no extra text.\n\n"
                f"Document content:\n{context[:4000]}\n\n"
                "Format: [{\"question_text\": \"...\", \"choices\": [\"A\",\"B\",\"C\",\"D\"], "
                "\"correct_answer\": \"A\", \"explanation\": \"...\"}]"
            )
            result = await self._call_gemini_json(prompt)
            if result and isinstance(result, list):
                for item in result[:3]:
                    q_text = item.get("question_text", "").strip()
                    choices = item.get("choices", [])
                    correct = item.get("correct_answer", "").strip()
                    explanation = item.get("explanation", "").strip()
                    if q_text and choices and correct:
                        q = QuizQuestion(
                            quiz_id=quiz.id,
                            question_text=q_text,
                            choices=choices,
                            correct_answer=correct,
                            explanation=explanation
                        )
                        self.db.add(q)
                        question_count += 1
            else:
                logger.warning("[AUDIT] LLM returned empty or invalid response for quizzes")

        # Fallback: safe sentence split approach if LLM unavailable
        if question_count == 0 and context:
            logger.info("[AUDIT] Falling back to sentence splitting extraction for quizzes")
            sentences = re.split(r'[.!?]+', context)
            for m in sentences:
                m = m.strip()
                if len(m) < 30 or len(m) > 400:
                    continue
                parts = re.split(r'\s+(?:is|defines|refers to|means)\s+', m, maxsplit=1, flags=re.IGNORECASE)
                if len(parts) == 2 and 5 <= len(parts[0].strip()) <= 150:
                    term, desc = parts[0].strip(), parts[1].strip()
                    q = QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=f"What does '{term}' refer to in the source?",
                        choices=[desc, "A database migration tool", "A network protocol", "None of the above"],
                        correct_answer=desc,
                        explanation=f"The source states: '{m}'"
                    )
                    self.db.add(q)
                    question_count += 1
                    if question_count >= 3:
                        break

        # Final fallback
        if question_count == 0:
            q = QuizQuestion(
                quiz_id=quiz.id,
                question_text="What is the primary purpose of this knowledge source?",
                choices=[
                    "To provide knowledge for AI-assisted research",
                    "To store CSS stylesheets",
                    "To run automated tests",
                    "None of the above"
                ],
                correct_answer="To provide knowledge for AI-assisted research",
                explanation="Add more content to generate context-specific quiz questions."
            )
            self.db.add(q)

        await self.db.flush()

        # Reload with relations
        query_reload = select(Quiz).where(Quiz.id == quiz.id).options(selectinload(Quiz.questions))
        result = await self.db.execute(query_reload)
        return result.scalar_one()

    # =========================================================================
    # KNOWLEDGE GRAPH (Semantic Similarity Relations)
    # =========================================================================

    async def get_workspace_knowledge_graph(self, workspace_id: uuid.UUID) -> KnowledgeGraphResponse:
        """Retrieve notes as nodes and automatically calculate semantic similarity edges using pgvector embeddings."""
        # 1. Fetch nodes (all notes in the workspace)
        query_notes = select(Note).where(Note.workspace_id == workspace_id)
        res_notes = await self.db.execute(query_notes)
        notes = res_notes.scalars().all()

        nodes = [
            KnowledgeGraphNode(id=n.id, title=n.title, folder_id=n.folder_id)
            for n in notes
        ]
        
        # 2. Get embeddings of notes
        # Generate vectors locally on the fly for calculation
        embedding_provider = get_embedding_provider()
        note_vectors = {}
        for note in notes:
            text_to_embed = f"{note.title} {note.content}"
            note_vectors[note.id] = await embedding_provider.get_embedding(text_to_embed)

        # 3. Calculate semantic edges based on cosine similarity
        edges_response = []
        computed_pairs = set()
        
        # Compare all pairs
        for i in range(len(notes)):
            for j in range(i + 1, len(notes)):
                id1, id2 = notes[i].id, notes[j].id
                vec1, vec2 = np.array(note_vectors[id1]), np.array(note_vectors[id2])
                
                # Compute cosine similarity
                dot_product = np.dot(vec1, vec2)
                norm_a = np.linalg.norm(vec1)
                norm_b = np.linalg.norm(vec2)
                similarity = dot_product / (norm_a * norm_b) if norm_a > 0 and norm_b > 0 else 0.0
                
                # If similarity exceeds threshold, add auto-generated relation
                if similarity >= 0.75:
                    edges_response.append(
                        KnowledgeGraphEdgeResponse(
                            id=uuid.uuid4(),
                            source=id1,
                            target=id2,
                            relation_type="semantic_similarity",
                            weight=float(round(similarity, 2))
                        )
                    )

        # 4. Fetch manually created edges too
        note_ids = {n.id for n in notes}
        if note_ids:
            query_edges = select(KnowledgeGraphEdge).where(
                KnowledgeGraphEdge.source_note_id.in_(note_ids),
                KnowledgeGraphEdge.target_note_id.in_(note_ids)
            )
            res_edges = await self.db.execute(query_edges)
            manual_edges = res_edges.scalars().all()
            for e in manual_edges:
                edges_response.append(
                    KnowledgeGraphEdgeResponse(
                        id=e.id,
                        source=e.source_note_id,
                        target=e.target_note_id,
                        relation_type=e.relation_type,
                        weight=e.weight
                    )
                )

        return KnowledgeGraphResponse(nodes=nodes, edges=edges_response)

    async def create_graph_edge(self, workspace_id: uuid.UUID, edge_in: KnowledgeGraphEdgeCreate) -> KnowledgeGraphEdge:
        """Link two notes together with a semantic relationship edge."""
        query_source = select(Note).where(Note.id == edge_in.source_note_id, Note.workspace_id == workspace_id)
        res_source = await self.db.execute(query_source)
        source_note = res_source.scalar_one_or_none()

        query_target = select(Note).where(Note.id == edge_in.target_note_id, Note.workspace_id == workspace_id)
        res_target = await self.db.execute(query_target)
        target_note = res_target.scalar_one_or_none()

        if not source_note or not target_note:
            raise BadRequestException(detail="One or both note IDs are invalid or belong to a different workspace")

        if edge_in.source_note_id == edge_in.target_note_id:
            raise BadRequestException(detail="A note cannot link to itself")

        query_existing = select(KnowledgeGraphEdge).where(
            KnowledgeGraphEdge.source_note_id == edge_in.source_note_id,
            KnowledgeGraphEdge.target_note_id == edge_in.target_note_id,
        )
        res_existing = await self.db.execute(query_existing)
        if res_existing.scalar_one_or_none():
            raise BadRequestException(detail="Relationship already exists between these notes")

        edge = KnowledgeGraphEdge(
            source_note_id=edge_in.source_note_id,
            target_note_id=edge_in.target_note_id,
            relation_type=edge_in.relation_type,
            weight=edge_in.weight,
        )
        self.db.add(edge)
        await self.db.flush()
        return edge
