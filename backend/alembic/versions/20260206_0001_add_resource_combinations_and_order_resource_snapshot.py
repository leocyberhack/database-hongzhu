"""add resource combinations and order resource composition snapshot"""

revision = '20260206_0001'
down_revision = '20260204_0001'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.add_column(
        "resource",
        sa.Column("is_combination", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "resource",
        sa.Column("combination_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE resource SET is_combination = false WHERE is_combination IS NULL")
    op.alter_column("resource", "is_combination", server_default=None)

    op.create_table(
        "resource_composition",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("parent_resource_id", sa.BigInteger(), nullable=False),
        sa.Column("child_resource_id", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["parent_resource_id"], ["resource.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["child_resource_id"], ["resource.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("parent_resource_id", "child_resource_id", name="uq_resource_composition_parent_child"),
    )
    op.create_index(
        "ix_resource_composition_parent_resource_id",
        "resource_composition",
        ["parent_resource_id"],
        unique=False,
    )
    op.create_index(
        "ix_resource_composition_child_resource_id",
        "resource_composition",
        ["child_resource_id"],
        unique=False,
    )

    op.add_column(
        "order_resource",
        sa.Column("composition_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "order_resource",
        sa.Column("composition_snapshot_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("order_resource", "composition_snapshot_at")
    op.drop_column("order_resource", "composition_snapshot")

    op.drop_index("ix_resource_composition_child_resource_id", table_name="resource_composition")
    op.drop_index("ix_resource_composition_parent_resource_id", table_name="resource_composition")
    op.drop_table("resource_composition")

    op.drop_column("resource", "combination_updated_at")
    op.drop_column("resource", "is_combination")
