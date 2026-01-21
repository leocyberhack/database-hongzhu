"""add supplier attrs and contract dates

Revision ID: 20260123_0001
Revises: 20251231_0003
Create Date: 2026-01-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260123_0001"
down_revision = "20251231_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("supplier", sa.Column("attrs", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("supplier", sa.Column("contract_start_date", sa.Date(), nullable=True))
    op.add_column("supplier", sa.Column("contract_end_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("supplier", "contract_end_date")
    op.drop_column("supplier", "contract_start_date")
    op.drop_column("supplier", "attrs")
