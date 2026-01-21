"""add folder and file tables for file system

Revision ID: 20250121_0001_add_file_system
Revises: e9c1db010b94
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa


revision = '20250121_0001_add_file_system'
down_revision = 'e9c1db010b94'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建文件夹表
    op.create_table(
        'folder',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('parent_id', sa.BigInteger(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['folder.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'parent_id', name='uq_folder_name_parent')
    )
    
    # 创建文件表
    op.create_table(
        'file',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('object_name', sa.String(500), nullable=False),
        sa.Column('url', sa.String(1000), nullable=False),
        sa.Column('size', sa.BigInteger(), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('folder_id', sa.BigInteger(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['folder_id'], ['folder.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('object_name')
    )
    
    # 创建索引
    op.create_index('ix_folder_parent_id', 'folder', ['parent_id'])
    op.create_index('ix_file_folder_id', 'file', ['folder_id'])


def downgrade() -> None:
    op.drop_index('ix_file_folder_id', table_name='file')
    op.drop_index('ix_folder_parent_id', table_name='folder')
    op.drop_table('file')
    op.drop_table('folder')
