"""create_api_request_logs

Revision ID: f8c9d0e1f2a3
Revises: e7b8c9d0e1f2
Create Date: 2026-06-22 18:25:22.502200

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f8c9d0e1f2a3'
down_revision = 'e7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create api_request_logs table
    op.create_table(
        'api_request_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('workspace_id', sa.UUID(), nullable=True),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('client_ip', sa.String(length=45), nullable=True),
        sa.Column('retrieval_latency_ms', sa.Float(), nullable=True),
        sa.Column('llm_latency_ms', sa.Float(), nullable=True),
        sa.Column('total_response_ms', sa.Float(), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Add indexes for performance optimization
    op.create_index(op.f('ix_api_request_logs_user_id'), 'api_request_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_api_request_logs_workspace_id'), 'api_request_logs', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_api_request_logs_endpoint'), 'api_request_logs', ['endpoint'], unique=False)
    op.create_index(op.f('ix_api_request_logs_created_at'), 'api_request_logs', ['created_at'], unique=False)

    # 3. Enable RLS on api_request_logs
    op.execute("ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY")

    # 4. Create RLS policy for api_request_logs
    # Users can view their own request logs or logs matching workspaces they belong to
    op.execute("""
        CREATE POLICY api_request_logs_policy ON api_request_logs
        FOR ALL TO authenticated
        USING (
            user_id = auth.uid() OR
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)


def downgrade() -> None:
    # 1. Drop RLS policy
    op.execute("DROP POLICY IF EXISTS api_request_logs_policy ON api_request_logs")

    # 2. Disable RLS
    op.execute("ALTER TABLE api_request_logs DISABLE ROW LEVEL SECURITY")

    # 3. Drop indexes
    op.drop_index(op.f('ix_api_request_logs_created_at'), table_name='api_request_logs')
    op.drop_index(op.f('ix_api_request_logs_endpoint'), table_name='api_request_logs')
    op.drop_index(op.f('ix_api_request_logs_workspace_id'), table_name='api_request_logs')
    op.drop_index(op.f('ix_api_request_logs_user_id'), table_name='api_request_logs')

    # 4. Drop table
    op.drop_table('api_request_logs')
