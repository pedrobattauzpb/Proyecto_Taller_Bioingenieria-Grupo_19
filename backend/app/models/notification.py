import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Enum,
    JSON,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class AlertSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class AlertStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    AUTO_RESOLVED = "AUTO_RESOLVED"
    SILENCED = "SILENCED"


class AlertSource(str, enum.Enum):
    COMPLIANCE = "COMPLIANCE"
    SCHEDULER = "SCHEDULER"
    INSPECTION_LIFECYCLE = "INSPECTION_LIFECYCLE"
    NORMATIVE = "NORMATIVE"
    MANUAL = "MANUAL"


class AlertScopeType(str, enum.Enum):
    INSPECTION = "INSPECTION"
    ASSET = "ASSET"
    TEMPLATE = "TEMPLATE"
    NORMATIVE = "NORMATIVE"
    SYSTEM = "SYSTEM"


class ChannelType(str, enum.Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    WEBHOOK = "WEBHOOK"


class DeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    fingerprint = Column(String(64), nullable=False, index=True)
    rule_code = Column(String(50), nullable=False, index=True)
    source = Column(Enum(AlertSource), nullable=False)
    severity = Column(Enum(AlertSeverity), nullable=False, index=True)
    status = Column(Enum(AlertStatus), nullable=False, default=AlertStatus.OPEN, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    normative_ref = Column(String(150), nullable=True)
    scope_type = Column(Enum(AlertScopeType), nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=True, index=True)
    item_id = Column(Integer, ForeignKey("checklist_items.id", ondelete="SET NULL"), nullable=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id", ondelete="SET NULL"), nullable=True)
    expected_value = Column(String(255), nullable=True)
    actual_value = Column(String(255), nullable=True)
    context = Column(JSON, nullable=True)
    is_provisional = Column(Boolean, nullable=False, default=False)
    occurrence_count = Column(Integer, nullable=False, default=1)
    first_detected_at = Column(DateTime, nullable=False, default=utc_now_naive)
    last_detected_at = Column(DateTime, nullable=False, default=utc_now_naive)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(255), nullable=True)
    resolution_note = Column(Text, nullable=True)
    escalation_level = Column(Integer, nullable=False, default=0)
    last_escalated_at = Column(DateTime, nullable=True)
    silenced_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)

    # Relaciones
    hospital = relationship("Hospital", lazy="select")
    sector = relationship("Sector", lazy="select")
    asset = relationship("Asset", lazy="select")
    inspection = relationship("Inspection", lazy="select")
    item = relationship("ChecklistItem", lazy="select")
    template = relationship("ChecklistTemplate", lazy="select")
    deliveries = relationship("NotificationDelivery", back_populates="alert", cascade="all, delete-orphan")


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    channel_type = Column(Enum(ChannelType), nullable=False)
    target = Column(String(500), nullable=False)
    min_severity = Column(Enum(AlertSeverity), nullable=False, default=AlertSeverity.INFO)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    sector_id = Column(Integer, ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    secret = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)

    # Relaciones
    hospital = relationship("Hospital", lazy="select")
    sector = relationship("Sector", lazy="select")


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, nullable=False, default=True)
    severity_override = Column(Enum(AlertSeverity), nullable=True)
    params = Column(JSON, nullable=True)
    notify_external = Column(Boolean, nullable=False, default=True)
    escalate_after_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="SET NULL"), nullable=True)
    channel_type = Column(Enum(ChannelType), nullable=False)
    target = Column(String(500), nullable=False)
    event = Column(String(30), nullable=False)  # "RAISED", "ESCALATED", "RESOLVED", "DIGEST"
    status = Column(Enum(DeliveryStatus), nullable=False, default=DeliveryStatus.PENDING)
    attempts = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)

    # Relaciones
    alert = relationship("Alert", back_populates="deliveries")
    channel = relationship("NotificationChannel", lazy="select")
