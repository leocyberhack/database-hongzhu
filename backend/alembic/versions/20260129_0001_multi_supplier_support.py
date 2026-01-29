"""multi supplier support

Revision ID: 20260129_0001
Revises: 20260128_0002
Create Date: 2026-01-29 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260129_0001'
down_revision = '20260128_0002'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add new columns to product_resource
    op.add_column('product_resource', sa.Column('supplier_mode', sa.String(length=20), server_default='auto', nullable=False))
    op.add_column('product_resource', sa.Column('supplier_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    
    # 2. Migrate existing data: supplier_id -> supplier_ids + locked mode
    # If supplier_id is NOT NULL, set mode='locked' and supplier_ids=[supplier_id]
    op.execute("""
        UPDATE product_resource
        SET supplier_mode = 'locked',
            supplier_ids = jsonb_build_array(supplier_id)
        WHERE supplier_id IS NOT NULL
    """)
    
    # The supplier_id column is kept for safety but made nullable (it was nullable before too)
    
    # 3. Create order_resource table
    op.create_table(
        'order_resource',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.BigInteger(), nullable=False),
        sa.Column('resource_id', sa.BigInteger(), nullable=False),
        sa.Column('supplier_id', sa.BigInteger(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('settlement_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('cost_amount', sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['order.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resource_id'], ['resource.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('order_resource')
    op.drop_column('product_resource', 'supplier_ids')
    op.drop_column('product_resource', 'supplier_mode')
