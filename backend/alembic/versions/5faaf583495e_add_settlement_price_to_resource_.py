"""add_settlement_price_to_resource_inventory"""

revision = '5faaf583495e'
down_revision = '7a0e115f36d7'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('resource_inventory', sa.Column('settlement_price', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('resource_inventory', 'settlement_price')
