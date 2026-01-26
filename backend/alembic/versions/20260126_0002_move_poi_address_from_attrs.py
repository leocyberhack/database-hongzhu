"""move poi address from attrs to column

Revision ID: 20260126_0002
Revises: 20260126_0001
Create Date: 2026-01-26

"""
from alembic import op


revision = "20260126_0002"
down_revision = "20260126_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE poi
        SET address = COALESCE(NULLIF(address, ''), attrs->>'address')
        WHERE (address IS NULL OR address = '') AND attrs ? 'address';
        """
    )
    op.execute(
        """
        UPDATE poi
        SET address = COALESCE(NULLIF(address, ''), attrs->>'restaurant_address')
        WHERE (address IS NULL OR address = '') AND attrs ? 'restaurant_address';
        """
    )
    op.execute("UPDATE poi SET attrs = attrs - 'address' WHERE attrs ? 'address';")
    op.execute("UPDATE poi SET attrs = attrs - 'restaurant_address' WHERE attrs ? 'restaurant_address';")


def downgrade() -> None:
    # Irreversible data move; keep downgrade as no-op.
    pass
