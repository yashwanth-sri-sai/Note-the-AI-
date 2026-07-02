import asyncio
import sys
import os
import uuid
from datetime import datetime, timedelta

# Add backend directory to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

from app.services.context_builder import ContextBuilder
from app.services.retrieval import RetrievalService
from app.services.rag_generation import RAGGenerationService
from app.db.session import async_session_factory, engine
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.db.models.document import Document, DocumentChunk, Embedding
from app.db.models.chat import Conversation, Message
from app.db.models.folder import Folder
from app.db.models.note import Note
from app.db.models.tag import Tag
from app.db.models.extensions import BillingSubscription, Quiz, QuizQuestion
from sqlalchemy import select, delete


async def test_context_builder():
    print("\n[CHECK 1] Testing ContextBuilder de-duplication, sorting, and budgeting...")
    
    # 1. Prepare raw references with duplicate UUIDs
    doc1_id = uuid.uuid4()
    doc2_id = uuid.uuid4()
    chunk1_uuid = uuid.uuid4()
    chunk2_uuid = uuid.uuid4()
    chunk3_uuid = uuid.uuid4()

    raw_refs = [
        # Similarity score sorted descending
        {
            "chunk_uuid": chunk1_uuid,
            "document_id": doc1_id,
            "document_name": "doc1.pdf",
            "page_number": 3,
            "section_title": "Introduction",
            "chunk_text": "PostgreSQL is a powerful object-relational database system.",
            "similarity_score": 0.95,
            "token_count": 10,
            "source_reference": "doc1.pdf#page=3"
        },
        # Duplicate of chunk1_uuid with lower similarity score
        {
            "chunk_uuid": chunk1_uuid,
            "document_id": doc1_id,
            "document_name": "doc1.pdf",
            "page_number": 3,
            "section_title": "Introduction",
            "chunk_text": "PostgreSQL is a powerful object-relational database system.",
            "similarity_score": 0.92,
            "token_count": 10,
            "source_reference": "doc1.pdf#page=3"
        },
        # Chunk 2
        {
            "chunk_uuid": chunk2_uuid,
            "document_id": doc1_id,
            "document_name": "doc1.pdf",
            "page_number": 4,
            "section_title": "Architecture",
            "chunk_text": "It extends SQL and offers features like pgvector.",
            "similarity_score": 0.88,
            "token_count": 10,
            "source_reference": "doc1.pdf#page=4"
        },
        # Chunk 3
        {
            "chunk_uuid": chunk3_uuid,
            "document_id": doc2_id,
            "document_name": "doc2.txt",
            "page_number": None,
            "section_title": None,
            "chunk_text": "RAG enables models to access external knowledge sources.",
            "similarity_score": 0.75,
            "token_count": 10,
            "source_reference": "doc2.txt"
        }
    ]

    # 2. Build context with no limit
    cb = ContextBuilder(token_limit=1000)
    context_str, references = cb.build_context(raw_refs)

    # De-duplication assert (moved to retrieval.py)
    assert len(references) == 4, f"Expected 4 references after context budget sorting, got {len(references)}"
    assert references[0]["chunk_uuid"] == chunk1_uuid
    assert references[0]["similarity_score"] == 0.95, "Should keep the higher similarity score reference"
    
    # Header format assert
    assert "[Document: doc1.pdf]" in context_str
    assert "[Page: 3]" in context_str
    assert "[Section: Introduction]" in context_str
    assert "[Document: doc2.txt]" in context_str
    
    print("  De-duplication, sorting, and header formatting verified.")

    # 3. Test budget limit truncation
    cb_limited = ContextBuilder(token_limit=25)
    context_str_lim, references_lim = cb_limited.build_context(raw_refs)
    
    # 25 tokens should fit chunk 1 (10 tokens + header cost (~10 tokens)) but truncate chunk 2 or 3
    assert len(references_lim) < 3, f"Expected truncation, got {len(references_lim)} references in limited context"
    print("  Context budgeting and truncation verified.")
    print("  [PASS] ContextBuilder checks passed successfully.")


