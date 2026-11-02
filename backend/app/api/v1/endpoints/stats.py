from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.permissions import Permission, ROLE_PERMISSIONS
from app.models.hierarchy import Asset, Sector
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.inspection import Inspection, InspectionResponse, InspectionStatus
from app.models.compliance import NormativeReference
from app.models.user import User
from app.schemas.inspection import StatsOverviewResponse, InspectionHistoryItem
from app.schemas.evidence import InspectionEvidenceRead
from app.services.storage import storage_service
from app.services.access_control import scope_filter_hospital_ids, assert_hospital_in_scope
from app.api.deps import require_permissions, require_any_permission

router = APIRouter()


@router.get("/stats", response_model=StatsOverviewResponse, summary="Métricas generales resumidas (Dashboard)")
async def get_dashboard_stats(
    user: User = Depends(require_permissions(Permission.STATS_READ)),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna métricas de actividad (conteos de activos e inspecciones)
    filtradas estrictamente según el alcance institucional del usuario.
    """
    allowed_hospitals = scope_filter_hospital_ids(user)

    # Conteo de activos
    asset_query = select(func.count(Asset.id)).join(Sector, Asset.sector_id == Sector.id)
    if allowed_hospitals is not None:
        asset_query = asset_query.where(Sector.hospital_id.in_(allowed_hospitals))
    total_assets = (await db.execute(asset_query)).scalar() or 0

    active_query = select(func.count(Asset.id)).join(Sector, Asset.sector_id == Sector.id).where(Asset.is_active == True)
    if allowed_hospitals is not None:
        active_query = active_query.where(Sector.hospital_id.in_(allowed_hospitals))
    active_assets = (await db.execute(active_query)).scalar() or 0

    # Conteo de inspecciones
    insp_base = (
        select(func.count(Inspection.id))
        .join(Asset, Inspection.asset_id == Asset.id)
        .join(Sector, Asset.sector_id == Sector.id)
    )
    if allowed_hospitals is not None:
        insp_base = insp_base.where(Sector.hospital_id.in_(allowed_hospitals))

    total_inspections = (await db.execute(insp_base)).scalar() or 0
    completed_inspections = (await db.execute(insp_base.where(Inspection.status == InspectionStatus.COMPLETED))).scalar() or 0
    in_progress_inspections = (await db.execute(insp_base.where(Inspection.status == InspectionStatus.IN_PROGRESS))).scalar() or 0
    draft_inspections = (await db.execute(insp_base.where(Inspection.status == InspectionStatus.DRAFT))).scalar() or 0

    # Últimas 5 inspecciones con visibilidad de rol (O+C para técnico)
    recent_query = (
        select(Inspection)
        .join(Asset, Inspection.asset_id == Asset.id)
        .join(Sector, Asset.sector_id == Sector.id)
        .options(
            joinedload(Inspection.asset),
            joinedload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item)
        )
        .order_by(Inspection.started_at.desc())
    )
    if allowed_hospitals is not None:
        recent_query = recent_query.where(Sector.hospital_id.in_(allowed_hospitals))

    user_perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    if Permission.INSPECTIONS_READ_ALL not in user_perms:
        recent_query = recent_query.where(
            or_(
                Inspection.inspector_id == user.id,
                Inspection.status == InspectionStatus.COMPLETED
            )
        )

    recent_query = recent_query.limit(5)
    recent_res = await db.execute(recent_query)
    recent_inspections_raw = recent_res.scalars().all()

    recent_items: List[InspectionHistoryItem] = []
    for insp in recent_inspections_raw:
        total_items = len(insp.template.items) if insp.template and insp.template.items else 0
        evaluated_items = len(insp.responses)
        non_compliant = sum(
            1 for r in insp.responses
            if (r.val_boolean is False) or (
                r.val_numeric is not None and r.item and (
                    (r.item.min_value is not None and r.val_numeric < r.item.min_value) or
                    (r.item.max_value is not None and r.val_numeric > r.item.max_value)
                )
            )
        )

        recent_items.append(
            InspectionHistoryItem(
                id=insp.id,
                asset_id=insp.asset_id,
                asset_name=insp.asset.name if insp.asset else "Activo Desconocido",
                asset_tag=insp.asset.tag_code if insp.asset else "N/A",
                asset_type=insp.asset.asset_type.value if insp.asset else "N/A",
                template_title=insp.template.title if insp.template else "Checklist",
                inspector_name=insp.inspector_name,
                inspector_id=insp.inspector_id,
                completed_by_id=insp.completed_by_id,
                status=insp.status,
                started_at=insp.started_at,
                completed_at=insp.completed_at,
                total_items=total_items,
                evaluated_items=evaluated_items,
                non_compliant_count=non_compliant
            )
        )

    # Conteo de normas desactualizadas
    outdated_res = await db.execute(select(func.count(NormativeReference.id)).where(NormativeReference.is_current == False))
    active_outdated_norms_count = outdated_res.scalar() or 0

    total_eval_items = sum(i.evaluated_items for i in recent_items)
    total_non_comp = sum(i.non_compliant_count for i in recent_items)
    if total_eval_items > 0:
        global_comp_pct = round(((total_eval_items - total_non_comp) / total_eval_items) * 100.0, 1)
    else:
        global_comp_pct = 100.0

    return StatsOverviewResponse(
        total_assets=total_assets,
        active_assets=active_assets,
        total_inspections=total_inspections,
        completed_inspections=completed_inspections,
        in_progress_inspections=in_progress_inspections,
        draft_inspections=draft_inspections,
        recent_inspections=recent_items,
        global_compliance_percentage=global_comp_pct,
        active_outdated_norms_count=active_outdated_norms_count
    )


@router.get("/assets/{id}/history", response_model=List[InspectionHistoryItem], summary="Historial cronológico de inspecciones de un activo")
async def get_asset_inspection_history(
    id: int,
    user: User = Depends(require_any_permission(
        Permission.INSPECTIONS_READ_OWN,
        Permission.INSPECTIONS_READ_ALL,
        Permission.INSPECTIONS_READ_COMPLETED
    )),
    db: AsyncSession = Depends(get_db)
):
    stmt_asset = select(Asset).options(selectinload(Asset.sector)).where(Asset.id == id)
    res_asset = await db.execute(stmt_asset)
    asset = res_asset.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo con ID {id} no encontrado"
        )

    if asset.sector:
        assert_hospital_in_scope(user, asset.sector.hospital_id)

    query = (
        select(Inspection)
        .options(
            joinedload(Inspection.asset),
            joinedload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item),
            selectinload(Inspection.evidences)
        )
        .where(Inspection.asset_id == id)
        .order_by(Inspection.started_at.desc())
    )

    user_perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    if Permission.INSPECTIONS_READ_ALL not in user_perms:
        # Técnico: solo ve propias o cerradas ajenas (O+C)
        query = query.where(
            or_(
                Inspection.inspector_id == user.id,
                Inspection.status == InspectionStatus.COMPLETED
            )
        )

    result = await db.execute(query)
    inspections = result.scalars().all()

    history_items: List[InspectionHistoryItem] = []
    for insp in inspections:
        total_items = len(insp.template.items) if insp.template and insp.template.items else 0
        evaluated_items = len(insp.responses)
        non_compliant = sum(
            1 for r in insp.responses
            if (r.val_boolean is False) or (
                r.val_numeric is not None and r.item and (
                    (r.item.min_value is not None and r.val_numeric < r.item.min_value) or
                    (r.item.max_value is not None and r.val_numeric > r.item.max_value)
                )
            )
        )

        evidences_read = [
            InspectionEvidenceRead(
                id=ev.id,
                inspection_id=ev.inspection_id,
                item_id=ev.item_id,
                file_type=ev.file_type,
                storage_url=ev.storage_url,
                presigned_url=storage_service.get_presigned_url(ev.storage_url),
                file_size_bytes=ev.file_size_bytes,
                uploaded_by=ev.uploaded_by,
                uploaded_at=ev.uploaded_at
            )
            for ev in (insp.evidences or [])
        ]

        history_items.append(
            InspectionHistoryItem(
                id=insp.id,
                asset_id=insp.asset_id,
                asset_name=insp.asset.name if insp.asset else "Activo Desconocido",
                asset_tag=insp.asset.tag_code if insp.asset else "N/A",
                asset_type=insp.asset.asset_type.value if insp.asset else "N/A",
                template_title=insp.template.title if insp.template else "Checklist",
                inspector_name=insp.inspector_name,
                inspector_id=insp.inspector_id,
                completed_by_id=insp.completed_by_id,
                status=insp.status,
                started_at=insp.started_at,
                completed_at=insp.completed_at,
                notes=insp.notes,
                total_items=total_items,
                evaluated_items=evaluated_items,
                non_compliant_count=non_compliant,
                evidences=evidences_read
            )
        )

    return history_items
