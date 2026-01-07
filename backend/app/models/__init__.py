from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="guest")
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class Poi(Base):
    __tablename__ = "poi"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    poi_name: Mapped[str] = mapped_column(String, nullable=False)
    poi_type: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (UniqueConstraint("poi_name", "city", name="uq_poi_name_city"),)


class Resource(Base):
    __tablename__ = "resource"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    poi_id: Mapped[int] = mapped_column(ForeignKey("poi.id", ondelete="RESTRICT"), nullable=False)
    resource_name: Mapped[str] = mapped_column(String, nullable=False)
    resource_type: Mapped[str] = mapped_column(String, nullable=False)
    attrs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'draft'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    poi = relationship("Poi")


class Supplier(Base):
    __tablename__ = "supplier"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'pending'"))
    contact_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    settlement_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    qualification_files: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (UniqueConstraint("supplier_name", name="uq_supplier_name"),)


class SupplierResource(Base):
    __tablename__ = "supplier_resource"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resource.id", ondelete="RESTRICT"), nullable=False)
    supply_status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))
    settlement_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    rule: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    priority: Mapped[int | None] = mapped_column(Integer, nullable=True, server_default=text("1"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("supplier_id", "resource_id", name="uq_supplier_resource"),
    )

    supplier = relationship("Supplier")
    resource = relationship("Resource")


class SupplierResourcePriceHistory(Base):
    __tablename__ = "supplier_resource_price_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_resource_id: Mapped[int] = mapped_column(ForeignKey("supplier_resource.id", ondelete="CASCADE"), nullable=False)
    before_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    after_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator: Mapped[str | None] = mapped_column(String, nullable=True)
    operated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    approval_id: Mapped[int | None] = mapped_column(ForeignKey("approval.id", ondelete="SET NULL"), nullable=True)



class ProductCategory(Base):
    __tablename__ = "product_category"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class Product(Base):
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)  # Legacy or simple string if not using FK
    # Using FK for category management as requested
    category_id: Mapped[int | None] = mapped_column(ForeignKey("product_category.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'draft'"))
    suggested_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    base_cost: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    structure_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    poi_id: Mapped[int | None] = mapped_column(ForeignKey("poi.id", ondelete="SET NULL"), nullable=True)
    allowed_channels: Mapped[list[int] | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (UniqueConstraint("structure_hash", name="uq_product_structure_hash"),)

    product_category = relationship("ProductCategory")
    poi = relationship("Poi")


class ProductResource(Base):
    __tablename__ = "product_resource"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resource.id", ondelete="RESTRICT"), nullable=False)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    required_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    product = relationship("Product")
    resource = relationship("Resource")
    supplier = relationship("Supplier")


class ProductStructureSnapshot(Base):
    __tablename__ = "product_structure_snapshot"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class Channel(Base):
    __tablename__ = "channel"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    channel_name: Mapped[str] = mapped_column(String, nullable=False)
    channel_type: Mapped[str | None] = mapped_column(String, nullable=True)
    commission_rate: Mapped[Numeric | None] = mapped_column(Numeric(5, 4), nullable=True) # Percentage (e.g., 0.05 for 5%)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("channel.id", ondelete="SET NULL"), nullable=True)
    attrs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class Sku(Base):
    __tablename__ = "sku"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    sku_name: Mapped[str] = mapped_column(String, nullable=False)
    sku_type: Mapped[str | None] = mapped_column(String, nullable=True)
    sale_start: Mapped[Date | None] = mapped_column(Date, nullable=True)
    sale_end: Mapped[Date | None] = mapped_column(Date, nullable=True)
    travel_start: Mapped[Date | None] = mapped_column(Date, nullable=True)
    travel_end: Mapped[Date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'draft'"))
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    poi_id: Mapped[int | None] = mapped_column(ForeignKey("poi.id", ondelete="SET NULL"), nullable=True)

    product = relationship("Product")
    poi = relationship("Poi")


class SkuChannel(Base):
    __tablename__ = "sku_channel"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("sku.id", ondelete="CASCADE"), nullable=False)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channel.id", ondelete="CASCADE"), nullable=False)
    channel_sku_code: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (UniqueConstraint("sku_id", "channel_id", name="uq_sku_channel"),)

    sku = relationship("Sku")
    channel = relationship("Channel")


class Price(Base):
    __tablename__ = "price"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("sku.id", ondelete="CASCADE"), nullable=False)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channel.id", ondelete="CASCADE"), nullable=False)
    sale_price: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    start_at: Mapped[Date] = mapped_column(Date, nullable=False)
    end_at: Mapped[Date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'draft'"))
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("sku_id", "channel_id", "start_at", "end_at", name="uq_price_time_range"),
    )


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    price_id: Mapped[int] = mapped_column(ForeignKey("price.id", ondelete="CASCADE"), nullable=False)
    before_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    operator: Mapped[str | None] = mapped_column(String, nullable=True)
    operated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    approval_id: Mapped[int | None] = mapped_column(ForeignKey("approval.id", ondelete="SET NULL"), nullable=True)


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("sku.id", ondelete="CASCADE"), nullable=False)
    inventory_date: Mapped[Date] = mapped_column(Date, nullable=False)
    total_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    frozen_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    sold_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'normal'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("sku_id", "inventory_date", name="uq_inventory_sku_date"),
        CheckConstraint("frozen_qty >= 0 AND sold_qty >= 0", name="ck_inventory_non_negative"),
        CheckConstraint("sold_qty + frozen_qty <= total_qty", name="ck_inventory_not_over_sold"),
    )


