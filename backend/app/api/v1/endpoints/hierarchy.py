from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.hierarchy import Hospital, Sector, Asset
from app.models.user import User, UserRole
from app.schemas.hierarchy import (
    HospitalCreate, HospitalRead,
    SectorCreate, SectorRead,
    AssetCreate, AssetUpdate, AssetRead,
    HierarchyTreeResponse, HierarchyMetrics
)
from app.api.deps import require_permissions
from app.services.access_control import scope_filter_hospital_ids, assert_hospital_in_scope

router = APIRouter()


@router.get("", response_model=HierarchyTreeResponse, summary="Obtener árbol jerárquico hospitalario")
async def get_hierarchy_tree(
    user: User = Depends(require_permissions(Permission.HIERARCHY_READ)),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna el árbol de Hospital -> Sectores -> Activos filtrado
    según el alcance asignado al usuario autenticado.
    """
    stmt = (
        select(Hospital)
        .options(
            selectinload(Hospital.sectors).selectinload(Sector.assets)
        )
        .order_by(Hospital.name)
    )

    allowed_hospitals = scope_filter_hospital_ids(user)
    if allowed_hospitals is not None:
        stmt = stmt.where(Hospital.id.in_(allowed_hospitals))

    result = await db.execute(stmt)
    hospitals = result.scalars().all()

    # Métricas de conteo sobre los hospitales visibles
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
async def create_hospital(
    hospital_in: HospitalCreate,
    user: User = Depends(require_permissions(Permission.HIERARCHY_WRITE)),
    db: AsyncSession = Depends(get_db)
):
    # La creación de una nueva institución hospitalaria queda reservada a ADMIN
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo un Administrador puede dar de alta nuevos hospitales")

    hospital = Hospital(**hospital_in.model_dump())
    db.add(hospital)
    await db.commit()
    stmt = select(Hospital).options(selectinload(Hospital.sectors)).where(Hospital.id == hospital.id)
    res = await db.execute(stmt)
    return res.scalar_one()


@router.post("/sectors", response_model=SectorRead, status_code=status.HTTP_201_CREATED)
async def create_sector(
    sector_in: SectorCreate,
    user: User = Depends(require_permissions(Permission.HIERARCHY_WRITE)),
    db: AsyncSession = Depends(get_db)
):
    assert_hospital_in_scope(user, sector_in.hospital_id)
    sector = Sector(**sector_in.model_dump())
    db.add(sector)
    await db.commit()
    stmt = select(Sector).options(selectinload(Sector.assets)).where(Sector.id == sector.id)
    res = await db.execute(stmt)
    return res.scalar_one()


@router.post("/assets", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset_in: AssetCreate,
    user: User = Depends(require_permissions(Permission.HIERARCHY_WRITE)),
    db: AsyncSession = Depends(get_db)
):
    sector = await db.get(Sector, asset_in.sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail="Sector no encontrado")
    assert_hospital_in_scope(user, sector.hospital_id)

    asset = Asset(**asset_in.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.put("/assets/{id}", response_model=AssetRead, summary="Actualizar activo")
async def update_asset(
    id: int,
    asset_in: AssetUpdate,
    user: User = Depends(require_permissions(Permission.HIERARCHY_WRITE)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Asset).options(selectinload(Asset.sector)).where(Asset.id == id)
    res = await db.execute(stmt)
    asset = res.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    if asset.sector:
        assert_hospital_in_scope(user, asset.sector.hospital_id)

    update_data = asset_in.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(asset, k, v)

    await db.flush()

    if "hydraulic_test_date" in update_data:
        from datetime import datetime, timezone
        from app.services.notifications.evaluators import evaluate_cylinder_hydro_tests
        from app.services.notifications.alert_engine import AlertEngine

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        exp_fps, soon_fps = await evaluate_cylinder_hydro_tests(db, now)
        await AlertEngine.auto_resolve(
            db,
            fingerprints_vivos=exp_fps,
            scope_filter={"asset_id": asset.id, "rule_code": "CYL-HYDRO-EXPIRED"},
        )
        await AlertEngine.auto_resolve(
            db,
            fingerprints_vivos=soon_fps,
            scope_filter={"asset_id": asset.id, "rule_code": "CYL-HYDRO-SOON"},
        )

    await db.commit()
    await db.refresh(asset)
    return asset
