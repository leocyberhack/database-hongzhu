"""add order_resource status remarks and mid_disputed"""

revision = '20260204_0001'
down_revision = '20260203_0001'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('order_resource', sa.Column('issued_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('verified_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('reserved_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_unverified_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_unreserved_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_verified_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_reserved_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('completed_remark', sa.Text(), nullable=True))
    op.add_column('order_resource', sa.Column('disputed_remark', sa.Text(), nullable=True))

    op.add_column('order_resource', sa.Column('is_mid_disputed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('mid_disputed_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('mid_disputed_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('mid_disputed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order_resource', sa.Column('mid_disputed_remark', sa.Text(), nullable=True))

    op.alter_column('order_resource', 'is_mid_disputed', server_default=None)


def downgrade() -> None:
    op.drop_column('order_resource', 'mid_disputed_remark')
    op.drop_column('order_resource', 'mid_disputed_at')
    op.drop_column('order_resource', 'mid_disputed_amount')
    op.drop_column('order_resource', 'mid_disputed_qty')
    op.drop_column('order_resource', 'is_mid_disputed')

    op.drop_column('order_resource', 'disputed_remark')
    op.drop_column('order_resource', 'completed_remark')
    op.drop_column('order_resource', 'refund_reserved_remark')
    op.drop_column('order_resource', 'refund_verified_remark')
    op.drop_column('order_resource', 'refund_unreserved_remark')
    op.drop_column('order_resource', 'refund_unverified_remark')
    op.drop_column('order_resource', 'reserved_remark')
    op.drop_column('order_resource', 'verified_remark')
    op.drop_column('order_resource', 'issued_remark')
