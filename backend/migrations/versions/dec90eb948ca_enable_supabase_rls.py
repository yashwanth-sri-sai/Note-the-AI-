"""enable_supabase_rls

Revision ID: dec90eb948ca
Revises: 4a5b6c7d8e9f
Create Date: 2026-06-22 17:12:44.603408

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dec90eb948ca'
down_revision = '4a5b6c7d8e9f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Enable RLS on all tables
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE folders ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE notes ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tags ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE documents ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE conversations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE messages ENABLE ROW LEVEL SECURITY")

    # 2. Users policy
    op.execute("""
        CREATE POLICY users_policy ON users
        FOR ALL TO authenticated
        USING (id = auth.uid())
    """)

    # 3. Workspace Members policy
    op.execute("""
        CREATE POLICY workspace_members_policy ON workspace_members
        FOR ALL TO authenticated
        USING (
            user_id = auth.uid() OR
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    # 4. Workspaces policy
    op.execute("""
        CREATE POLICY workspaces_policy ON workspaces
        FOR ALL TO authenticated
        USING (
            id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    # 5. Scoped entities policies (scoping access by workspace membership)
    op.execute("""
        CREATE POLICY folders_policy ON folders
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    op.execute("""
        CREATE POLICY notes_policy ON notes
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    op.execute("""
        CREATE POLICY tags_policy ON tags
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    op.execute("""
        CREATE POLICY documents_policy ON documents
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    op.execute("""
        CREATE POLICY conversations_policy ON conversations
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    # 6. Dependent entities policies
    op.execute("""
        CREATE POLICY chunks_policy ON document_chunks
        FOR ALL TO authenticated
        USING (
            document_id IN (
                SELECT d.id FROM documents d WHERE d.workspace_id IN (
                    SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
                )
            )
        )
    """)

    op.execute("""
        CREATE POLICY messages_policy ON messages
        FOR ALL TO authenticated
        USING (
            conversation_id IN (
                SELECT c.id FROM conversations c WHERE c.workspace_id IN (
                    SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
                )
            )
        )
    """)


def downgrade() -> None:
    # 1. Drop policies
    op.execute("DROP POLICY IF EXISTS users_policy ON users")
    op.execute("DROP POLICY IF EXISTS workspace_members_policy ON workspace_members")
    op.execute("DROP POLICY IF EXISTS workspaces_policy ON workspaces")
    op.execute("DROP POLICY IF EXISTS folders_policy ON folders")
    op.execute("DROP POLICY IF EXISTS notes_policy ON notes")
    op.execute("DROP POLICY IF EXISTS tags_policy ON tags")
    op.execute("DROP POLICY IF EXISTS documents_policy ON documents")
    op.execute("DROP POLICY IF EXISTS chunks_policy ON document_chunks")
    op.execute("DROP POLICY IF EXISTS conversations_policy ON conversations")
    op.execute("DROP POLICY IF EXISTS messages_policy ON messages")

    # 2. Disable RLS
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE folders DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE notes DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tags DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE documents DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE conversations DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE messages DISABLE ROW LEVEL SECURITY")