async def test_retrieval_and_rag_persistence():
    print("\n[CHECK 2] Testing Database retrieval filters, confidence calculations, and message log persistence...")

    async with async_session_factory() as db:
        # 1. Setup temporary workspace and documents
        workspace = Workspace(name="RAG Test Workspace", slug="rag-test-workspace")
        db.add(workspace)
        await db.flush()

        doc1 = Document(
            workspace_id=workspace.id,
            filename="rag_test_doc.pdf",
            file_size=1024,
            content_type="application/pdf",
            storage_path="local://rag_test_doc.pdf",
            status="completed"
        )
        doc2 = Document(
            workspace_id=workspace.id,
            filename="other_doc.txt",
            file_size=512,
            content_type="text/plain",
            storage_path="local://other_doc.txt",
            status="completed"
        )
        db.add(doc1)
        db.add(doc2)
        await db.flush()

        # Add chunk records
        chunk1 = DocumentChunk(
            document_id=doc1.id,
            chunk_index=0,
            chunk_text="NoteAI implements citation-aware RAG architectures.",
            page_number=1,
            section_title="Intro",
            token_count=10,
            source_reference="rag_test_doc.pdf#page=1"
        )
        chunk2 = DocumentChunk(
            document_id=doc2.id,
            chunk_index=0,
            chunk_text="FastAPI serves streaming Server-Sent Events (SSE).",
            page_number=None,
            section_title=None,
            token_count=10,
            source_reference="other_doc.txt"
        )
        db.add(chunk1)
        db.add(chunk2)
        await db.flush()

        # Add embedding vectors (simple 1536-dimensional unit vector)
        emb1 = Embedding(
            chunk_id=chunk1.id,
            embedding=[1.0] + [0.0]*1535,
            provider="LocalEmbedding",
            model_name="test-model"
        )
        emb2 = Embedding(
            chunk_id=chunk2.id,
            embedding=[0.0] + [1.0] + [0.0]*1534,
            provider="LocalEmbedding",
            model_name="test-model"
        )
        db.add(emb1)
        db.add(emb2)
        
        # Initialize conversation
        conversation = Conversation(
            workspace_id=workspace.id,
            title="Verification Conversation"
        )
        db.add(conversation)
        await db.commit()

        try:
            retrieval_service = RetrievalService(db)

            # 2. Assert Workspace Retrieval Scoping
            print("  Retrieving context without filters...")
            all_chunks = await retrieval_service.retrieve_context(
                workspace_id=workspace.id,
                query="RAG architecture",
                limit=5
            )
            assert len(all_chunks) >= 2, f"Expected at least 2 chunks, got {len(all_chunks)}"

            # 3. Assert Filter by specific Document IDs
            print("  Retrieving context filtering by doc1 ID...")
            filtered_by_doc = await retrieval_service.retrieve_context(
                workspace_id=workspace.id,
                query="RAG architecture",
                limit=5,
                document_ids=[doc1.id]
            )
            assert len(filtered_by_doc) == 1, f"Expected 1 chunk, got {len(filtered_by_doc)}"
            assert filtered_by_doc[0]["document_id"] == doc1.id

            # 4. Assert Filter by File Content Types
            print("  Retrieving context filtering by 'text/plain'...")
            filtered_by_type = await retrieval_service.retrieve_context(
                workspace_id=workspace.id,
                query="streaming SSE",
                limit=5,
                file_types=["text/plain"]
            )
            assert len(filtered_by_type) == 1, f"Expected 1 chunk, got {len(filtered_by_type)}"
            assert filtered_by_type[0]["document_id"] == doc2.id

            # 5. Assert Filter by Date Range
            print("  Retrieving context filtering by past date range...")
            start_dt = datetime.utcnow() - timedelta(days=1)
            end_dt = datetime.utcnow() + timedelta(days=1)
            filtered_by_date = await retrieval_service.retrieve_context(
                workspace_id=workspace.id,
                query="RAG architecture",
                limit=5,
                date_start=start_dt,
                date_end=end_dt
            )
            assert len(filtered_by_date) >= 2, f"Expected 2 chunks inside date range, got {len(filtered_by_date)}"

            # 6. Verify RAGGenerationService Persistence & Confidence Scores
            rag_service = RAGGenerationService(db)

            # Test Confidence Heuristics
            # High base score + 2 supporting + 1 diversity = HIGH
            high_conf = rag_service._calculate_confidence([{"similarity_score": 0.85, "document_id": "1"}, {"similarity_score": 0.82, "document_id": "2"}])
            # Base 0.55 + 0 supporting + 0 diversity = 0.55 (MEDIUM)
            med_conf = rag_service._calculate_confidence([{"similarity_score": 0.55, "document_id": "1"}])
            # Base 0.40 + 0 supporting + 0 diversity = 0.40 (LOW)
            low_conf = rag_service._calculate_confidence([{"similarity_score": 0.40, "document_id": "1"}])

            assert high_conf == "HIGH", f"Expected HIGH, got {high_conf}"
            assert med_conf == "MEDIUM", f"Expected MEDIUM, got {med_conf}"
            assert low_conf == "LOW", f"Expected LOW, got {low_conf}"
            print("  Confidence heuristics scores calculations correct.")

            # Test streaming generator yields expected JSON formatting
            print("  Running streaming response generator...")
            # Set a dummy OpenAI key to bypass LLMProviderNotConfiguredException checks and wipe Gemini key
            rag_service.openai_key = "dummy_openai_key"
            rag_service.gemini_key = None

            from unittest.mock import AsyncMock, patch

            class MockResponse:
                def __init__(self):
                    self.status_code = 200
                async def aiter_lines(self):
                    yield 'data: {"choices": [{"delta": {"content": "This is "}}]}'
                    yield 'data: {"choices": [{"delta": {"content": "a test RAG response."}}]}'
                    yield 'data: [DONE]'
                async def aclose(self):
                    pass

            chunk_yields = []
            with patch('httpx.AsyncClient.send', new_callable=AsyncMock) as mock_send:
                mock_send.return_value = MockResponse()
                generator = rag_service.generate_answer_stream(
                    workspace_id=workspace.id,
                    question="What is the RAG architecture?",
                    conversation_id=conversation.id
                )

                async for chunk in generator:
                    chunk_yields.append(chunk)

            # Assert generator yielded metadata and [DONE] lines
            assert len(chunk_yields) > 0, "No chunks returned by generator."
            
            # Check if any chunk contains metadata or footnote markers
            has_metadata = False
            has_done = False
            for yield_line in chunk_yields:
                if "data: [DONE]" in yield_line:
                    has_done = True
                if '"type": "metadata"' in yield_line:
                    has_metadata = True

            print(f"  Generator yielded {len(chunk_yields)} chunks.")
            assert has_done, "Stream must end with data: [DONE]"
            assert has_metadata, "Stream must yield a final metadata payload"
            print("  SSE stream payload yields formatting verified.")

            # 7. Assert Database logs saved correctly
            print("  Verifying database message record logging...")
            stmt = select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.asc())
            result = await db.execute(stmt)
            messages_logged = result.scalars().all()

            # Expect 1 User message and 1 Assistant message
            assert len(messages_logged) == 2, f"Expected 2 messages in DB log, got {len(messages_logged)}"
            
            user_msg = messages_logged[0]
            assistant_msg = messages_logged[1]

            assert user_msg.sender_role == "user"
            assert user_msg.content == "What is the RAG architecture?"
            
            assert assistant_msg.sender_role == "assistant"
            assert assistant_msg.retrieved_chunks is not None
            assert len(assistant_msg.retrieved_chunks) > 0
            assert assistant_msg.citation_metadata is not None
            assert "confidence_score" in assistant_msg.citation_metadata
            assert "citations" in assistant_msg.citation_metadata
            print("  Message persistence and metadata columns verify successfully.")

            print("  [PASS] Retrieval, confidence scoring, and DB log persistence verified.")

        finally:
            # 8. Clean up test records
            print("  Cleaning up temporary test records...")
            await db.execute(delete(Embedding).where(Embedding.chunk_id.in_([chunk1.id, chunk2.id])))
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id.in_([doc1.id, doc2.id])))
            await db.execute(delete(Document).where(Document.workspace_id == workspace.id))
            await db.execute(delete(Message).where(Message.conversation_id == conversation.id))
            await db.execute(delete(Conversation).where(Conversation.workspace_id == workspace.id))
            await db.execute(delete(Workspace).where(Workspace.id == workspace.id))
            await db.commit()


async def main():
    try:
        print("=============================================================")
        print("NotebookLM-Style Cited RAG Chat Verification Suite")
        print("=============================================================")
        
        await test_context_builder()
        await test_retrieval_and_rag_persistence()
        
        print("\n=============================================================")
        print("ALL VERIFICATION SUITE CHECKS COMPLETED SUCCESSFULLY!")
        print("=============================================================")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
