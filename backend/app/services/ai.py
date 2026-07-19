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
from app.services.local_generators import generate_local_flashcards, generate_local_quiz


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
        """Call Gemini API and parse JSON from the response. Returns None on failure, attempts repairs."""
        from app.core.config import settings
        from app.core.retries import retry_with_backoff
        from app.core.circuit_breaker import llm_breaker

        gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        gemini_model = settings.GEMINI_MODEL or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
        if not gemini_key:
            logger.error("Gemini API key is not configured.")
            return None
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
        }

        async def _make_call():
            async with httpx.AsyncClient(timeout=settings.AI_GENERATION_TIMEOUT) as client:
                resp = await client.post(url, params={"key": gemini_key}, json=payload)
                if resp.status_code != 200:
                    raise Exception(f"Gemini API returned error {resp.status_code}: {resp.text}")
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                
                # Strip markdown code fences if Gemini wraps in ```json
                raw_clean = re.sub(r'^```(?:json)?\s*', '', raw_text)
                raw_clean = re.sub(r'\s*```$', '', raw_clean).strip()
                
                try:
                    return json.loads(raw_clean)
                except json.JSONDecodeError as je:
                    logger.warning(f"Raw JSON parsing failed, attempting repair. Text: {raw_clean[:100]}... Error: {je}")
                    # Attempt simple repair of array layout
                    bracket_match = re.search(r'\[\s*\{.*\}\s*\]', raw_clean, re.DOTALL)
                    if bracket_match:
                        try:
                            return json.loads(bracket_match.group(0))
                        except Exception:
                            pass
                    raise je

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

    async def _get_workspace_context(self, workspace_id: uuid.UUID, note_id: uuid.UUID, limit: int = 15) -> str:
        """Fetch and rank document chunk texts educationally, avoiding duplicates and preserving concept density."""
        # Check if this note_id actually represents an ingested Document
        doc_stmt = select(Document).where(Document.id == note_id, Document.workspace_id == workspace_id)
        doc_res = await self.db.execute(doc_stmt)
        doc = doc_res.scalar_one_or_none()
        
        if doc:
            stmt_chunks = (
                select(DocumentChunk.chunk_text, DocumentChunk.chunk_index, Document.filename)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(Document.id == note_id)
                .where(Document.status.in_(["completed", "COMPLETED", "ready", "READY"]))
                .order_by(DocumentChunk.chunk_index)
            )
            res_chunks = await self.db.execute(stmt_chunks)
            rows = res_chunks.all()
            if rows:
                scored_chunks = []
                for row in rows:
                    text = row.chunk_text or ""
                    # Heuristics scoring for concept density / definition richness
                    def_score = len(re.findall(r'\b(is defined as|refers to|means|denotes|stands for|is a type of)\b', text, re.IGNORECASE)) * 2.5
                    list_score = len(re.findall(r'^\s*[-*•\d+.]', text, re.MULTILINE)) * 1.0
                    cause_score = len(re.findall(r'\b(because|due to|leads to|consequence|result|since|therefore)\b', text, re.IGNORECASE)) * 1.5
                    bold_score = len(re.findall(r'(\*\*|__)', text)) * 0.5
                    
                    total_score = def_score + list_score + cause_score + bold_score
                    scored_chunks.append((total_score, row))
                
                # Sort by score in descending order and select top chunks
                scored_chunks.sort(key=lambda x: x[0], reverse=True)
                top_chunks = [item[1] for item in scored_chunks[:limit]]
                
                # Re-sort top chunks by chunk_index to keep sequential logic intact
                top_chunks.sort(key=lambda row: row.chunk_index)
                
                parts = []
                for row in top_chunks:
                    parts.append(f"[{row.filename}]\n{row.chunk_text}")
                
                full_context = "\n\n".join(parts)
                return full_context[:6000]

        # Fallback: note content
        note_stmt = select(Note).where(Note.id == note_id, Note.workspace_id == workspace_id)
        res_note = await self.db.execute(note_stmt)
        note = res_note.scalar_one_or_none()
        if note and note.content and note.content.strip():
            from app.services.cleaner import DocumentCleaner
            cleaned_note = DocumentCleaner.clean(note.content)
            return cleaned_note[:6000]
        return ""

    async def _generate_flashcards_from_context_str(self, note_id: uuid.UUID, context: str) -> List[Flashcard]:
        """Core generator and validator for flashcards from context."""
        flashcards: List[Flashcard] = []
        logger.info(f"Generating flashcards for note {note_id} (context length: {len(context) if context else 0})")
        
        if context and context.strip():
            prompt = (
                "You are an expert university professor and professional educational content creator.\n"
                "Your task is to read the provided document context and generate exactly 5 high-quality flashcards as a JSON array.\n\n"
                "Strict Rules:\n"
                "1. Generate meaningful, conceptual questions. Do not copy raw sentences. Do not create trivial or incomplete questions.\n"
                "2. Ignore corrupted text, OCR symbols, headers, page numbers, citations, or references.\n"
                "3. Every question must be fully answerable based strictly on the provided context. If the context does not contain enough information to generate 5 high-quality conceptual cards, generate fewer cards (or return an empty array []). Quality is prioritized over quantity.\n"
                "4. Answers must be clear, complete sentences (1-3 sentences), explaining the concept thoroughly.\n"
                "5. Format the output STRICTLY as a valid JSON array of objects, each containing exactly 'question' and 'answer' keys. Return absolutely no other text, markdown formatting (outside of the JSON block), or explanation.\n\n"
                f"Document Context:\n{context}\n\n"
                "Format: [{\"question\": \"...\", \"answer\": \"...\"}]"
            )
            
            result = await self._call_gemini_json(prompt)
            if result and isinstance(result, list):
                from app.services.ai_validator import AIValidator
                for item in result:
                    q_text = item.get("question", "").strip()
                    a_text = item.get("answer", "").strip()
                    if not q_text or not a_text:
                        continue
                        
                    # Auto repair
                    q_rep, a_rep = AIValidator.auto_repair_flashcard(q_text, a_text)
                    
                    # Validate
                    is_valid, err_reason = AIValidator.validate_flashcard(q_rep, a_rep, context)
                    if not is_valid:
                        logger.warning(f"Flashcard validation failed: {err_reason}. Raw Q: {q_text}")
                        continue
                        
                    # Score (threshold = 0.70)
                    score = AIValidator.score_flashcard(q_rep, a_rep, context)
                    if score < 0.70:
                        logger.warning(f"Flashcard quality score too low ({score} < 0.70). Question: {q_rep}")
                        continue
                        
                    fc = Flashcard(note_id=note_id, question=q_rep, answer=a_rep)
                    self.db.add(fc)
                    flashcards.append(fc)
                    
                    if len(flashcards) >= 5:
                        break

        # Fallback if no cards successfully generated
        if not flashcards:
            logger.info("Falling back to local fallback generator for flashcards")
            fallback_cards = generate_local_flashcards(context, note_id, limit=5)
            for fc in fallback_cards:
                self.db.add(fc)
                flashcards.append(fc)
                
        await self.db.flush()
        return flashcards

    async def generate_note_flashcards(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> List[Flashcard]:
        """Generate flashcards from document chunks using Gemini LLM with JSON output."""
        context = await self._get_workspace_context(workspace_id, note_id, limit=15)
        return await self._generate_flashcards_from_context_str(note_id, context)

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

    async def _generate_quiz_from_context_str(self, note_id: uuid.UUID, context: str) -> Quiz:
        """Core generator and validator for quizzes from context."""
        logger.info(f"Generating quiz for note {note_id} (context length: {len(context) if context else 0})")
        
        quiz = Quiz(note_id=note_id, title="Knowledge Quiz")
        self.db.add(quiz)
        await self.db.flush()
        
        question_count = 0
        
        if context and context.strip():
            prompt = (
                "You are an expert university professor and professional educational content creator.\n"
                "Your task is to read the provided document context and generate exactly 3 premium multiple-choice questions (MCQs) as a JSON array.\n\n"
                "Strict Rules:\n"
                "1. Each question must test comprehension of important concepts, definitions, processes, or relationships.\n"
                "2. The distractors (wrong answers) must be highly plausible, grammatically consistent with the correct answer, and not obviously wrong or joke answers.\n"
                "3. Ignore corrupted text, OCR symbols, headers, page numbers, citations, or references.\n"
                "4. Each item in the JSON array must contain:\n"
                "   - 'question_text': The clear, concise question.\n"
                "   - 'choices': An array of exactly 4 choices (strings).\n"
                "   - 'correct_answer': The correct choice (matching one of the choices exactly).\n"
                "   - 'explanation': A detailed explanation of why that choice is correct.\n"
                "5. Format the output STRICTLY as a valid JSON array of objects. Return absolutely no other text, markdown formatting, or explanations.\n\n"
                f"Document Context:\n{context}\n\n"
                "Format: [{\"question_text\": \"...\", \"choices\": [\"A\",\"B\",\"C\",\"D\"], \"correct_answer\": \"A\", \"explanation\": \"...\"}]"
            )
            
            result = await self._call_gemini_json(prompt)
            if result and isinstance(result, list):
                from app.services.ai_validator import AIValidator
                for item in result:
                    q_text = item.get("question_text", "").strip()
                    choices = item.get("choices", [])
                    correct = item.get("correct_answer", "").strip()
                    explanation = item.get("explanation", "").strip()
                    
                    choices_clean = [c.strip() for c in choices]
                    is_valid, err_reason = AIValidator.validate_quiz_question(
                        q_text, choices_clean, correct, explanation
                    )
                    
                    if not is_valid:
                        logger.warning(f"Quiz question validation failed: {err_reason}. Question: {q_text}")
                        continue
                        
                    q = QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=q_text,
                        choices=choices_clean,
                        correct_answer=correct,
                        explanation=explanation
                    )
                    self.db.add(q)
                    question_count += 1
                    
                    if question_count >= 3:
                        break

        # Fallback if quiz is empty or incomplete
        if question_count < 3:
            logger.info("Falling back to local fallback generator for quiz")
            needed = 3 - question_count
            fallback_qs = generate_local_quiz(context, quiz.id, limit=needed)
            for q in fallback_qs:
                self.db.add(q)
                question_count += 1
                
        await self.db.flush()
        
        # Reload with relations
        query_reload = select(Quiz).where(Quiz.id == quiz.id).options(selectinload(Quiz.questions))
        res = await self.db.execute(query_reload)
        return res.scalar_one()

    async def generate_note_quiz(self, note_id: uuid.UUID, workspace_id: uuid.UUID) -> Quiz:
        """Create a multiple-choice quiz from workspace document chunks using Gemini LLM with JSON output."""
        context = await self._get_workspace_context(workspace_id, note_id, limit=15)
        return await self._generate_quiz_from_context_str(note_id, context)

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
        return await self._generate_flashcards_from_context_str(note_id, context)

    async def generate_quiz_with_context(self, note_id: uuid.UUID, context: str) -> Quiz:
        """Generate a quiz using pre-fetched context text. Used by KnowledgeService endpoints."""
        return await self._generate_quiz_from_context_str(note_id, context)

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
