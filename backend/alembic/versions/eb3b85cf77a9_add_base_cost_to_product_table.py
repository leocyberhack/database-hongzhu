"""Add base_cost to product table"""

revision = 'eb3b85cf77a9'
down_revision = '2a44ada34b94'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('product', sa.Column('base_cost', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('product', 'base_cost')
