"""add product_code

Revision ID: 20260129_0002
Revises: 20260129_0001
Create Date: 2026-01-29 11:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260129_0002"
down_revision = "20260129_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add product_code column to product table
    op.add_column('product', sa.Column('product_code', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove product_code column
    op.drop_column('product', 'product_code')
