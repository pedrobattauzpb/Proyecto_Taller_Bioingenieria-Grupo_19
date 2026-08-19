from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.hierarchy import AssetType


class AssetBase(BaseModel):
    tag_code: str
    name: str
    asset_type: AssetType
    is_active: bool = True


class AssetCreate(AssetBase):
    sector_id: int


class AssetRead(AssetBase):
    id: int
    sector_id: int

    model_config = ConfigDict(from_attributes=True)


class SectorBase(BaseModel):
    name: str
    floor_level: Optional[str] = None


class SectorCreate(SectorBase):
    hospital_id: int


class SectorRead(SectorBase):
    id: int
    hospital_id: int
    assets: List[AssetRead] = []

    model_config = ConfigDict(from_attributes=True)


class HospitalBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None


class HospitalCreate(HospitalBase):
    pass


class HospitalRead(HospitalBase):
    id: int
    created_at: datetime
    sectors: List[SectorRead] = []

    model_config = ConfigDict(from_attributes=True)


class HierarchyMetrics(BaseModel):
    total_hospitals: int
    total_sectors: int
    total_assets: int
    active_assets: int


class HierarchyTreeResponse(BaseModel):
    hospitals: List[HospitalRead]
    metrics: HierarchyMetrics
