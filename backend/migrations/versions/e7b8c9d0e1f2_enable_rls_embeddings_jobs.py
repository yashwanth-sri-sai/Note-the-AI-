"""enable_rls_embeddings_jobs

Revision ID: e7b8c9d0e1f2
Revises: bc1107f3293e
Create Date: 2026-06-22 18:22:11.102200

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7b8c9d0e1f2'
down_revision = 'bc1107f3293e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Enable RLS on embeddings and processing_jobs
    op.execute("ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY")

    # 2. Create policy for embeddings table
    op.execute("""
        CREATE POLICY embeddings_policy ON embeddings
        FOR ALL TO authenticated
        USING (
            chunk_id IN (
                SELECT c.id FROM document_chunks c WHERE c.document_id IN (
                    SELECT d.id FROM documents d WHERE d.workspace_id IN (
                        SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
                    )
                )
            )
        )
    """)

    # 3. Create policy for processing_jobs table
    op.execute("""
        CREATE POLICY processing_jobs_policy ON processing_jobs
        FOR ALL TO authenticated
        USING (
            document_id IN (
                SELECT d.id FROM documents d WHERE d.workspace_id IN (
                    SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
                )
            )
        )
    """)


def downgrade() -> None:
    # 1. Drop policies
    op.execute("DROP POLICY IF EXISTS embeddings_policy ON embeddings")
    op.execute("DROP POLICY IF EXISTS processing_jobs_policy ON processing_jobs")

    # 2. Disable RLS
    op.execute("ALTER TABLE embeddings DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE processing_jobs DISABLE ROW LEVEL SECURITY")
