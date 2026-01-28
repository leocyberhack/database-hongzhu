"""remove supplier contract fields

Revision ID: 20260128_0002
Revises: fdac7d82aae1
Create Date: 2026-01-28 17:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260128_0002"
down_revision = "fdac7d82aae1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove deprecated supplier attrs keys
    op.execute(
        """
        UPDATE supplier
        SET attrs = CASE
            WHEN jsonb_typeof(attrs) = 'object' THEN attrs
                - 'settlement_cycle'
                - 'settlement_method'
                - 'invoice_info'
                - 'contract_no'
            ELSE attrs
        END
        WHERE attrs IS NOT NULL
        """
    )
    op.drop_column("supplier", "contract_start_date")
    op.drop_column("supplier", "contract_end_date")


def downgrade() -> None:
    op.add_column("supplier", sa.Column("contract_start_date", sa.Date(), nullable=True))
    op.add_column("supplier", sa.Column("contract_end_date", sa.Date(), nullable=True))
