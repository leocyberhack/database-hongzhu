"""initial schema"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20250101_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="guest"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )

    op.create_table(
        "approval",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("object_type", sa.String(), nullable=False),
        sa.Column("object_id", sa.BigInteger(), nullable=False),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("before_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("applicant", sa.String(), nullable=False),
        sa.Column("approver", sa.String(), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
    )

    op.create_table(
        "channel",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("channel_name", sa.String(), nullable=False),
        sa.Column("channel_type", sa.String(), nullable=True),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column("attrs", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["channel.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "poi",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("poi_name", sa.String(), nullable=False),
        sa.Column("poi_type", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("poi_name", "city", name="uq_poi_name_city"),
    )

    op.create_table(
        "product",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("product_name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("structure_hash", sa.String(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("structure_hash", name="uq_product_structure_hash"),
    )

    op.create_table(
        "supplier",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("supplier_name", sa.String(), nullable=False),
        sa.Column("supplier_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("contact_info", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("settlement_info", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("qualification_files", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("supplier_name", name="uq_supplier_name"),
    )

    op.create_table(
        "resource",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("poi_id", sa.BigInteger(), nullable=False),
        sa.Column("resource_name", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("attrs", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["poi_id"], ["poi.id"], ondelete="RESTRICT"),
    )

    op.create_table(
        "product_structure_snapshot",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("snapshot_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["product.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "product_resource",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("resource_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("required_flag", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["product.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resource_id"], ["resource.id"], ondelete="RESTRICT"),
    )

    op.create_table(
        "supplier_resource",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("supplier_id", sa.BigInteger(), nullable=False),
        sa.Column("resource_id", sa.BigInteger(), nullable=False),
        sa.Column("supply_status", sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("settlement_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("rule", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("priority", sa.Integer(), server_default=sa.text("1"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["supplier_id"], ["supplier.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["resource_id"], ["resource.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("supplier_id", "resource_id", name="uq_supplier_resource"),
    )

    op.create_table(
        "supplier_resource_price_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("supplier_resource_id", sa.BigInteger(), nullable=False),
        sa.Column("before_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("after_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("operator", sa.String(), nullable=True),
        sa.Column("operated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("approval_id", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["supplier_resource_id"], ["supplier_resource.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approval_id"], ["approval.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "sku",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_name", sa.String(), nullable=False),
        sa.Column("sku_type", sa.String(), nullable=True),
        sa.Column("sale_start", sa.Date(), nullable=True),
        sa.Column("sale_end", sa.Date(), nullable=True),
        sa.Column("travel_start", sa.Date(), nullable=True),
        sa.Column("travel_end", sa.Date(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["product.id"], ondelete="RESTRICT"),
    )

    op.create_table(
        "sku_channel",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_sku_code", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["sku_id"], ["sku.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["channel_id"], ["channel.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("sku_id", "channel_id", name="uq_sku_channel"),
    )

    op.create_table(
        "price",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("sale_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("cost_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("start_at", sa.Date(), nullable=False),
        sa.Column("end_at", sa.Date(), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["sku_id"], ["sku.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["channel_id"], ["channel.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("sku_id", "channel_id", "start_at", "end_at", name="uq_price_time_range"),
    )

    op.create_table(
        "price_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("price_id", sa.BigInteger(), nullable=False),
        sa.Column("before_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("operator", sa.String(), nullable=True),
        sa.Column("operated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("approval_id", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["price_id"], ["price.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approval_id"], ["approval.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "inventory",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("inventory_date", sa.Date(), nullable=False),
        sa.Column("total_qty", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("frozen_qty", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("sold_qty", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'normal'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["sku_id"], ["sku.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("sku_id", "inventory_date", name="uq_inventory_sku_date"),
        sa.CheckConstraint("frozen_qty >= 0 AND sold_qty >= 0", name="ck_inventory_non_negative"),
        sa.CheckConstraint("sold_qty + frozen_qty <= total_qty", name="ck_inventory_not_over_sold"),
    )

    op.create_table(
        "order",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("order_no", sa.String(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("travel_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("sale_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("sale_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("cost_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("cost_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("profit_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'paid'"), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["channel_id"], ["channel.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["sku_id"], ["sku.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["product.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("order_no", "channel_id", name="uq_order_no_channel"),
    )

    op.create_table(
        "inventory_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("sku_id", sa.BigInteger(), nullable=False),
        sa.Column("inventory_date", sa.Date(), nullable=False),
        sa.Column("change_type", sa.String(), nullable=False),
        sa.Column("before_qty", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("after_qty", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("related_order_id", sa.BigInteger(), nullable=True),
        sa.Column("operator", sa.String(), nullable=True),
        sa.Column("operated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["sku_id"], ["sku.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["related_order_id"], ["order.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "order_status_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("before_status", sa.String(), nullable=True),
        sa.Column("after_status", sa.String(), nullable=False),
        sa.Column("operator", sa.String(), nullable=True),
        sa.Column("operated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["order.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("table_name", sa.String(), nullable=False),
        sa.Column("record_id", sa.BigInteger(), nullable=False),
        sa.Column("operation", sa.String(), nullable=False),
        sa.Column("diff_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("operator", sa.String(), nullable=True),
        sa.Column("operated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user")
    op.drop_table("audit_log")
    op.drop_table("order_status_history")
    op.drop_table("inventory_log")
    op.drop_table("order")
    op.drop_table("inventory")
    op.drop_table("price_history")
    op.drop_table("price")
    op.drop_table("sku_channel")
    op.drop_table("sku")
    op.drop_table("supplier_resource_price_history")
    op.drop_table("supplier_resource")
    op.drop_table("product_resource")
    op.drop_table("product_structure_snapshot")
    op.drop_table("resource")
    op.drop_table("supplier")
    op.drop_table("product")
    op.drop_table("poi")
    op.drop_table("channel")
    op.drop_table("approval")
