"""add folder_id to poi table

Revision ID: 20260127_0001
Revises: 20260126_0005
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


revision = '20260127_0001'
down_revision = '20260126_0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 添加folder_id字段到poi表
    op.add_column('poi', sa.Column('folder_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_poi_folder_id',
        'poi', 'folder',
        ['folder_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_poi_folder_id', 'poi', ['folder_id'])


def downgrade() -> None:
    op.drop_index('ix_poi_folder_id', table_name='poi')
    op.drop_constraint('fk_poi_folder_id', 'poi', type_='foreignkey')
    op.drop_column('poi', 'folder_id')
