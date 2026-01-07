"""refactor_inventory_to_supplier_level

Revision ID: 7e2d96c9ee02
Revises: 6dc6448cdff1
Create Date: 2026-01-07 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7e2d96c9ee02'
down_revision = '6dc6448cdff1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old table and create new one with correct schema
    op.drop_table('resource_inventory')
    
    op.create_table('resource_inventory',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('supplier_resource_id', sa.Integer(), nullable=False),
        sa.Column('inventory_date', sa.Date(), nullable=False),
        sa.Column('total_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('frozen_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('sold_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column('created_at', sa.Text(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.Text(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['supplier_resource_id'], ['supplier_resource.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('supplier_resource_id', 'inventory_date', name='uq_supplier_resource_inventory_date'),
        sa.CheckConstraint('frozen_qty >= 0 AND sold_qty >= 0', name='ck_res_inventory_non_negative'),
        sa.CheckConstraint('sold_qty + frozen_qty <= total_qty', name='ck_res_inventory_not_over_sold')
    )


def downgrade() -> None:
    op.drop_table('resource_inventory')
    # Recreate the old table structure (simplified)
    op.create_table('resource_inventory',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=False),
        sa.Column('inventory_date', sa.Date(), nullable=False),
        sa.Column('total_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('frozen_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('sold_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column('created_at', sa.Text(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.Text(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['resource_id'], ['resource.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resource_id', 'inventory_date', name='uq_resource_inventory_date')
    )
