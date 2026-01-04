"""remove supplier_type column

Revision ID: 20251231_0003
Revises: 20251230_0002_add_user_table
Create Date: 2025-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251231_0003'
down_revision: Union[str, None] = '20251230_0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove supplier_type column from supplier table
    op.drop_column('supplier', 'supplier_type')


def downgrade() -> None:
    # Add supplier_type column back
    op.add_column('supplier', sa.Column('supplier_type', sa.String(), nullable=True))
