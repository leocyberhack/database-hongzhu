"""add folder_id to supplier table

Revision ID: 20260127_0002
Revises: 20260127_0001
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


revision = '20260127_0002'
down_revision = '20260127_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('supplier', sa.Column('folder_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_supplier_folder_id',
        'supplier', 'folder',
        ['folder_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_supplier_folder_id', 'supplier', ['folder_id'])


def downgrade() -> None:
    op.drop_index('ix_supplier_folder_id', table_name='supplier')
    op.drop_constraint('fk_supplier_folder_id', 'supplier', type_='foreignkey')
    op.drop_column('supplier', 'folder_id')
