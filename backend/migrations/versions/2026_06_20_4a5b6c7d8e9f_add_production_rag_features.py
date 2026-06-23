"""add production rag features

Revision ID: 4a5b6c7d8e9f
Revises: 2a3b4c5d6e7f
Create Date: 2026-06-20 19:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4a5b6c7d8e9f'
down_revision = '2a3b4c5d6e7f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add columns to document_chunks
    op.add_column('document_chunks', sa.Column('chunk_uuid', sa.UUID(), nullable=True))
    op.add_column('document_chunks', sa.Column('page_number', sa.Integer(), nullable=True))
    op.add_column('document_chunks', sa.Column('section_title', sa.String(length=255), nullable=True))
    op.add_column('document_chunks', sa.Column('start_offset', sa.Integer(), nullable=True))
    op.add_column('document_chunks', sa.Column('end_offset', sa.Integer(), nullable=True))
    op.add_column('document_chunks', sa.Column('token_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('document_chunks', sa.Column('source_reference', sa.String(length=512), nullable=True))

    # Populate existing rows with random chunk_uuids (if any exist) to enforce UNIQUE constraint
    op.execute("UPDATE document_chunks SET chunk_uuid = uuid_generate_v4() WHERE chunk_uuid IS NULL")
    
    # Enforce NOT NULL and UNIQUE on chunk_uuid
    op.alter_column('document_chunks', 'chunk_uuid', nullable=False)
    op.create_unique_constraint('uq_document_chunks_uuid', 'document_chunks', ['chunk_uuid'])
    op.create_index('idx_document_chunks_uuid', 'document_chunks', ['chunk_uuid'])

    # 2. Create ai_requests table
    op.create_table(
        'ai_requests',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('request_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_ai_requests_workspace', 'ai_requests', ['workspace_id'])

    # 3. Create token_usage table
    op.create_table(
        'token_usage',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_token_usage_workspace', 'token_usage', ['workspace_id'])


def downgrade() -> None:
    # Drop tables
    op.drop_table('token_usage')
    op.drop_table('ai_requests')

    # Drop columns from document_chunks
    op.drop_constraint('uq_document_chunks_uuid', 'document_chunks', type_='unique')
    op.drop_index('idx_document_chunks_uuid', table_name='document_chunks')
    op.drop_column('document_chunks', 'source_reference')
    op.drop_column('document_chunks', 'token_count')
    op.drop_column('document_chunks', 'end_offset')
    op.drop_column('document_chunks', 'start_offset')
    op.drop_column('document_chunks', 'section_title')
    op.drop_column('document_chunks', 'page_number')
    op.drop_column('document_chunks', 'chunk_uuid')
