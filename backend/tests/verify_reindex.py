import asyncio
import sys
import os
import uuid
from datetime import datetime
from sqlalchemy import select, delete
from unittest.mock import AsyncMock, patch

# Add backend directory to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

from app.main import app
from app.db.session import async_session_factory, engine
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.db.models.document import Document, DocumentChunk, Embedding
from app.api.deps import get_current_user, get_current_workspace_id, get_db

async def verify_reindex_endpoint():
    print("\n[CHECK] Testing Document Reindexing API Endpoint...")

    async with async_session_factory() as db:
        # 1. Setup temporary workspace and user
        # Clean up any leftover records from a previous failed run
        await db.execute(delete(Workspace).where(Workspace.slug == "reindex-test-workspace"))
        await db.execute(delete(User).where(User.email == "reindex_verify_user@example.com"))
        await db.commit()

        user = User(
            id=uuid.uuid4(),
            email="reindex_verify_user@example.com",
            name="Reindex Verify User"
        )
        db.add(user)
        
        workspace = Workspace(name="Reindex Test Workspace", slug="reindex-test-workspace")
        db.add(workspace)
        await db.flush()

        # 2. Setup document, chunk, and dummy embedding
        doc = Document(
            workspace_id=workspace.id,
            filename="reindex_test_doc.pdf",
            file_size=1024,
            content_type="application/pdf",
            storage_path="local://reindex_test_doc.pdf",
            status="READY",
            created_by=user.id
        )
        db.add(doc)
        await db.flush()

        chunk = DocumentChunk(
            document_id=doc.id,
            chunk_index=0,
            chunk_text="This is a test chunk that will be re-embedded.",
            page_number=1,
            section_title="Intro",
            token_count=10,
            source_reference="reindex_test_doc.pdf#page=1"
        )
        db.add(chunk)
        await db.flush()

        old_emb = Embedding(
            chunk_id=chunk.id,
            embedding=[0.2] * 1536,
            provider="GeminiEmbeddingProvider",
            model_name="gemini-embedding-2"
        )
        db.add(old_emb)
        await db.commit()

        # 3. Apply FastAPI dependency overrides
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_current_workspace_id] = lambda: workspace.id

        # 4. Mock the active embedding provider to return a different vector
        mock_vector = [0.8] * 1536
        mock_provider = AsyncMock()
        mock_provider.get_embeddings = AsyncMock(return_value=[mock_vector])
        mock_provider.__class__.__name__ = "MockGeminiEmbeddingProvider"
        mock_provider.model = "gemini-embedding-2"

        from httpx import AsyncClient, ASGITransport

        try:
            with patch("app.api.v1.endpoints.documents.get_embedding_provider", return_value=mock_provider):
                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
                    print("  Sending POST request to /api/v1/documents/{document_id}/reindex...")
                    response = await client.post(
                        f"/api/v1/documents/{doc.id}/reindex",
                        headers={"X-Workspace-ID": str(workspace.id)}
                    )
                    
                    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
                    res_data = response.json()
                    assert res_data["id"] == str(doc.id)
                    assert res_data["status"] == "pending", f"Expected 'pending', got {res_data['status']}"
                    print("  Endpoint returned 200 with status='pending'.")

                    # Wait for background task execution (yield control to event loop)
                    print("  Waiting for background tasks to complete...")
                    for _ in range(20):
                        await asyncio.sleep(0.2)
                        # Fetch document status from database
                        await db.rollback()  # clear transaction cache
                        stmt = select(Document).where(Document.id == doc.id)
                        res = await db.execute(stmt)
                        current_doc = res.scalar_one()
                        await db.refresh(current_doc)
                        if current_doc.status in ("failed", "READY", "FAILED"):
                            break
                    
                    assert current_doc.status == "READY", f"Background pipeline failed, status={current_doc.status}"
                    print("  Background reindexing completed successfully.")

                    # Verify embedding was replaced
                    stmt_emb = select(Embedding).where(Embedding.chunk_id == chunk.id)
                    res_emb = await db.execute(stmt_emb)
                    embeddings = res_emb.scalars().all()
                    
                    assert len(embeddings) == 1, f"Expected 1 embedding, got {len(embeddings)}"
                    assert embeddings[0].embedding[0] == 0.8, f"Expected first dimension to be 0.8, got {embeddings[0].embedding[0]}"
                    assert embeddings[0].provider == "MockGeminiEmbeddingProvider"
                    assert embeddings[0].model_name == "gemini-embedding-2"
                    print("  Vector embedding successfully replaced with the new provider outputs.")
                    print("  [PASS] Document Reindexing API endpoint verified.")

        finally:
            # 5. Clean up dependencies overrides
            app.dependency_overrides.clear()

            # 6. Clean up database records
            print("  Cleaning up temporary test records...")
            await db.execute(delete(Embedding).where(Embedding.chunk_id == chunk.id))
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
            await db.execute(delete(Document).where(Document.id == doc.id))
            await db.execute(delete(Workspace).where(Workspace.id == workspace.id))
            await db.execute(delete(User).where(User.id == user.id))
            await db.commit()

async def main():
    try:
        await verify_reindex_endpoint()
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
