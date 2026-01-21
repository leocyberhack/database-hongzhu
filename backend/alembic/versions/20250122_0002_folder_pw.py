"""add folder password hash

Revision ID: 20250122_0002_folder_pw
Revises: 20250121_0001_add_file_system
Create Date: 2026-01-22

"""
from alembic import op
import sqlalchemy as sa


revision = "20250122_0002_folder_pw"
down_revision = "20250121_0001_add_file_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("folder", sa.Column("password_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("folder", "password_hash")