from app.models.resource_inventory import ResourceInventory

class InventoryLog(Base):
    __tablename__ = "inventory_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("sku.id", ondelete="CASCADE"), nullable=False)
    inventory_date: Mapped[Date] = mapped_column(Date, nullable=False)
    change_type: Mapped[str] = mapped_column(String, nullable=False)
    before_qty: Mapped[dict] = mapped_column(JSONB, nullable=False)
    after_qty: Mapped[dict] = mapped_column(JSONB, nullable=False)
    related_order_id: Mapped[int | None] = mapped_column(ForeignKey("order.id", ondelete="SET NULL"), nullable=True)
    operator: Mapped[str | None] = mapped_column(String, nullable=True)
    operated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)


class Order(Base):
    __tablename__ = "order"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String, nullable=False)
    channel_id: Mapped[int] = mapped_column(ForeignKey("channel.id", ondelete="RESTRICT"), nullable=False)
    sku_id: Mapped[int] = mapped_column(ForeignKey("sku.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="RESTRICT"), nullable=False)
    travel_date: Mapped[Date] = mapped_column(Date, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sale_price: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    sale_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    cost_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    profit_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'paid'"))
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("order_no", "channel_id", name="uq_order_no_channel"),)


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("order.id", ondelete="CASCADE"), nullable=False)
    before_status: Mapped[str | None] = mapped_column(String, nullable=True)
    after_status: Mapped[str] = mapped_column(String, nullable=False)
    operator: Mapped[str | None] = mapped_column(String, nullable=True)
    operated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class Approval(Base):
    __tablename__ = "approval"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    object_type: Mapped[str] = mapped_column(String, nullable=False)
    object_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    action_type: Mapped[str] = mapped_column(String, nullable=False)
    before_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'pending'"))
    applicant: Mapped[str] = mapped_column(String, nullable=False)
    approver: Mapped[str] = mapped_column(String, nullable=False)
    applied_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    decided_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    table_name: Mapped[str] = mapped_column(String, nullable=False)
    record_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    operation: Mapped[str] = mapped_column(String, nullable=False)
    diff_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    operator: Mapped[str | None] = mapped_column(String, nullable=True)
    operated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    source: Mapped[str | None] = mapped_column(String, nullable=True)


__all__ = [
    "Base",
    "Poi",
    "Resource",
    "Supplier",
    "SupplierResource",
    "SupplierResourcePriceHistory",
    "ProductCategory",
    "Product",
    "ProductResource",
    "ProductStructureSnapshot",
    "Channel",
    "Sku",
    "SkuChannel",
    "Price",
    "PriceHistory",
    "Inventory",
    "InventoryLog",
    "Order",
    "OrderStatusHistory",
    "Approval",
    "AuditLog",
    "User",
]
