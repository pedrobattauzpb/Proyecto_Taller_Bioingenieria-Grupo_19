import enum
from datetime import date
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class ComponentType(str, enum.Enum):
    PANEL_ALARMA = "PANEL_ALARMA"
    POLIDUCTO = "POLIDUCTO"
    CILINDRO = "CILINDRO"
    COMPRESOR = "COMPRESOR"

class Component(Base):
    __tablename__ = "components"

    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectors.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(ComponentType), nullable=False, index=True)
    serial_number = Column(String(100), nullable=True, index=True)
    installation_date = Column(Date, nullable=True)
    qr_code = Column(String(255), unique=True, index=True, nullable=True)

    # Relaciones
    sector = relationship("Sector")
    inspections = relationship("Inspection", back_populates="component", cascade="all, delete-orphan")
