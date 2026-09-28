from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.compliance import ComplianceSummary, NormativeCurrencyReport


class ReportItemResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_index: int
    code: str
    title: str
    description: Optional[str] = None
    input_type: str  # "BOOLEAN", "NUMERIC", "TEXT"
    unit: Optional[str] = None
    is_mandatory: bool
    normative_ref: str

    # Respuesta del inspector
    val_boolean: Optional[bool] = None
    val_numeric: Optional[float] = None
    val_text: Optional[str] = None
    observations: Optional[str] = None

    # Tolerancias
    min_value: Optional[float] = None
    max_value: Optional[float] = None

    # Resultado de compliance
    compliance_status: str  # "COMPLIANT", "NON_COMPLIANT", "WARNING", "NOT_EVALUATED"
    severity: str  # "CRITICAL", "MAJOR", "MINOR", "OBSERVATION"
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    deviation_detail: Optional[str] = None
    has_evidence: bool = False


class ReportEvidenceEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: Optional[int] = None
    file_type: str
    storage_url: str
    file_size_bytes: Optional[int] = None
    uploaded_at: datetime
    uploaded_by: Optional[str] = None


class ReportAuditEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    event_detail: Optional[Dict[str, Any]] = None
    actor: str
    created_at: datetime


class InspectionReportData(BaseModel):
    """Estructura canónica de datos para el Acta de Inspección Técnica."""
    model_config = ConfigDict(from_attributes=True)

    # Cabecera institucional
    hospital_name: str
    hospital_code: str
    hospital_address: Optional[str] = None
    sector_name: str
    sector_floor: Optional[str] = None

    # Activo auditado
    asset_id: int
    asset_name: str
    asset_tag: str
    asset_type: str
    asset_serial: Optional[str] = None
    asset_qr: Optional[str] = None

    # Inspección
    inspection_id: int
    inspector_name: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None

    # Plantilla
    template_title: str
    template_version: str

    # Ítems evaluados y desvíos
    items: List[ReportItemResult]

    # Resumen de compliance
    compliance_summary: ComplianceSummary

    # Vigencia normativa
    normative_currency: Optional[NormativeCurrencyReport] = None

    # Evidencias
    evidences: List[ReportEvidenceEntry] = []

    # Bitácora de auditoría
    audit_trail: List[ReportAuditEntry] = []


class AssetHistoryReportData(BaseModel):
    """Estructura canónica para el informe histórico de un activo."""
    model_config = ConfigDict(from_attributes=True)

    hospital_name: str
    sector_name: str
    asset_id: int
    asset_name: str
    asset_tag: str
    asset_type: str
    asset_serial: Optional[str] = None
    asset_qr: Optional[str] = None
    is_active: bool

    total_inspections: int
    completed_inspections: int
    average_compliance_percentage: float
    last_inspection_date: Optional[datetime] = None

    # Historial cronológico resumido
    history_entries: List[Dict[str, Any]] = []

    # Desvíos recurrentes (ítems con fallas repetidas)
    recurrent_deviations: List[Dict[str, Any]] = []


class ExecutiveReportData(BaseModel):
    """Estructura canónica para el informe ejecutivo institucional."""
    model_config = ConfigDict(from_attributes=True)

    hospital_name: str
    hospital_code: str
    generated_at: datetime

    total_sectors: int
    total_assets: int
    active_assets: int
    total_inspections: int
    completed_inspections: int
    in_progress_inspections: int
    global_compliance_percentage: float

    # Compliance por sector
    sector_stats: List[Dict[str, Any]] = []

    # Compliance por tipo de activo
    asset_type_stats: List[Dict[str, Any]] = []

    # Distribución de severidades de desvíos activos
    severity_distribution: Dict[str, int] = {}

    # Top activos con no conformidades
    top_risk_assets: List[Dict[str, Any]] = []
