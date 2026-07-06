"""merge multiple heads

Revision ID: f0c64f7e4f37
Revises: ('5d6f333629c8', 'f1a0e2f3a4b5')
Create Date: 2026-07-06 23:31:07.247770

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f0c64f7e4f37'
down_revision = ('5d6f333629c8', 'f1a0e2f3a4b5')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
