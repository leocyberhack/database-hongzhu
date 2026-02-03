"""order_status_flags"""

revision = '4428bc5144ef'
down_revision = 'eb76dd2c23c5'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('order', sa.Column('is_paid', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('paid_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('paid_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_issued', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('issued_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('issued_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('issued_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('verified_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('verified_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('is_reserved', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('reserved_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('reserved_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('reserved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_refund_unverified', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('refund_unverified_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('refund_unverified_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('refund_unverified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_refund_unreserved', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('refund_unreserved_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('refund_unreserved_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('refund_unreserved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_refund_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('refund_verified_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('refund_verified_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('refund_verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_refund_reserved', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('refund_reserved_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('refund_reserved_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('refund_reserved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_completed', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('completed_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('completed_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order', sa.Column('is_disputed', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('order', sa.Column('disputed_qty', sa.Integer(), nullable=True))
    op.add_column('order', sa.Column('disputed_amount', sa.Numeric(12, 2), nullable=True))
    op.add_column('order', sa.Column('disputed_at', sa.DateTime(timezone=True), nullable=True))

    op.execute(
        """
        UPDATE "order"
        SET is_paid = TRUE
        WHERE status IN ('paid', 'verified', 'refunded')
        """
    )
    op.execute(
        """
        UPDATE "order"
        SET is_verified = TRUE
        WHERE status = 'verified' OR verified_at IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE "order"
        SET is_refund_unverified = TRUE
        WHERE status = 'refunded'
        """
    )
    op.execute(
        """
        UPDATE "order"
        SET refund_unverified_at = refunded_at
        WHERE refunded_at IS NOT NULL
        """
    )

    op.drop_column('order', 'status')
    op.drop_column('order', 'refunded_at')


def downgrade() -> None:
    op.add_column('order', sa.Column('status', sa.String(), server_default=sa.text("'paid'"), nullable=False))
    op.add_column('order', sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True))

    op.execute(
        """
        UPDATE "order"
        SET status = CASE
            WHEN is_refund_unverified OR is_refund_unreserved OR is_refund_verified OR is_refund_reserved THEN 'refunded'
            WHEN is_verified THEN 'verified'
            WHEN is_paid THEN 'paid'
            ELSE 'paid'
        END
        """
    )
    op.execute(
        """
        UPDATE "order"
        SET refunded_at = refund_unverified_at
        WHERE refund_unverified_at IS NOT NULL
        """
    )

    op.drop_column('order', 'disputed_at')
    op.drop_column('order', 'disputed_amount')
    op.drop_column('order', 'disputed_qty')
    op.drop_column('order', 'is_disputed')
    op.drop_column('order', 'completed_at')
    op.drop_column('order', 'completed_amount')
    op.drop_column('order', 'completed_qty')
    op.drop_column('order', 'is_completed')
    op.drop_column('order', 'refund_reserved_at')
    op.drop_column('order', 'refund_reserved_amount')
    op.drop_column('order', 'refund_reserved_qty')
    op.drop_column('order', 'is_refund_reserved')
    op.drop_column('order', 'refund_verified_at')
    op.drop_column('order', 'refund_verified_amount')
    op.drop_column('order', 'refund_verified_qty')
    op.drop_column('order', 'is_refund_verified')
    op.drop_column('order', 'refund_unreserved_at')
    op.drop_column('order', 'refund_unreserved_amount')
    op.drop_column('order', 'refund_unreserved_qty')
    op.drop_column('order', 'is_refund_unreserved')
    op.drop_column('order', 'refund_unverified_at')
    op.drop_column('order', 'refund_unverified_amount')
    op.drop_column('order', 'refund_unverified_qty')
    op.drop_column('order', 'is_refund_unverified')
    op.drop_column('order', 'reserved_at')
    op.drop_column('order', 'reserved_amount')
    op.drop_column('order', 'reserved_qty')
    op.drop_column('order', 'is_reserved')
    op.drop_column('order', 'verified_amount')
    op.drop_column('order', 'verified_qty')
    op.drop_column('order', 'is_verified')
    op.drop_column('order', 'issued_at')
    op.drop_column('order', 'issued_amount')
    op.drop_column('order', 'issued_qty')
    op.drop_column('order', 'is_issued')
    op.drop_column('order', 'paid_at')
    op.drop_column('order', 'paid_amount')
    op.drop_column('order', 'paid_qty')
    op.drop_column('order', 'is_paid')
