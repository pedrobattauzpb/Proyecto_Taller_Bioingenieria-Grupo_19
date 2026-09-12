from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.inspection import InspectionStatus
from app.schemas.hierarchy import AssetRead
from app.schemas.checklist import ChecklistTemplateRead, ChecklistItemRead
from app.schemas.compliance import ComplianceSummary


class InspectionResponseBase(BaseModel):
    item_id: int
    val_boolean: Optional[bool] = None
    val_numeric: Optional[float] = None
    val_text: Optional[str] = None
    observations: Optional[str] = None


class InspectionResponseCreate(InspectionResponseBase):
    pass


class InspectionResponseRead(InspectionResponseBase):
    id: int
    inspection_id: int
    created_at: datetime
    item: Optional[ChecklistItemRead] = None

    model_config = ConfigDict(from_attributes=True)


class BatchInspectionResponsesRequest(BaseModel):
    responses: List[InspectionResponseBase]


class InspectionBase(BaseModel):
    asset_id: int
    template_id: Optional[int] = None
    inspector_name: str
    notes: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionRead(InspectionBase):
    id: int
    status: InspectionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    asset: Optional[AssetRead] = None
    template: Optional[ChecklistTemplateRead] = None

    model_config = ConfigDict(from_attributes=True)


from app.schemas.evidence import InspectionEvidenceRead


class InspectionDetailRead(InspectionRead):
    responses: List[InspectionResponseRead] = []
    evidences: List[InspectionEvidenceRead] = []
    total_items: int = 0
    completed_items: int = 0
    progress_percentage: float = 0.0
    compliance_summary: Optional[ComplianceSummary] = None

    model_config = ConfigDict(from_attributes=True)


class InspectionCompleteRequest(BaseModel):
    notes: Optional[str] = None
    inspector_name: Optional[str] = None


class InspectionHistoryItem(BaseModel):
    id: int
    asset_id: int
    asset_name: str
    asset_tag: str
    asset_type: str
    template_title: str
    inspector_name: str
    status: InspectionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_items: int
    evaluated_items: int
    non_compliant_count: int
    notes: Optional[str] = None
    evidences: List[InspectionEvidenceRead] = []

    model_config = ConfigDict(from_attributes=True)


class StatsOverviewResponse(BaseModel):
    total_assets: int
    active_assets: int
    total_inspections: int
    completed_inspections: int
    in_progress_inspections: int
    draft_inspections: int
    recent_inspections: List[InspectionHistoryItem] = []
    global_compliance_percentage: Optional[float] = 100.0
    active_outdated_norms_count: Optional[int] = 0

