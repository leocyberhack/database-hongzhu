"""Add commission_rate to channel table"""

revision = '2a44ada34b94'
down_revision = '087c696c02b2'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('channel', sa.Column('commission_rate', sa.Numeric(5, 4), nullable=True))


def downgrade() -> None:
    op.drop_column('channel', 'commission_rate')
