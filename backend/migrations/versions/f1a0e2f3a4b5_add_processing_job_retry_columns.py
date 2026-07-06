"""add_processing_job_retry_columns

Revision ID: f1a0e2f3a4b5
Revises: f9d0e1f2a3b4
Create Date: 2026-07-06 14:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a0e2f3a4b5'
down_revision = 'f9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('processing_jobs', sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('processing_jobs', sa.Column('processing_started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('processing_jobs', sa.Column('processing_completed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('processing_jobs', 'processing_completed_at')
    op.drop_column('processing_jobs', 'processing_started_at')
    op.drop_column('processing_jobs', 'retry_count')
