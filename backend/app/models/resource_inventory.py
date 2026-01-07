from datetime import date as python_date
from sqlalchemy import BigInteger, Column, Date, ForeignKey, Integer, String, Text, UniqueConstraint, text, CheckConstraint, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

class ResourceInventory(Base):
    __tablename__ = "resource_inventory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    supplier_resource_id: Mapped[int] = mapped_column(ForeignKey("supplier_resource.id", ondelete="CASCADE"), nullable=False)
    inventory_date: Mapped[python_date] = mapped_column(Date, nullable=False)
    
    # 每日结算价 (Settlement Price per day)
    settlement_price: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    
    # 资源的总容量（Total Capacity）
    total_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    
    # 预留/冻结/已售（逻辑上：Available = Total - Sold - Frozen）
    frozen_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    sold_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    
    status: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'active'"))  # active, closed
    
    created_at: Mapped[str] = mapped_column(Text, server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[str] = mapped_column(Text, server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("supplier_resource_id", "inventory_date", name="uq_supplier_resource_inventory_date"),
        CheckConstraint("frozen_qty >= 0 AND sold_qty >= 0", name="ck_res_inventory_non_negative"),
        CheckConstraint("sold_qty + frozen_qty <= total_qty", name="ck_res_inventory_not_over_sold"),
    )

    supplier_resource = relationship("SupplierResource")
