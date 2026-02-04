"""add order_resource travel_date and status fields"""

revision = '20260203_0001'
down_revision = '9c3b1f7b6c2a'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('order_resource', sa.Column('travel_date', sa.Date(), nullable=True))

    op.add_column('order_resource', sa.Column('is_issued', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('issued_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('issued_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('issued_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('verified_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('verified_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_reserved', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('reserved_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('reserved_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('reserved_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_refund_unverified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('refund_unverified_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_unverified_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('refund_unverified_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_refund_unreserved', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('refund_unreserved_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_unreserved_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('refund_unreserved_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_refund_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('refund_verified_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_verified_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('refund_verified_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_refund_reserved', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('refund_reserved_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('refund_reserved_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('refund_reserved_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('completed_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('completed_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('order_resource', sa.Column('is_disputed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('order_resource', sa.Column('disputed_qty', sa.Integer(), nullable=True))
    op.add_column('order_resource', sa.Column('disputed_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order_resource', sa.Column('disputed_at', sa.DateTime(timezone=True), nullable=True))

    op.execute(
        'UPDATE order_resource SET travel_date = o.travel_date '
        'FROM "order" o WHERE o.id = order_resource.order_id AND order_resource.travel_date IS NULL'
    )
    op.alter_column('order_resource', 'travel_date', nullable=False)


def downgrade() -> None:
    op.drop_column('order_resource', 'disputed_at')
    op.drop_column('order_resource', 'disputed_amount')
    op.drop_column('order_resource', 'disputed_qty')
    op.drop_column('order_resource', 'is_disputed')

    op.drop_column('order_resource', 'completed_at')
    op.drop_column('order_resource', 'completed_amount')
    op.drop_column('order_resource', 'completed_qty')
    op.drop_column('order_resource', 'is_completed')

    op.drop_column('order_resource', 'refund_reserved_at')
    op.drop_column('order_resource', 'refund_reserved_amount')
    op.drop_column('order_resource', 'refund_reserved_qty')
    op.drop_column('order_resource', 'is_refund_reserved')

    op.drop_column('order_resource', 'refund_verified_at')
    op.drop_column('order_resource', 'refund_verified_amount')
    op.drop_column('order_resource', 'refund_verified_qty')
    op.drop_column('order_resource', 'is_refund_verified')

    op.drop_column('order_resource', 'refund_unreserved_at')
    op.drop_column('order_resource', 'refund_unreserved_amount')
    op.drop_column('order_resource', 'refund_unreserved_qty')
    op.drop_column('order_resource', 'is_refund_unreserved')

    op.drop_column('order_resource', 'refund_unverified_at')
    op.drop_column('order_resource', 'refund_unverified_amount')
    op.drop_column('order_resource', 'refund_unverified_qty')
    op.drop_column('order_resource', 'is_refund_unverified')

    op.drop_column('order_resource', 'reserved_at')
    op.drop_column('order_resource', 'reserved_amount')
    op.drop_column('order_resource', 'reserved_qty')
    op.drop_column('order_resource', 'is_reserved')

    op.drop_column('order_resource', 'verified_at')
    op.drop_column('order_resource', 'verified_amount')
    op.drop_column('order_resource', 'verified_qty')
    op.drop_column('order_resource', 'is_verified')

    op.drop_column('order_resource', 'issued_at')
    op.drop_column('order_resource', 'issued_amount')
    op.drop_column('order_resource', 'issued_qty')
    op.drop_column('order_resource', 'is_issued')

    op.drop_column('order_resource', 'travel_date')
