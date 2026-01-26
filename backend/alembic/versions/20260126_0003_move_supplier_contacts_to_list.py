"""move supplier contact info to list format

Revision ID: 20260126_0003
Revises: 20260126_0002
Create Date: 2026-01-26

"""
from alembic import op


revision = "20260126_0003"
down_revision = "20260126_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE supplier
        SET contact_info = jsonb_build_array(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'name', contact_info->>'contact_name',
                    'phone', contact_info->>'contact_phone',
                    'email', NULLIF(attrs->>'contact_email', ''),
                    'position', contact_info->>'position'
                )
            )
        )
        WHERE contact_info IS NOT NULL AND jsonb_typeof(contact_info) = 'object';
        """
    )
    op.execute(
        """
        UPDATE supplier
        SET contact_info = jsonb_build_array(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'email', NULLIF(attrs->>'contact_email', '')
                )
            )
        )
        WHERE (contact_info IS NULL OR jsonb_typeof(contact_info) <> 'array')
          AND attrs ? 'contact_email';
        """
    )
    op.execute("UPDATE supplier SET attrs = attrs - 'contact_email' WHERE attrs ? 'contact_email';")


def downgrade() -> None:
    # Irreversible data move; keep downgrade as no-op.
    pass
