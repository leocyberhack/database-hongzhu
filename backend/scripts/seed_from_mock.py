"""
Seed database from mock JSON files (prototype/public/mock).

Usage:
  python -m scripts.seed_from_mock --mock-dir "../prototype/public/mock"
"""

import argparse
import asyncio
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Tuple

from sqlalchemy import insert, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.models import (
    Approval,
    AuditLog,
    Channel,
    Inventory,
    InventoryLog,
    Order,
    OrderStatusHistory,
    Poi,
    Price,
    PriceHistory,
    Product,
    ProductResource,
    ProductStructureSnapshot,
    Resource,
    Sku,
    SkuChannel,
    Supplier,
    SupplierResource,
    SupplierResourcePriceHistory,
)


def _as_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value.split("T")[0])


def _as_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    v = value.strip().replace(" ", "T").replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        # Fallback for date-only strings
        return datetime.fromisoformat(v.split("T")[0] + "T00:00:00+00:00")


def _as_decimal(value: Any | None) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def build_mapping(items: list[dict], start: int = 1) -> tuple[dict[str, int], list[dict]]:
    mapping: dict[str, int] = {}
    transformed: list[dict] = []
    for idx, item in enumerate(items, start=start):
        old_id = str(item.get("id"))
        mapping[old_id] = idx
        new_item = dict(item)
        new_item["id"] = idx
        transformed.append(new_item)
    return mapping, transformed


def build_poi_mapping_with_dedup(items: list[dict], start: int = 1) -> Tuple[dict[str, int], list[dict]]:
    """
    Deduplicate POI by (poi_name, city) to respect unique constraint.
    Later references will map duplicate POIs to the first occurrence.
    """
    mapping: dict[str, int] = {}
    transformed: list[dict] = []
    next_id = start
    dedup_key_to_new_id: dict[tuple[str, str], int] = {}

    for item in items:
        old_id = str(item.get("id"))
        key = (item.get("poi_name"), item.get("city"))
        if key in dedup_key_to_new_id:
            # Map duplicate to existing id
            mapping[old_id] = dedup_key_to_new_id[key]
            continue
        # New record
        dedup_key_to_new_id[key] = next_id
        mapping[old_id] = next_id
        new_item = dict(item)
        new_item["id"] = next_id
        transformed.append(new_item)
        next_id += 1
    return mapping, transformed


async def truncate_all(session: AsyncSession):
    await session.execute(
        text(
            """
            TRUNCATE TABLE
                audit_log,
                order_status_history,
                inventory_log,
                price_history,
                supplier_resource_price_history,
                "order",
                inventory,
                price,
                sku_channel,
                sku,
                product_structure_snapshot,
                product_resource,
                product,
                supplier_resource,
                supplier,
                resource,
                poi,
                channel,
                approval
            RESTART IDENTITY CASCADE;
            """
        )
    )
    await session.commit()


