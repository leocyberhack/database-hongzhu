"""add region tables for province/city/district

Revision ID: 20260126_0001
Revises: 20260123_0002
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa


revision = "20260126_0001"
down_revision = "20260123_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "region_province",
        sa.Column("code", sa.String(length=6), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
    )
    op.create_table(
        "region_city",
        sa.Column("code", sa.String(length=6), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "province_code",
            sa.String(length=6),
            sa.ForeignKey("region_province.code", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_region_city_province_code", "region_city", ["province_code"])
    op.create_table(
        "region_district",
        sa.Column("code", sa.String(length=6), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "province_code",
            sa.String(length=6),
            sa.ForeignKey("region_province.code", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "city_code",
            sa.String(length=6),
            sa.ForeignKey("region_city.code", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_region_district_province_code", "region_district", ["province_code"])
    op.create_index("ix_region_district_city_code", "region_district", ["city_code"])


def downgrade() -> None:
    op.drop_index("ix_region_district_city_code", table_name="region_district")
    op.drop_index("ix_region_district_province_code", table_name="region_district")
    op.drop_table("region_district")
    op.drop_index("ix_region_city_province_code", table_name="region_city")
    op.drop_table("region_city")
    op.drop_table("region_province")
