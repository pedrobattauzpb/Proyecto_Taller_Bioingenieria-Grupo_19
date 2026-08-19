import enum
from sqlalchemy import Column, Integer, String, Boolean, Float, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.hierarchy import AssetType


class ItemType(str, enum.Enum):
    BOOLEAN = "BOOLEAN"
    NUMERIC = "NUMERIC"
    TEXT = "TEXT"


class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False, index=True)
    version = Column(String(20), default="1.0", nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relaciones
    items = relationship("ChecklistItem", back_populates="template", cascade="all, delete-orphan", order_by="ChecklistItem.order_index")
    inspections = relationship("Inspection", back_populates="template")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    code = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    input_type = Column(Enum(ItemType), default=ItemType.BOOLEAN, nullable=False)
    unit = Column(String(50), nullable=True)
    is_mandatory = Column(Boolean, default=True, nullable=False)
    referencia_normativa = Column(String(100), nullable=False, default="ISO 7396-1")
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)

    # Relaciones
    template = relationship("ChecklistTemplate", back_populates="items")
    responses = relationship("InspectionResponse", back_populates="item", cascade="all, delete-orphan")
