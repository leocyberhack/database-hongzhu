"""
Seed region tables (province/city/district) from data.json at repo root.

Usage:
  python -m scripts.seed_regions
  python -m scripts.seed_regions --data "../data.json"
  python -m scripts.seed_regions --reset
"""

import argparse
import asyncio
import json
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import SessionLocal
from app.models import RegionCity, RegionDistrict, RegionProvince


def is_zero(value: object | None) -> bool:
    if value is None:
        return True
    text = str(value)
    return text.strip("0") == ""


def build_region_rows(items: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    provinces: list[dict] = []
    cities: list[dict] = []
    districts: list[dict] = []
    seen_province: set[str] = set()
    seen_city: set[str] = set()
    seen_district: set[str] = set()
    province_name_map: dict[str, str] = {}
    district_city_codes: set[str] = set()

    for item in items:
        code = str(item.get("code", "")).strip()
        name = str(item.get("name", "")).strip()
        if not code or not name:
            continue

        city = item.get("city")
        area = item.get("area")
        town = item.get("town")

        if is_zero(city) and is_zero(area) and is_zero(town):
            if code not in seen_province:
                provinces.append({"code": code, "name": name})
                seen_province.add(code)
                province_name_map[code] = name
            continue

        if not is_zero(city) and is_zero(area) and is_zero(town):
            if code not in seen_city:
                cities.append({
                    "code": code,
                    "name": name,
                    "province_code": f"{code[:2]}0000",
                })
                seen_city.add(code)
            continue

        if not is_zero(city) and not is_zero(area) and is_zero(town):
            if code not in seen_district:
                city_code = f"{code[:4]}00"
                districts.append({
                    "code": code,
                    "name": name,
                    "province_code": f"{code[:2]}0000",
                    "city_code": city_code,
                })
                seen_district.add(code)
                district_city_codes.add(city_code)

    missing_city_codes = district_city_codes - seen_city
    for code in sorted(missing_city_codes):
        province_code = f"{code[:2]}0000"
        city_name = province_name_map.get(province_code, province_code)
        cities.append({
            "code": code,
            "name": city_name,
            "province_code": province_code,
        })
        seen_city.add(code)

    return provinces, cities, districts


async def seed(data_path: Path, reset: bool = False) -> None:
    if not data_path.exists():
        raise FileNotFoundError(f"data.json not found: {data_path}")

    with data_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    provinces, cities, districts = build_region_rows(raw)

    async with SessionLocal() as session:
        if reset:
            await session.execute(delete(RegionDistrict))
            await session.execute(delete(RegionCity))
            await session.execute(delete(RegionProvince))
            await session.commit()

        def chunks(rows: list[dict], size: int = 500):
            for i in range(0, len(rows), size):
                yield rows[i:i + size]

        if provinces:
            for batch in chunks(provinces):
                stmt = pg_insert(RegionProvince).values(batch)
                stmt = stmt.on_conflict_do_nothing(index_elements=["code"])
                await session.execute(stmt)

        if cities:
            for batch in chunks(cities):
                stmt = pg_insert(RegionCity).values(batch)
                stmt = stmt.on_conflict_do_nothing(index_elements=["code"])
                await session.execute(stmt)

        if districts:
            for batch in chunks(districts):
                stmt = pg_insert(RegionDistrict).values(batch)
                stmt = stmt.on_conflict_do_nothing(index_elements=["code"])
                await session.execute(stmt)

        await session.commit()

    print(f"Seeded provinces: {len(provinces)}, cities: {len(cities)}, districts: {len(districts)}.")


def main() -> None:
    default_path = Path(__file__).resolve().parents[2] / "data.json"
    parser = argparse.ArgumentParser(description="Seed province/city/district tables from data.json.")
    parser.add_argument("--data", type=Path, default=default_path, help="Path to data.json")
    parser.add_argument("--reset", action="store_true", help="Clear existing region tables before insert")
    args = parser.parse_args()

    asyncio.run(seed(args.data.resolve(), reset=args.reset))


if __name__ == "__main__":
    main()
