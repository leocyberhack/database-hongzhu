"""add_poi_type_options_to_poi"""

revision = '4fa2248aaa73'
down_revision = '20260127_0002'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa



def upgrade() -> None:
    op.add_column('poi', sa.Column('type_options', sa.dialects.postgresql.JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('poi', 'type_options')

