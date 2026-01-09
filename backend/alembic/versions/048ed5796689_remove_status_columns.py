"""remove_status_columns"""

revision = '048ed5796689'
down_revision = '3d7947f900da'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.drop_column('channel', 'status')
    op.drop_column('product_category', 'status')
    op.drop_column('supplier', 'status')


def downgrade() -> None:
    op.add_column('supplier', sa.Column('status', sa.VARCHAR(), server_default=sa.text("'pending'::character varying"), autoincrement=False, nullable=False))
    op.add_column('product_category', sa.Column('status', sa.VARCHAR(), server_default=sa.text("'active'::character varying"), autoincrement=False, nullable=False))
    op.add_column('channel', sa.Column('status', sa.VARCHAR(), server_default=sa.text("'active'::character varying"), autoincrement=False, nullable=False))
