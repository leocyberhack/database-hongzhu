"""add product_category table"""

revision = '315f8df3cdab'
down_revision = '20251231_0003'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        'product_category',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Add category_id foreign key to product table
    op.add_column('product', sa.Column('category_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'fk_product_category_id', 
        'product', 
        'product_category', 
        ['category_id'], 
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_product_category_id', 'product', type_='foreignkey')
    op.drop_column('product', 'category_id')
    op.drop_table('product_category')

