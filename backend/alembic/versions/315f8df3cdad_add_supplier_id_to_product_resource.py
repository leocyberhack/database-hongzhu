"""add supplier_id to product_resource"""

revision = '315f8df3cdad'
down_revision = '315f8df3cdac'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Add supplier_id column to product_resource table
    op.add_column('product_resource', sa.Column('supplier_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_product_resource_supplier_id', 
        'product_resource', 
        'supplier', 
        ['supplier_id'], 
        ['id'],
        ondelete='RESTRICT'
    )


def downgrade() -> None:
    op.drop_constraint('fk_product_resource_supplier_id', 'product_resource', type_='foreignkey')
    op.drop_column('product_resource', 'supplier_id')
