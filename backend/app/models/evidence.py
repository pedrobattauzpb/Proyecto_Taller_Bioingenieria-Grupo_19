import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class FileType(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"

class InspectionEvidence(Base):
    __tablename__ = "inspection_evidences"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("checklist_items.id", ondelete="SET NULL"), nullable=True)
    file_type = Column(Enum(FileType), nullable=False)
    storage_url = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    uploaded_by = Column(Integer, nullable=True) # Could be a FK to a Users table if one existed

    # Relaciones
    inspection = relationship("Inspection", back_populates="evidences")
    item = relationship("ChecklistItem")
