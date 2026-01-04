"""add_poi_id_to_product_and_sku_v2"""

revision = '087c696c02b2'
down_revision = '949e198cf35a'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Add poi_id column to product table
    op.add_column('product', sa.Column('poi_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key('fk_product_poi_id', 'product', 'poi', ['poi_id'], ['id'], ondelete='SET NULL')
    
    # Add poi_id column to sku table
    op.add_column('sku', sa.Column('poi_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key('fk_sku_poi_id', 'sku', 'poi', ['poi_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_sku_poi_id', 'sku', type_='foreignkey')
    op.drop_column('sku', 'poi_id')
    op.drop_constraint('fk_product_poi_id', 'product', type_='foreignkey')
    op.drop_column('product', 'poi_id')
