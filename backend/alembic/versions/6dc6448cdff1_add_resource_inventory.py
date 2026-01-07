"""add_resource_inventory"""

revision = '6dc6448cdff1'
down_revision = '90de4d9fb4b5'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        'resource_inventory',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('resource_id', sa.BigInteger(), nullable=False),
        sa.Column('inventory_date', sa.Date(), nullable=False),
        sa.Column('total_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('frozen_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('sold_qty', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column('created_at', sa.Text(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.Text(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['resource_id'], ['resource.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resource_id', 'inventory_date', name='uq_resource_inventory_date'),
        sa.CheckConstraint('frozen_qty >= 0 AND sold_qty >= 0', name='ck_res_inventory_non_negative'),
        sa.CheckConstraint('sold_qty + frozen_qty <= total_qty', name='ck_res_inventory_not_over_sold'),
    )


def downgrade() -> None:
    op.drop_table('resource_inventory')

