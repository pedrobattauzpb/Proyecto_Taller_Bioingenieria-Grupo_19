import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.notification import (
    AlertSeverity,
    AlertStatus,
    AlertSource,
    AlertScopeType,
    ChannelType,
    DeliveryStatus,
)


class NotificationDeliveryRead(BaseModel):
    id: int
    alert_id: int
    channel_id: Optional[int] = None
    channel_type: ChannelType
    target: str
    event: str
    status: DeliveryStatus
    attempts: int
    error: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertRead(BaseModel):
    id: int
    fingerprint: str
    rule_code: str
    source: AlertSource
    severity: AlertSeverity
    status: AlertStatus
    title: str
    message: str
    normative_ref: Optional[str] = None
    scope_type: AlertScopeType
    hospital_id: Optional[int] = None
    sector_id: Optional[int] = None
    asset_id: Optional[int] = None
    inspection_id: Optional[int] = None
    item_id: Optional[int] = None
    template_id: Optional[int] = None
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    is_provisional: bool
    occurrence_count: int
    first_detected_at: datetime
    last_detected_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None
    escalation_level: int
    last_escalated_at: Optional[datetime] = None
    silenced_until: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Campos desnormalizados para visualización rápida
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    sector_name: Optional[str] = None
    hospital_code: Optional[str] = None
    item_code: Optional[str] = None
    item_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AlertDetailRead(AlertRead):
    deliveries: List[NotificationDeliveryRead] = Field(default_factory=list)
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list)


class AlertListResponse(BaseModel):
    items: List[AlertRead]
    total: int
    counts_by_severity: Dict[str, int]
    counts_by_status: Dict[str, int]


class AlertSummary(BaseModel):
    open_total: int
    open_by_severity: Dict[str, int]
    unacknowledged_critical: int
    last_alert_at: Optional[datetime] = None
    health: str  # "OK" | "DEGRADED" | "CRITICAL"
    mtta_minutes: Optional[float] = None
    mttr_minutes: Optional[float] = None


class AlertAcknowledgeRequest(BaseModel):
    actor: str = Field(..., min_length=1)
    note: Optional[str] = None


class AlertResolveRequest(BaseModel):
    actor: str = Field(..., min_length=1)
    note: Optional[str] = None


class AlertSilenceRequest(BaseModel):
    actor: str = Field(..., min_length=1)
    until: datetime
    note: Optional[str] = None


class AlertBulkAckRequest(BaseModel):
    ids: List[int]
    actor: str = Field(..., min_length=1)


class NotificationChannelCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    channel_type: ChannelType
    target: str = Field(..., min_length=1, max_length=500)
    min_severity: AlertSeverity = AlertSeverity.INFO
    hospital_id: Optional[int] = None
    sector_id: Optional[int] = None
    is_active: bool = True
    secret: Optional[str] = None

    @field_validator("target")
    @classmethod
    def validate_target(cls, v: str, info) -> str:
        values = info.data
        ch_type = values.get("channel_type")
        v = v.strip()
        if ch_type == ChannelType.EMAIL:
            # Validación sencilla de formato de correo
            email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
            if not re.match(email_regex, v):
                raise ValueError("Dirección de correo electrónico inválida")
        elif ch_type == ChannelType.WEBHOOK:
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError("La URL del webhook debe comenzar con http:// o https://")
        return v


class NotificationChannelUpdate(BaseModel):
    name: Optional[str] = None
    channel_type: Optional[ChannelType] = None
    target: Optional[str] = None
    min_severity: Optional[AlertSeverity] = None
    hospital_id: Optional[int] = None
    sector_id: Optional[int] = None
    is_active: Optional[bool] = None
    secret: Optional[str] = None

    @field_validator("target")
    @classmethod
    def validate_target_update(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        ch_type = info.data.get("channel_type")
        if ch_type == ChannelType.EMAIL:
            email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
            if not re.match(email_regex, v):
                raise ValueError("Dirección de correo electrónico inválida")
        elif ch_type == ChannelType.WEBHOOK:
            if not (v.startswith("http://") or v.startswith("https://")):
                raise ValueError("La URL del webhook debe comenzar con http:// o https://")
        return v


class NotificationChannelRead(BaseModel):
    id: int
    name: str
    channel_type: ChannelType
    target: str
    min_severity: AlertSeverity
    hospital_id: Optional[int] = None
    sector_id: Optional[int] = None
    is_active: bool
    has_secret: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertRuleRead(BaseModel):
    id: int
    rule_code: str
    name: str
    description: Optional[str] = None
    is_enabled: bool
    severity_override: Optional[AlertSeverity] = None
    params: Optional[Dict[str, Any]] = None
    notify_external: bool
    escalate_after_minutes: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertRuleUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    severity_override: Optional[AlertSeverity] = None
    params: Optional[Dict[str, Any]] = None
    notify_external: Optional[bool] = None
    escalate_after_minutes: Optional[int] = None


class AlertStreamEvent(BaseModel):
    event: str
    data: Dict[str, Any]
