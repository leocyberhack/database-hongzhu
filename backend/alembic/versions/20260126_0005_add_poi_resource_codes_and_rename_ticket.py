"""add poi/resource codes and rename ticket to scenic

Revision ID: 20260126_0005
Revises: 20260126_0004
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa


revision = "20260126_0005"
down_revision = "20260126_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("poi", sa.Column("poi_code", sa.String(), nullable=True))
    op.add_column("resource", sa.Column("resource_code", sa.String(), nullable=True))

    op.execute("UPDATE poi SET poi_type = '景区' WHERE poi_type = '门票';")
    op.execute("UPDATE resource SET resource_type = '景区' WHERE resource_type = '门票';")


def downgrade() -> None:
    op.execute("UPDATE resource SET resource_type = '门票' WHERE resource_type = '景区';")
    op.execute("UPDATE poi SET poi_type = '门票' WHERE poi_type = '景区';")

    op.drop_column("resource", "resource_code")
    op.drop_column("poi", "poi_code")
