from contextvars import ContextVar
from typing import Any, Dict, Iterable

from datetime import date, datetime
from decimal import Decimal
import json

from jose import jwt, JWTError
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from app.core.config import get_settings
from app.models import (
    AuditLog,
    Poi,
    Resource,
    Supplier,
    SupplierResource,
    SupplierResourcePriceHistory,
    ProductCategory,
    Product,
    ProductResource,
    ProductStructureSnapshot,
    Channel,
    Sku,
    SkuChannel,
    Price,
    PriceHistory,
    Inventory,
    ResourceInventory,
    InventoryLog,
)

# Context var to store current operator in middleware/request scope
current_operator: ContextVar[str] = ContextVar("current_operator", default="system")

# Target models we want to capture
TARGET_MODELS = (
    # Poi,              # Handled manually
    # Resource,         # Handled manually
    # Supplier,         # Handled manually
    SupplierResource,
    SupplierResourcePriceHistory,
    # ProductCategory,  # Handled manually or low priority
    # Product,          # Handled manually
    ProductResource,
    ProductStructureSnapshot,
    # Channel,          # Handled manually
    # Sku,              # Handled manually
    # SkuChannel,       # Handled manually in skus/channels?
    # Price,            # Handled manually in pricing.py
    PriceHistory,
    # Inventory,        # Handled manually in inventory.py
    ResourceInventory,
    # InventoryLog,     # No need to audit the audit log itself
)


def _to_json_friendly(val: Any) -> Any:
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    return val


def _serialize(obj: Any) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        data[col.name] = _to_json_friendly(val)
    return data


def _snapshot_before(obj: Any) -> Dict[str, Any]:
    """Capture previous state for dirty objects using attribute history."""
    state = inspect(obj)
    before: Dict[str, Any] = {}
    for attr in state.mapper.column_attrs:
        hist = state.attrs[attr.key].history
        if hist.has_changes() and hist.deleted:
            val = hist.deleted[0]
            before[attr.key] = _to_json_friendly(val)
        else:
            val = getattr(obj, attr.key)
            before[attr.key] = _to_json_friendly(val)
    return before


def _collect_targets(objs: Iterable[Any]) -> Iterable[Any]:
    for obj in objs:
        if isinstance(obj, TARGET_MODELS):
            yield obj


def before_flush(session: Session, flush_context, instances):
    from app.utils.time import now_china
    
    snap = session.info.setdefault("_oplog_snap", {"new": [], "dirty": {}, "deleted": {}})
    for obj in _collect_targets(session.new):
        snap["new"].append(obj)
    for obj in _collect_targets(session.dirty):
        snap["dirty"][obj] = _snapshot_before(obj)
    for obj in _collect_targets(session.deleted):
        snap["deleted"][obj] = _serialize(obj)
    
    # 自动更新所有被修改对象的 updated_at 字段
    # 这是一个通用的解决方案，无需逐一修改每个API端点
    for obj in session.dirty:
        if hasattr(obj, 'updated_at'):
            # 只有当对象确实有变化时才更新时间戳
            state = inspect(obj)
            has_real_changes = False
            for attr in state.mapper.column_attrs:
                if attr.key == 'updated_at':
                    continue  # 跳过 updated_at 本身
                hist = state.attrs[attr.key].history
                if hist.has_changes():
                    has_real_changes = True
                    break
            if has_real_changes:
                obj.updated_at = now_china()


def after_flush(session: Session, flush_context):
    snap = session.info.pop("_oplog_snap", None)
    if not snap:
        return
    operator = current_operator.get()

    # Inserts
    for obj in snap["new"]:
        session.add(
            AuditLog(
                table_name=obj.__table__.name,
                record_id=getattr(obj, "id", 0) or 0,
                operation="CREATE",
                diff_data={"before": None, "after": _serialize(obj)},
                operator=operator,
                source="oplog",
            )
        )

    # Updates
    for obj, before in snap["dirty"].items():
        session.add(
            AuditLog(
                table_name=obj.__table__.name,
                record_id=getattr(obj, "id", 0) or 0,
                operation="UPDATE",
                diff_data={"before": before, "after": _serialize(obj)},
                operator=operator,
                source="oplog",
            )
        )

    # Deletes
    for obj, before in snap["deleted"].items():
        record_id = before.get("id") if isinstance(before, dict) else 0
        session.add(
            AuditLog(
                table_name=obj.__table__.name,
                record_id=record_id or 0,
                operation="DELETE",
                diff_data={"before": before, "after": None},
                operator=operator,
                source="oplog",
            )
        )


def register_oplog(session_factory):
    """
    Register flush hooks for both AsyncSession and its underlying sync Session.
    async_sessionmaker exposes .class_ (AsyncSession), while the actual flush
    happens on AsyncSession.sync_session_class (regular Session). We attach to
    both to be safe.
    """
    targets = set()

    # async_sessionmaker.class_ -> AsyncSession
    session_cls = getattr(session_factory, "class_", None)
    if session_cls:
        targets.add(session_cls)
        sync_cls = getattr(session_cls, "sync_session_class", None)
        if sync_cls:
            targets.add(sync_cls)

    # Fallback if the sessionmaker itself exposes sync_session_class
    sync_cls_direct = getattr(session_factory, "sync_session_class", None)
    if sync_cls_direct:
        targets.add(sync_cls_direct)

    for t in targets:
        event.listen(t, "before_flush", before_flush, propagate=True)
        event.listen(t, "after_flush", after_flush, propagate=True)


def extract_operator_from_headers(headers) -> str:
    """Lightweight extractor similar to get_current_user (JWT first, else X-User)."""
    settings = get_settings()
    auth = headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            username = payload.get("sub")
            if username:
                return username
        except JWTError:
            pass
    x_user = headers.get("x-user")
    if x_user:
        return x_user
    return "unknown"
