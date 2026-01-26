from pydantic import BaseModel

from app.schemas.common import ORMBase


class RegionProvinceRead(ORMBase):
    code: str
    name: str


class RegionCityRead(ORMBase):
    code: str
    name: str
    province_code: str


class RegionDistrictRead(ORMBase):
    code: str
    name: str
    province_code: str
    city_code: str
