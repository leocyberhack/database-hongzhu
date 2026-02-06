from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, text, Enum as SaEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class AssetType(str, enum.Enum):
    """璧勬簮/POI绫诲瀷鏋氫妇"""
    TICKET = "景区"
    HOTEL = "酒店"
    DINING = "餐饮"
    TRANSPORT = "交通"


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
    poi_type: Mapped[str] = mapped_column(String, nullable=False)
    poi_code: Mapped[str | None] = mapped_column(String, nullable=True)
    province: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String, nullable=False)
    district: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    attrs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    type_options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))
    folder_id: Mapped[int | None] = mapped_column(ForeignKey("folder.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (UniqueConstraint("poi_name", "city", name="uq_poi_name_city"),)
    
    # Relationship to folder
    folder = relationship("Folder")


class RegionProvince(Base):
    __tablename__ = "region_province"

    code: Mapped[str] = mapped_column(String(6), primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)


class RegionCity(Base):
    __tablename__ = "region_city"

    code: Mapped[str] = mapped_column(String(6), primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    province_code: Mapped[str] = mapped_column(ForeignKey("region_province.code", ondelete="CASCADE"), nullable=False)

    province = relationship("RegionProvince")


class RegionDistrict(Base):
    __tablename__ = "region_district"

    code: Mapped[str] = mapped_column(String(6), primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    province_code: Mapped[str] = mapped_column(ForeignKey("region_province.code", ondelete="CASCADE"), nullable=False)
    city_code: Mapped[str] = mapped_column(ForeignKey("region_city.code", ondelete="CASCADE"), nullable=False)

    province = relationship("RegionProvince")
    city = relationship("RegionCity")


class Resource(Base):
    __tablename__ = "resource"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    poi_id: Mapped[int] = mapped_column(ForeignKey("poi.id", ondelete="RESTRICT"), nullable=False)
    resource_name: Mapped[str] = mapped_column(String, nullable=False)
    resource_code: Mapped[str | None] = mapped_column(String, nullable=True)
    resource_type: Mapped[str] = mapped_column(String, nullable=False)
    is_combination: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    attrs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    combination_updated_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'draft'"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    poi = relationship("Poi")


class ResourceComposition(Base):
    __tablename__ = "resource_composition"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    parent_resource_id: Mapped[int] = mapped_column(ForeignKey("resource.id", ondelete="CASCADE"), nullable=False)
    child_resource_id: Mapped[int] = mapped_column(ForeignKey("resource.id", ondelete="RESTRICT"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("parent_resource_id", "child_resource_id", name="uq_resource_composition_parent_child"),
    )

    parent_resource = relationship("Resource", foreign_keys=[parent_resource_id])
    child_resource = relationship("Resource", foreign_keys=[child_resource_id])


class Supplier(Base):
    __tablename__ = "supplier"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_name: Mapped[str] = mapped_column(String, nullable=False)
    contact_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    settlement_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    qualification_files: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    attrs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    folder_id: Mapped[int | None] = mapped_column(ForeignKey("folder.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (UniqueConstraint("supplier_name", name="uq_supplier_name"),)

    folder = relationship("Folder")


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


class SupplierResourceAgreement(Base):
    """渚涘簲鍟嗚祫婧愬崗璁〃"""
    __tablename__ = "supplier_resource_agreements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_resource_id: Mapped[int] = mapped_column(ForeignKey("supplier_resource.id", ondelete="CASCADE"), nullable=False)
    agreement_name: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)
    signing_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'active'"))
    settlement_cycle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requires_invoice: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    invoice_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    discount_methods: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {"婊″噺": true, "婊￠€?: false}
    discount_policy: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {"x": 100, "y": 10, "a": 200, "b": 1}
    attached_files: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [{"file_id": 1, "filename": "鍚堝悓.pdf"}]
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    supplier_resource = relationship("SupplierResource")



class ProductCategory(Base):
    __tablename__ = "product_category"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class Product(Base):
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_name: Mapped[str] = mapped_column(String, nullable=False)
    product_code: Mapped[str | None] = mapped_column(String, nullable=True)  # 浜у搧缂栫爜
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
    allowed_channels: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (UniqueConstraint("structure_hash", name="uq_product_structure_hash"),)

    product_category = relationship("ProductCategory")
    poi = relationship("Poi")


class ProductResource(Base):
    """
    浜у搧璧勬簮缁勫悎琛?    
    supplier_mode: 渚涘簲鍟嗛€夋嫨妯″紡
        - 'auto': 鑷姩妯″紡锛屾墍鏈夊彲鐢ㄤ緵搴斿晢閮藉彲鎻愪緵锛屼笅鍗曟椂閫夋嫨鏈€浣庝环
        - 'locked': 閿佸畾妯″紡锛屽彧鏈夋寚瀹氱殑渚涘簲鍟嗗彲浠ユ彁渚?    
    supplier_ids: 閿佸畾妯″紡涓嬬殑渚涘簲鍟咺D鍒楄〃 (JSONB瀛樺偍)
        - 鑷姩妯″紡涓嬩负 None 鎴栫┖鍒楄〃
        - 閿佸畾妯″紡涓嬭嚦灏戝寘鍚竴涓緵搴斿晢ID
    """
    __tablename__ = "product_resource"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resource.id", ondelete="RESTRICT"), nullable=False)
    # 鏂板: 渚涘簲鍟嗛€夋嫨妯″紡 ('auto' 鎴?'locked')
    supplier_mode: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'auto'"))
    # 鏂板: 閿佸畾妯″紡涓嬬殑渚涘簲鍟咺D鍒楄〃
    supplier_ids: Mapped[list[int] | None] = mapped_column(JSONB, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    required_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    product = relationship("Product")
    resource = relationship("Resource")


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
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))



class Spu(Base):
    """
    SPU (Standard Product Unit) - 鏍囧噯浜у搧鍗曚綅
    SKU鐨勭埗绾ф蹇碉紝鐢ㄤ簬瀵筍KU杩涜鍒嗙粍绠＄悊
    """
    __tablename__ = "spu"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    spu_code: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # Relationship
    skus = relationship("Sku", back_populates="spu", cascade="all, delete-orphan")


class Sku(Base):
    __tablename__ = "sku"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    spu_id: Mapped[int] = mapped_column(ForeignKey("spu.id", ondelete="CASCADE"), nullable=False)
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

    spu = relationship("Spu", back_populates="skus")
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


class ResourceInventoryLog(Base):
    __tablename__ = "resource_inventory_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_resource_id: Mapped[int] = mapped_column(ForeignKey("supplier_resource.id", ondelete="CASCADE"), nullable=False)
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
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    paid_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paid_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    paid_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_issued: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    issued_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    issued_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    issued_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    verified_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    reserved_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reserved_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    reserved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_refund_unverified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_unverified_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_unverified_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_unverified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_refund_unreserved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_unreserved_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_unreserved_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_unreserved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_refund_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_verified_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_verified_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_refund_reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_reserved_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_reserved_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_reserved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    completed_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_disputed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    disputed_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disputed_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    disputed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("order_no", "channel_id", name="uq_order_no_channel"),)


class OrderResource(Base):
    """
    璁㈠崟璧勬簮鏄庣粏琛?    
    璁板綍璁㈠崟涓瘡涓祫婧愬疄闄呬娇鐢ㄧ殑渚涘簲鍟嗗拰缁撶畻浠?    鐢ㄤ簬澶氫緵搴斿晢妯″紡涓嬬殑绮剧‘鎴愭湰杩芥函鍜屽簱瀛樻墸鍑?    """
    __tablename__ = "order_resource"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("order.id", ondelete="CASCADE"), nullable=False)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resource.id", ondelete="RESTRICT"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier.id", ondelete="RESTRICT"), nullable=False)
    travel_date: Mapped[Date] = mapped_column(Date, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    settlement_price: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    cost_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=False)
    composition_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    composition_snapshot_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_issued: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    issued_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    issued_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    issued_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issued_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    verified_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    reserved_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reserved_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    reserved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reserved_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_refund_unverified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_unverified_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_unverified_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_unverified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_unverified_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_refund_unreserved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_unreserved_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_unreserved_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_unreserved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_unreserved_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_refund_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_verified_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_verified_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_verified_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_refund_reserved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    refund_reserved_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refund_reserved_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    refund_reserved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_reserved_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    completed_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_disputed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    disputed_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disputed_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    disputed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    disputed_remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_mid_disputed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    mid_disputed_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mid_disputed_amount: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    mid_disputed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mid_disputed_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    order = relationship("Order", backref="resources")
    resource = relationship("Resource")
    supplier = relationship("Supplier")


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
    "ResourceComposition",
    "Supplier",
    "SupplierResource",
    "SupplierResourcePriceHistory",
    "SupplierResourceAgreement",
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
    "ResourceInventoryLog",
    "Order",
    "OrderResource",
    "OrderStatusHistory",
    "Approval",
    "AuditLog",
    "User",
    "Folder",
    "File",
    "Spu",
]


# ========================= 鏂囦欢绯荤粺 =========================

class Folder(Base):
    """鏂囦欢澶硅〃"""
    __tablename__ = "folder"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("folder.id", ondelete="CASCADE"), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    # 自引用关系
    parent = relationship("Folder", remote_side="Folder.id", backref="children")
    files = relationship("File", back_populates="folder", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("name", "parent_id", name="uq_folder_name_parent"),
    )


class File(Base):
    """文件表"""
    __tablename__ = "file"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)  # 原始文件名
    object_name: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)  # MinIO 路径
    url: Mapped[str] = mapped_column(String(1000), nullable=False)  # 鍏綉 URL
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)  # 鏂囦欢澶у皬 (bytes)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)  # MIME 绫诲瀷
    folder_id: Mapped[int | None] = mapped_column(ForeignKey("folder.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    folder = relationship("Folder", back_populates="files")


