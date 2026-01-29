"""add spu model"""

revision = '0bc9430cc277'
down_revision = '20260129_0002'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa



def upgrade() -> None:
    # Create spu table
    op.create_table('spu',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('spu_code', sa.String(), nullable=True),
        sa.Column('remark', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add spu_id to sku table
    # We add it as nullable first to avoid issues with existing data
    op.add_column('sku', sa.Column('spu_id', sa.BigInteger(), nullable=True))
    
    # Create Foreign Key
    op.create_foreign_key('fk_sku_spu_id_spu', 'sku', 'spu', ['spu_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_sku_spu_id_spu', 'sku', type_='foreignkey')
    op.drop_column('sku', 'spu_id')
    op.drop_table('spu')

