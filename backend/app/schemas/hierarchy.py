from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict
from app.models.hierarchy import AssetType


class AssetBase(BaseModel):
    tag_code: str
    name: str
    asset_type: AssetType
    is_active: bool = True
    hydraulic_test_date: Optional[date] = None
    inspection_interval_days: Optional[int] = None


class AssetCreate(AssetBase):
    sector_id: int
    serial_number: Optional[str] = None
    installation_date: Optional[date] = None
    qr_code: Optional[str] = None


class AssetUpdate(BaseModel):
    tag_code: Optional[str] = None
    name: Optional[str] = None
    asset_type: Optional[AssetType] = None
    is_active: Optional[bool] = None
    hydraulic_test_date: Optional[date] = None
    inspection_interval_days: Optional[int] = None
    serial_number: Optional[str] = None
    installation_date: Optional[date] = None
    qr_code: Optional[str] = None


class AssetRead(AssetBase):
    id: int
    sector_id: int
    serial_number: Optional[str] = None
    installation_date: Optional[date] = None
    qr_code: Optional[str] = None

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
