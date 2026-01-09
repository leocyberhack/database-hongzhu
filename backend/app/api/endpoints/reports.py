from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import Order
from app.schemas.report import ReportPoint, ReportResponse, TopItem

router = APIRouter()


def _grain_field(grain: str):
    if grain not in {"day", "week", "month"}:
        grain = "day"
    return func.date_trunc(grain, Order.created_at)


@router.get("/reports/summary", response_model=ReportResponse)
async def report_summary(
    db: DbSession,
    _: User = Depends(require_roles(["admin", "super_admin", "operator"])),
    grain: str = Query(default="day", description="day|week|month"),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    field = _grain_field(grain)
    stmt = select(
        field.label("period"),
        func.sum(Order.sale_amount).label("gmv"),
        func.sum(Order.profit_amount).label("profit"),
        func.count().label("orders"),
        func.sum(case((Order.status == "verified", 1), else_=0)).label("verified"),
        func.sum(case((Order.status == "refunded", 1), else_=0)).label("refunded"),
    ).select_from(Order)
    if start_date:
        stmt = stmt.where(Order.created_at >= start_date)
    if end_date:
        stmt = stmt.where(Order.created_at < end_date + func.make_interval(days=1))
    stmt = stmt.group_by("period").order_by("period")
    rows = await db.execute(stmt)
    trend = [
        ReportPoint(
            period=str(r.period.date() if hasattr(r.period, "date") else r.period),
            gmv=float(r.gmv or 0),
            profit=float(r.profit or 0),
            orders=int(r.orders or 0),
            verified=int(r.verified or 0),
            refunded=int(r.refunded or 0),
        )
        for r in rows
    ]

    def top_stmt(dim: str):
        return (
            select(
                getattr(Order, dim).label("key"),
                func.sum(Order.sale_amount).label("gmv"),
                func.sum(Order.profit_amount).label("profit"),
                func.count().label("orders"),
            )
            .group_by(getattr(Order, dim))
            .order_by(func.sum(Order.sale_amount).desc())
            .limit(5)
        )

    filter_stmt = []
    if start_date:
        filter_stmt.append(Order.created_at >= start_date)
    if end_date:
        filter_stmt.append(Order.created_at < end_date + func.make_interval(days=1))

    async def fetch_top(dim: str):
        stmt = top_stmt(dim)
        if filter_stmt:
            stmt = stmt.where(*filter_stmt)
        res = await db.execute(stmt)
        return [
            TopItem(
                key=str(r.key),
                gmv=float(r.gmv or 0),
                profit=float(r.profit or 0),
                orders=int(r.orders or 0),
            )
            for r in res
        ]

    top_channel = await fetch_top("channel_id")
    top_sku = await fetch_top("sku_id")
    top_product = await fetch_top("product_id")

    return ReportResponse(trend=trend, top_channel=top_channel, top_sku=top_sku, top_product=top_product)
