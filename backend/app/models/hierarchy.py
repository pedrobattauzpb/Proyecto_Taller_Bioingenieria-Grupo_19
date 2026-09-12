import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class AssetType(str, enum.Enum):
    MANIFOLD = "MANIFOLD"
    AVSU_VALVE = "AVSU_VALVE"
    TERMINAL_UNIT = "TERMINAL_UNIT"
    PRESSURE_REGULATOR = "PRESSURE_REGULATOR"
    GAS_CYLINDER = "GAS_CYLINDER"
    PANEL_ALARMA = "PANEL_ALARMA"
    POLIDUCTO = "POLIDUCTO"
    COMPRESOR = "COMPRESOR"


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    address = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relaciones
    sectors = relationship("Sector", back_populates="hospital", cascade="all, delete-orphan")


class Sector(Base):
    __tablename__ = "sectors"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    floor_level = Column(String(50), nullable=True)

    # Relaciones
    hospital = relationship("Hospital", back_populates="sectors")
    assets = relationship("Asset", back_populates="sector", cascade="all, delete-orphan")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    sector_id = Column(Integer, ForeignKey("sectors.id", ondelete="CASCADE"), nullable=False)
    tag_code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    serial_number = Column(String(100), nullable=True, index=True)
    installation_date = Column(Date, nullable=True)
    qr_code = Column(String(255), unique=True, index=True, nullable=True)

    # Relaciones
    sector = relationship("Sector", back_populates="assets")
    inspections = relationship("Inspection", back_populates="asset", cascade="all, delete-orphan")
