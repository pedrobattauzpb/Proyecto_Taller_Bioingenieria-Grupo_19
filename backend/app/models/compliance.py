import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Float,
    Text,
    Date,
    DateTime,
    ForeignKey,
    Enum,
    JSON,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ComplianceStatus(str, enum.Enum):
    COMPLIANT = "COMPLIANT"
    NON_COMPLIANT = "NON_COMPLIANT"
    WARNING = "WARNING"
    NOT_EVALUATED = "NOT_EVALUATED"


class ComplianceSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"
    OBSERVATION = "OBSERVATION"


class AuditEventType(str, enum.Enum):
    VALIDATION_RUN = "VALIDATION_RUN"
    COMPLIANCE_CHECK = "COMPLIANCE_CHECK"
    NORM_UPDATE = "NORM_UPDATE"
    TEMPLATE_VERSION_CHANGE = "TEMPLATE_VERSION_CHANGE"
    INSPECTION_COMPLETED = "INSPECTION_COMPLETED"


class NormativeReference(Base):
    """Catálogo maestro de normas aplicables (ej: ISO 7396-1:2016, Res. MSAL 1130/2000)"""
    __tablename__ = "normative_references"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    issuing_body = Column(String(100), nullable=False)
    publication_date = Column(Date, nullable=True)
    current_version = Column(String(50), nullable=False, default="1.0")
    is_current = Column(Boolean, default=True, nullable=False)
    superseded_by_id = Column(Integer, ForeignKey("normative_references.id", ondelete="SET NULL"), nullable=True)
    url_reference = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relaciones
    superseded_by = relationship("NormativeReference", remote_side=[id], backref="supersedes")
    versions = relationship("NormativeVersion", back_populates="reference", cascade="all, delete-orphan")


class NormativeVersion(Base):
    """Historial y control de versiones o enmiendas normativas"""
    __tablename__ = "normative_versions"

    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(Integer, ForeignKey("normative_references.id", ondelete="CASCADE"), nullable=False)
    version_code = Column(String(50), nullable=False)
    effective_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    changelog = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relaciones
    reference = relationship("NormativeReference", back_populates="versions")
    compliance_results = relationship("ComplianceResult", back_populates="normative_version")


class ComplianceResult(Base):
    """Evaluación puntual de cumplimiento normativo por ítem de inspección"""
    __tablename__ = "compliance_results"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("checklist_items.id", ondelete="CASCADE"), nullable=False, index=True)
    response_id = Column(Integer, ForeignKey("inspection_responses.id", ondelete="CASCADE"), nullable=True, index=True)
    compliance_status = Column(Enum(ComplianceStatus), default=ComplianceStatus.NOT_EVALUATED, nullable=False)
    normative_ref = Column(String(150), nullable=False)
    expected_value = Column(String(255), nullable=True)
    actual_value = Column(String(255), nullable=True)
    deviation_detail = Column(Text, nullable=True)
    severity = Column(Enum(ComplianceSeverity), default=ComplianceSeverity.MINOR, nullable=False)
    validated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    normative_version_id = Column(Integer, ForeignKey("normative_versions.id", ondelete="SET NULL"), nullable=True)

    # Relaciones
    inspection = relationship("Inspection", backref="compliance_results")
    item = relationship("ChecklistItem")
    response = relationship("InspectionResponse")
    normative_version = relationship("NormativeVersion", back_populates="compliance_results")


class AuditLog(Base):
    """Bitácora inmutable (append-only) para trazabilidad regulatoria y de inspecciones"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(Enum(AuditEventType), nullable=False, index=True)
    event_detail = Column(JSON, nullable=False)
    actor = Column(String(255), nullable=False, default="SYSTEM")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relación
    inspection = relationship("Inspection", backref="audit_logs")
