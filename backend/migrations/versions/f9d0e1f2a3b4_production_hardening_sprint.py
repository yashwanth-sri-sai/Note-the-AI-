"""production_hardening_sprint

Revision ID: f9d0e1f2a3b4
Revises: f8c9d0e1f2a3
Create Date: 2026-06-22 19:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f9d0e1f2a3b4'
down_revision = 'f8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Modify ai_requests
    op.add_column('ai_requests', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_ai_requests_user_id', 'ai_requests', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_ai_requests_user', 'ai_requests', ['user_id'])

    # 2. Modify token_usage
    op.add_column('token_usage', sa.Column('user_id', sa.UUID(), nullable=True))
    op.add_column('token_usage', sa.Column('provider', sa.String(length=50), nullable=True))
    op.add_column('token_usage', sa.Column('model', sa.String(length=100), nullable=True))
    op.add_column('token_usage', sa.Column('estimated_cost', sa.Float(), server_default='0.0', nullable=True))
    op.create_foreign_key('fk_token_usage_user_id', 'token_usage', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_token_usage_user', 'token_usage', ['user_id'])

    # 3. Create latency_metrics
    op.create_table(
        'latency_metrics',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('retrieval_latency_ms', sa.Float(), nullable=True),
        sa.Column('llm_latency_ms', sa.Float(), nullable=True),
        sa.Column('total_response_ms', sa.Float(), nullable=True),
        sa.Column('embedding_latency_ms', sa.Float(), nullable=True),
        sa.Column('document_processing_ms', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_latency_metrics_workspace', 'latency_metrics', ['workspace_id'])
    op.create_index('idx_latency_metrics_user', 'latency_metrics', ['user_id'])
    op.create_index('idx_latency_metrics_created_at', 'latency_metrics', ['created_at'])

    # 4. Enable RLS on ai_requests, token_usage, and latency_metrics
    op.execute("ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE latency_metrics ENABLE ROW LEVEL SECURITY")

    # 5. Create RLS policies
    # Access policies scoped strictly by user's workspace membership
    op.execute("""
        CREATE POLICY ai_requests_policy ON ai_requests
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    op.execute("""
        CREATE POLICY token_usage_policy ON token_usage
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)

    op.execute("""
        CREATE POLICY latency_metrics_policy ON latency_metrics
        FOR ALL TO authenticated
        USING (
            workspace_id IN (
                SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()
            )
        )
    """)


def downgrade() -> None:
    # 1. Drop RLS policies
    op.execute("DROP POLICY IF EXISTS latency_metrics_policy ON latency_metrics")
    op.execute("DROP POLICY IF EXISTS token_usage_policy ON token_usage")
    op.execute("DROP POLICY IF EXISTS ai_requests_policy ON ai_requests")

    # 2. Disable RLS
    op.execute("ALTER TABLE latency_metrics DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE token_usage DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE ai_requests DISABLE ROW LEVEL SECURITY")

    # 3. Drop latency_metrics table
    op.drop_index('idx_latency_metrics_created_at', table_name='latency_metrics')
    op.drop_index('idx_latency_metrics_user', table_name='latency_metrics')
    op.drop_index('idx_latency_metrics_workspace', table_name='latency_metrics')
    op.drop_table('latency_metrics')

    # 4. Modify token_usage table
    op.drop_index('idx_token_usage_user', table_name='token_usage')
    op.drop_constraint('fk_token_usage_user_id', 'token_usage', type_='foreignkey')
    op.drop_column('token_usage', 'estimated_cost')
    op.drop_column('token_usage', 'model')
    op.drop_column('token_usage', 'provider')
    op.drop_column('token_usage', 'user_id')

    # 5. Modify ai_requests table
    op.drop_index('idx_ai_requests_user', table_name='ai_requests')
    op.drop_constraint('fk_ai_requests_user_id', 'ai_requests', type_='foreignkey')
    op.drop_column('ai_requests', 'user_id')
