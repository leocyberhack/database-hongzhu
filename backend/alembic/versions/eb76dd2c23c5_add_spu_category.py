"""add spu category"""

revision = 'eb76dd2c23c5'
down_revision = '0bc9430cc277'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('spu', sa.Column('category', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('spu', 'category')
