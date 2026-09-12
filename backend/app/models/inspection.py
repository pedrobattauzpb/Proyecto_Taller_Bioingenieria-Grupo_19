import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class InspectionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("checklist_templates.id", ondelete="RESTRICT"), nullable=False)
    inspector_name = Column(String(255), nullable=False)
    status = Column(Enum(InspectionStatus), default=InspectionStatus.DRAFT, nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    # Campos reservados para fases futuras (Firma/Inspector y Adjuntos multimedia)
    inspector_id = Column(Integer, nullable=True)
    attachments = Column(JSON, nullable=True)
    
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)

    # Relaciones
    asset = relationship("Asset", back_populates="inspections")
    component = relationship("Component", back_populates="inspections")
    template = relationship("ChecklistTemplate", back_populates="inspections")
    responses = relationship("InspectionResponse", back_populates="inspection", cascade="all, delete-orphan")
    evidences = relationship("InspectionEvidence", back_populates="inspection", cascade="all, delete-orphan")


class InspectionResponse(Base):
    __tablename__ = "inspection_responses"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("checklist_items.id", ondelete="CASCADE"), nullable=False)
    val_boolean = Column(Boolean, nullable=True)
    val_numeric = Column(Float, nullable=True)
    val_text = Column(Text, nullable=True)
    observations = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relaciones
    inspection = relationship("Inspection", back_populates="responses")
    item = relationship("ChecklistItem", back_populates="responses")
