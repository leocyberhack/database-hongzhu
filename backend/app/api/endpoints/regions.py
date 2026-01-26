from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import RegionProvince, RegionCity, RegionDistrict
from app.schemas.region import RegionProvinceRead, RegionCityRead, RegionDistrictRead

router = APIRouter()


@router.get("/regions/provinces", response_model=list[RegionProvinceRead])
async def list_provinces(
    db: DbSession,
    _: User = Depends(get_current_user),
):
    rows = await db.scalars(select(RegionProvince).order_by(RegionProvince.code.asc()))
    return [RegionProvinceRead.model_validate(r) for r in rows]


@router.get("/regions/cities", response_model=list[RegionCityRead])
async def list_cities(
    db: DbSession,
    _: User = Depends(get_current_user),
    province_code: str = Query(..., description="Province code, e.g. 110000"),
):
    rows = await db.scalars(
        select(RegionCity)
        .where(RegionCity.province_code == province_code)
        .order_by(RegionCity.code.asc())
    )
    return [RegionCityRead.model_validate(r) for r in rows]


@router.get("/regions/districts", response_model=list[RegionDistrictRead])
async def list_districts(
    db: DbSession,
    _: User = Depends(get_current_user),
    city_code: str = Query(..., description="City code, e.g. 110100"),
):
    rows = await db.scalars(
        select(RegionDistrict)
        .where(RegionDistrict.city_code == city_code)
        .order_by(RegionDistrict.code.asc())
    )
    return [RegionDistrictRead.model_validate(r) for r in rows]
