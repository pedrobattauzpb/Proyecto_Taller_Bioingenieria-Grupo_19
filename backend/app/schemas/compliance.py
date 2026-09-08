from typing import List, Optional, Any, Dict
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict
from app.models.compliance import ComplianceStatus, ComplianceSeverity, AuditEventType


# --- Normativas ---
class NormativeVersionBase(BaseModel):
    version_code: str
    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    changelog: Optional[str] = None
    is_active: bool = True


class NormativeVersionCreate(NormativeVersionBase):
    reference_id: int


class NormativeVersionRead(NormativeVersionBase):
    id: int
    reference_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NormativeReferenceBase(BaseModel):
    code: str
    title: str
    issuing_body: str
    publication_date: Optional[date] = None
    current_version: str = "1.0"
    is_current: bool = True
    superseded_by_id: Optional[int] = None
    url_reference: Optional[str] = None
    description: Optional[str] = None


class NormativeReferenceCreate(NormativeReferenceBase):
    pass


class NormativeReferenceUpdate(BaseModel):
    title: Optional[str] = None
    issuing_body: Optional[str] = None
    publication_date: Optional[date] = None
    current_version: Optional[str] = None
    is_current: Optional[bool] = None
    superseded_by_id: Optional[int] = None
    url_reference: Optional[str] = None
    description: Optional[str] = None


class NormativeReferenceRead(NormativeReferenceBase):
    id: int
    created_at: datetime
    versions: List[NormativeVersionRead] = []

    model_config = ConfigDict(from_attributes=True)


# --- Verificación de Vigencia ---
class NormativeClauseCheck(BaseModel):
    item_id: int
    item_code: str
    item_title: str
    referencia_normativa: str
    matched_norm_code: Optional[str] = None
    is_current: bool
    status_message: str
    suggested_replacement: Optional[str] = None


class NormativeCurrencyReport(BaseModel):
    template_id: int
    template_title: str
    asset_type: str
    all_current: bool
    total_items: int
    current_items_count: int
    outdated_items_count: int
    clauses: List[NormativeClauseCheck] = []


# --- Resultados de Compliance ---
class ComplianceResultBase(BaseModel):
    item_id: int
    compliance_status: ComplianceStatus
    normative_ref: str
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    deviation_detail: Optional[str] = None
    severity: ComplianceSeverity = ComplianceSeverity.MINOR
    normative_version_id: Optional[int] = None


class ComplianceResultRead(ComplianceResultBase):
    id: int
    inspection_id: int
    response_id: Optional[int] = None
    validated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplianceSummary(BaseModel):
    inspection_id: int
    status: str
    total_items: int
    evaluated_items: int
    compliant_items: int
    non_compliant_items: int
    warning_items: int
    pending_items: int
    compliance_percentage: float
    is_fully_compliant: bool
    critical_deviations_count: int
    major_deviations_count: int
    minor_deviations_count: int
    observation_deviations_count: int
    normative_currency: NormativeCurrencyReport
    results: List[ComplianceResultRead] = []


# --- Bitácora de Auditoría (AuditLog) ---
class AuditLogBase(BaseModel):
    inspection_id: Optional[int] = None
    event_type: AuditEventType
    event_detail: Dict[str, Any]
    actor: str = "SYSTEM"


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogRead(AuditLogBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
