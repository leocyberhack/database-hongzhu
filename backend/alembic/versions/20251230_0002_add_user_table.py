"""add user table"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251230_0002"
down_revision = "20250101_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # User table already created in 20250101_0001_initial.py
    # This migration is now a no-op to avoid duplicate table error
    pass


def downgrade() -> None:
    # No-op since we didn't create anything
    pass
