"""add missing product columns"""

revision = '315f8df3cdac'
down_revision = '315f8df3cdab'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Add category and suggested_price columns to product table
    op.add_column('product', sa.Column('category', sa.String(), nullable=True))
    op.add_column('product', sa.Column('suggested_price', sa.Numeric(precision=12, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('product', 'suggested_price')
    op.drop_column('product', 'category')
