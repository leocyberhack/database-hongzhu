"""add supplier resource agreements

Revision ID: 20260128_0001
Revises: 20260127_0002
Create Date: 2026-01-28 14:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260128_0001'
down_revision = '20260127_0002'
branch_labels = None
depends_on = None


def upgrade():
    # 创建供应商资源协议表
    op.create_table(
        'supplier_resource_agreements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('supplier_resource_id', sa.Integer(), nullable=False),
        sa.Column('agreement_name', sa.String(length=200), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('signing_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('settlement_cycle', sa.String(length=100), nullable=True),
        sa.Column('payment_method', sa.String(length=100), nullable=True),
        sa.Column('requires_invoice', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('invoice_type', sa.String(length=50), nullable=True),
        sa.Column('discount_methods', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('discount_policy', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('attached_files', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['supplier_resource_id'], ['supplier_resource.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_agreements_supplier_resource_id', 'supplier_resource_agreements', ['supplier_resource_id'])
    op.create_index('ix_agreements_status', 'supplier_resource_agreements', ['status'])


def downgrade():
    op.drop_index('ix_agreements_status', table_name='supplier_resource_agreements')
    op.drop_index('ix_agreements_supplier_resource_id', table_name='supplier_resource_agreements')
    op.drop_table('supplier_resource_agreements')
