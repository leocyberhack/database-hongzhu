"""resource_inventory_log"""

revision = '9c3b1f7b6c2a'
down_revision = '4428bc5144ef'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        'resource_inventory_log',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('supplier_resource_id', sa.BigInteger(), sa.ForeignKey('supplier_resource.id', ondelete='CASCADE'), nullable=False),
        sa.Column('inventory_date', sa.Date(), nullable=False),
        sa.Column('change_type', sa.String(), nullable=False),
        sa.Column('before_qty', sa.JSON(), nullable=False),
        sa.Column('after_qty', sa.JSON(), nullable=False),
        sa.Column('related_order_id', sa.BigInteger(), sa.ForeignKey('order.id', ondelete='SET NULL'), nullable=True),
        sa.Column('operator', sa.String(), nullable=True),
        sa.Column('operated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('remark', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('resource_inventory_log')
