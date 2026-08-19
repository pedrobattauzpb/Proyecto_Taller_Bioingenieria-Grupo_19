from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.hierarchy import Hospital, Sector, Asset
from app.schemas.hierarchy import (
    HospitalCreate, HospitalRead,
    SectorCreate, SectorRead,
    AssetCreate, AssetRead,
    HierarchyTreeResponse, HierarchyMetrics
)

router = APIRouter()


@router.get("", response_model=HierarchyTreeResponse, summary="Obtener árbol jerárquico hospitalario")
async def get_hierarchy_tree(db: AsyncSession = Depends(get_db)):
    """
    Retorna el árbol completo de Hospital -> Sectores -> Activos
    junto con métricas globales de conteo para la cascada de selección.
    """
    result = await db.execute(
        select(Hospital)
        .options(
            selectinload(Hospital.sectors).selectinload(Sector.assets)
        )
        .order_by(Hospital.name)
    )
    hospitals = result.scalars().all()

    # Métricas de conteo
    total_hospitals = len(hospitals)
    total_sectors = sum(len(h.sectors) for h in hospitals)
    total_assets = sum(sum(len(s.assets) for s in h.sectors) for h in hospitals)
    active_assets = sum(sum(len([a for a in s.assets if a.is_active]) for s in h.sectors) for h in hospitals)

    return HierarchyTreeResponse(
        hospitals=hospitals,
        metrics=HierarchyMetrics(
            total_hospitals=total_hospitals,
            total_sectors=total_sectors,
            total_assets=total_assets,
            active_assets=active_assets
        )
    )


@router.post("/hospitals", response_model=HospitalRead, status_code=status.HTTP_201_CREATED)
async def create_hospital(hospital_in: HospitalCreate, db: AsyncSession = Depends(get_db)):
    hospital = Hospital(**hospital_in.model_dump())
    db.add(hospital)
    await db.commit()
    await db.refresh(hospital)
    return hospital


@router.post("/sectors", response_model=SectorRead, status_code=status.HTTP_201_CREATED)
async def create_sector(sector_in: SectorCreate, db: AsyncSession = Depends(get_db)):
    sector = Sector(**sector_in.model_dump())
    db.add(sector)
    await db.commit()
    await db.refresh(sector)
    return sector


@router.post("/assets", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset(asset_in: AssetCreate, db: AsyncSession = Depends(get_db)):
    asset = Asset(**asset_in.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset
