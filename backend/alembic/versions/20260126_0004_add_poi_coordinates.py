"""add poi longitude/latitude

Revision ID: 20260126_0004
Revises: 20260126_0003
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa


revision = "20260126_0004"
down_revision = "20260126_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("poi", sa.Column("longitude", sa.Numeric(10, 6), nullable=True))
    op.add_column("poi", sa.Column("latitude", sa.Numeric(10, 6), nullable=True))


def downgrade() -> None:
    op.drop_column("poi", "latitude")
    op.drop_column("poi", "longitude")