async def seed(mock_dir: Path):
    data = {}
    for name in [
        "poi",
        "resources",
        "suppliers",
        "supplier_resources",
        "supplier_resource_price_history",
        "products",
        "product_resources",
        "product_structure_snapshot",
        "skus",
        "channels",
        "sku_channels",
        "prices",
        "price_history",
        "inventory",
        "inventory_log",
        "orders",
        "order_status_history",
        "approvals",
        "audit_log",
    ]:
        path = mock_dir / f"{name}.json"
        with path.open("r", encoding="utf-8") as f:
            data[name] = json.load(f)

    async with SessionLocal() as session:
        await truncate_all(session)

        poi_map, poi_rows = build_poi_mapping_with_dedup(data["poi"])
        await session.execute(insert(Poi), poi_rows)

        resource_map, resource_rows = build_mapping(data["resources"])
        for item in resource_rows:
            item["poi_id"] = poi_map.get(str(item["poi_id"]))
        await session.execute(insert(Resource), resource_rows)

        supplier_map, supplier_rows = build_mapping(data["suppliers"])
        await session.execute(insert(Supplier), supplier_rows)

        supplier_resource_map, supplier_resource_rows = build_mapping(data["supplier_resources"])
        for item in supplier_resource_rows:
            item["supplier_id"] = supplier_map.get(str(item["supplier_id"]))
            item["resource_id"] = resource_map.get(str(item["resource_id"]))
            item["settlement_price"] = _as_decimal(item.get("settlement_price"))
        await session.execute(insert(SupplierResource), supplier_resource_rows)

        product_map, product_rows = build_mapping(data["products"])
        for item in product_rows:
            item["created_at"] = _as_dt(item.get("created_at"))
            item["updated_at"] = _as_dt(item.get("updated_at"))
        await session.execute(insert(Product), product_rows)

        product_resource_map, product_resource_rows = build_mapping(data["product_resources"])
        for item in product_resource_rows:
            item["product_id"] = product_map.get(str(item["product_id"]))
            item["resource_id"] = resource_map.get(str(item["resource_id"]))
        await session.execute(insert(ProductResource), product_resource_rows)

        snapshot_map, snapshot_rows = build_mapping(data["product_structure_snapshot"])
        for item in snapshot_rows:
            item["product_id"] = product_map.get(str(item["product_id"]))
            item["created_at"] = _as_dt(item.get("created_at"))
        await session.execute(insert(ProductStructureSnapshot), snapshot_rows)

        channel_map, channel_rows = build_mapping(data["channels"])
        for item in channel_rows:
            parent = item.get("parent_id")
            item["parent_id"] = channel_map.get(str(parent)) if parent else None
        await session.execute(insert(Channel), channel_rows)

        sku_map, sku_rows = build_mapping(data["skus"])
        for item in sku_rows:
            item["product_id"] = product_map.get(str(item["product_id"]))
            item["sale_start"] = _as_date(item.get("sale_start"))
            item["sale_end"] = _as_date(item.get("sale_end"))
            item["travel_start"] = _as_date(item.get("travel_start"))
            item["travel_end"] = _as_date(item.get("travel_end"))
            item["created_at"] = _as_dt(item.get("created_at"))
            item["updated_at"] = _as_dt(item.get("updated_at"))
        await session.execute(insert(Sku), sku_rows)

        sku_channel_map, sku_channel_rows = build_mapping(data["sku_channels"])
        for item in sku_channel_rows:
            item["sku_id"] = sku_map.get(str(item["sku_id"]))
            item["channel_id"] = channel_map.get(str(item["channel_id"]))
            item["created_at"] = _as_dt(item.get("created_at"))
        await session.execute(insert(SkuChannel), sku_channel_rows)

        price_map, price_rows = build_mapping(data["prices"])
        for item in price_rows:
            item["sku_id"] = sku_map.get(str(item["sku_id"]))
            item["channel_id"] = channel_map.get(str(item["channel_id"]))
            item["sale_price"] = _as_decimal(item.get("sale_price"))
            item["cost_price"] = _as_decimal(item.get("cost_price"))
            item["start_at"] = _as_date(item.get("start_at"))
            item["end_at"] = _as_date(item.get("end_at"))
            item["created_at"] = _as_dt(item.get("created_at"))
        await session.execute(insert(Price), price_rows)

        inventory_map, inventory_rows = build_mapping(data["inventory"])
        for item in inventory_rows:
            item["sku_id"] = sku_map.get(str(item["sku_id"]))
            item["inventory_date"] = _as_date(item.get("inventory_date"))
            item["created_at"] = _as_dt(item.get("created_at"))
            item["updated_at"] = _as_dt(item.get("updated_at"))
        await session.execute(insert(Inventory), inventory_rows)

        order_map, order_rows = build_mapping(data["orders"])
        for item in order_rows:
            item["channel_id"] = channel_map.get(str(item["channel_id"]))
            item["sku_id"] = sku_map.get(str(item["sku_id"]))
            item["product_id"] = product_map.get(str(item["product_id"]))
            item["travel_date"] = _as_date(item.get("travel_date"))
            item["quantity"] = int(item.get("quantity", 1))
            item["sale_price"] = _as_decimal(item.get("sale_price"))
            item["sale_amount"] = _as_decimal(item.get("sale_amount"))
            item["cost_price"] = _as_decimal(item.get("cost_price"))
            item["cost_amount"] = _as_decimal(item.get("cost_amount"))
            item["profit_amount"] = _as_decimal(item.get("profit_amount"))
            item["created_at"] = _as_dt(item.get("created_at"))
            status = item.get("status")
            verified_at = _as_dt(item.get("verified_at"))
            refunded_at = _as_dt(item.get("refunded_at"))
            item["verified_at"] = verified_at
            item["refund_unverified_at"] = refunded_at
            if status in {"paid", "verified", "refunded"}:
                item["is_paid"] = True
            if status == "verified":
                item["is_verified"] = True
            if status == "refunded":
                item["is_refund_unverified"] = True
            item.pop("status", None)
            item.pop("refunded_at", None)
        await session.execute(insert(Order), order_rows)

        approval_map, approval_rows = build_mapping(data["approvals"])
        for item in approval_rows:
            obj_type = item.get("object_type")
            obj_id = str(item.get("object_id"))
            target_map = {
                "product": product_map,
                "sku": sku_map,
                "price": price_map,
                "inventory": inventory_map,
                "supplier": supplier_map,
            }.get(obj_type, {})
            item["object_id"] = target_map.get(obj_id, None)
            item["applied_at"] = _as_dt(item.get("applied_at"))
            item["decided_at"] = _as_dt(item.get("decided_at"))
        await session.execute(insert(Approval), approval_rows)

        price_history_rows = []
        _, raw_price_hist = build_mapping(data["price_history"])
        for item in raw_price_hist:
            item["price_id"] = price_map.get(str(item["price_id"]))
            item["approval_id"] = approval_map.get(str(item.get("approval_id"))) if item.get("approval_id") else None
            item["operated_at"] = _as_dt(item.get("operated_at"))
            price_history_rows.append(item)
        await session.execute(insert(PriceHistory), price_history_rows)

        supplier_price_hist_rows = []
        _, raw_sup_hist = build_mapping(data["supplier_resource_price_history"])
        for item in raw_sup_hist:
            item["supplier_resource_id"] = supplier_resource_map.get(str(item["supplier_resource_id"]))
            item["approval_id"] = approval_map.get(str(item.get("approval_id"))) if item.get("approval_id") else None
            item["operated_at"] = _as_dt(item.get("operated_at"))
            item["before_price"] = _as_decimal(item.get("before_price"))
            item["after_price"] = _as_decimal(item.get("after_price"))
            supplier_price_hist_rows.append(item)
        await session.execute(insert(SupplierResourcePriceHistory), supplier_price_hist_rows)

        inv_log_rows = []
        _, raw_inv_logs = build_mapping(data["inventory_log"])
        for item in raw_inv_logs:
            item["sku_id"] = sku_map.get(str(item["sku_id"]))
            item["inventory_date"] = _as_date(item.get("inventory_date"))
            related = item.get("related_order_id")
            item["related_order_id"] = order_map.get(str(related)) if related else None
            item["operated_at"] = _as_dt(item.get("operated_at"))
            inv_log_rows.append(item)
        await session.execute(insert(InventoryLog), inv_log_rows)

        order_hist_rows = []
        _, raw_order_hist = build_mapping(data["order_status_history"])
        for item in raw_order_hist:
            item["order_id"] = order_map.get(str(item["order_id"]))
            item["operated_at"] = _as_dt(item.get("operated_at"))
            order_hist_rows.append(item)
        await session.execute(insert(OrderStatusHistory), order_hist_rows)

        audit_rows = []
        _, raw_audit = build_mapping(data["audit_log"])
        table_map_lookup = {
            "product": product_map,
            "sku": sku_map,
            "price": price_map,
            "inventory": inventory_map,
            "order": order_map,
            "supplier": supplier_map,
            "supplier_resource": supplier_resource_map,
            "channel": channel_map,
            "poi": poi_map,
            "resource": resource_map,
        }
        for item in raw_audit:
            tbl = item.get("table_name")
            rec_id = str(item.get("record_id"))
            item["record_id"] = table_map_lookup.get(tbl, {}).get(rec_id, None)
            item["operated_at"] = _as_dt(item.get("operated_at"))
            audit_rows.append(item)
        await session.execute(insert(AuditLog), audit_rows)

        await session.commit()
        print("Seed completed.")


def main():
    parser = argparse.ArgumentParser(description="Seed database from mock JSON.")
    parser.add_argument("--mock-dir", type=Path, default=Path("../prototype/public/mock"), help="Path to mock JSON directory")
    args = parser.parse_args()

    asyncio.run(seed(args.mock_dir.resolve()))


if __name__ == "__main__":
    main()
