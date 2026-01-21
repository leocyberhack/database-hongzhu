"""add poi province and district

Revision ID: 20260123_0002
Revises: 6ca65170a4c9
Create Date: 2026-01-23

"""
from alembic import op
import sqlalchemy as sa


revision = "20260123_0002"
down_revision = "6ca65170a4c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("poi", sa.Column("province", sa.String(), nullable=True))
    op.add_column("poi", sa.Column("district", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE poi
        SET
            province = COALESCE(province, attrs->>'province'),
            district = COALESCE(district, attrs->>'district')
        WHERE attrs IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("poi", "district")
    op.drop_column("poi", "province")
