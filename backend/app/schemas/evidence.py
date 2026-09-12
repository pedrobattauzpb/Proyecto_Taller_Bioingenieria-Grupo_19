from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.evidence import FileType


class InspectionEvidenceBase(BaseModel):
    item_id: Optional[int] = None
    file_type: FileType
    file_size_bytes: Optional[int] = None
    uploaded_by: Optional[str] = None


class InspectionEvidenceCreate(InspectionEvidenceBase):
    pass


class InspectionEvidenceRead(InspectionEvidenceBase):
    id: int
    inspection_id: int
    storage_url: str
    presigned_url: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
