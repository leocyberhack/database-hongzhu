"""add_allowed_channels_to_product"""

revision = '90de4d9fb4b5'
down_revision = 'eb3b85cf77a9'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    op.add_column('product', sa.Column('allowed_channels', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('product', 'allowed_channels')
