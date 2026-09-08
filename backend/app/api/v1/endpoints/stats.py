from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.models.hierarchy import Asset
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.inspection import Inspection, InspectionResponse, InspectionStatus
from app.models.compliance import NormativeReference
from app.schemas.inspection import StatsOverviewResponse, InspectionHistoryItem


router = APIRouter()


@router.get("/stats", response_model=StatsOverviewResponse, summary="Métricas generales resumidas (Dashboard Stub)")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Stub simple de métricas de actividad (conteos de activos e inspecciones)
    para alimentar el dashboard de la Fase 1 (no motor de reportes automáticos de Objetivo 4).
    """
    # Conteo de activos
    total_assets_res = await db.execute(select(func.count(Asset.id)))
    total_assets = total_assets_res.scalar() or 0

    active_assets_res = await db.execute(select(func.count(Asset.id)).where(Asset.is_active == True))
    active_assets = active_assets_res.scalar() or 0

    # Conteo de inspecciones por estado
    total_inspections_res = await db.execute(select(func.count(Inspection.id)))
    total_inspections = total_inspections_res.scalar() or 0

    completed_res = await db.execute(select(func.count(Inspection.id)).where(Inspection.status == InspectionStatus.COMPLETED))
    completed_inspections = completed_res.scalar() or 0

    in_progress_res = await db.execute(select(func.count(Inspection.id)).where(Inspection.status == InspectionStatus.IN_PROGRESS))
    in_progress_inspections = in_progress_res.scalar() or 0

    draft_res = await db.execute(select(func.count(Inspection.id)).where(Inspection.status == InspectionStatus.DRAFT))
    draft_inspections = draft_res.scalar() or 0

    # Últimas 5 inspecciones
    recent_query = (
        select(Inspection)
        .options(
            joinedload(Inspection.asset),
            joinedload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item)
        )
        .order_by(Inspection.started_at.desc())
        .limit(5)
    )
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

    # Porcentaje global de cumplimiento normativo (promedio de inspecciones evaluadas)
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
async def get_asset_inspection_history(id: int, db: AsyncSession = Depends(get_db)):
    asset = await db.get(Asset, id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo con ID {id} no encontrado"
        )

    query = (
        select(Inspection)
        .options(
            joinedload(Inspection.asset),
            joinedload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item)
        )
        .where(Inspection.asset_id == id)
        .order_by(Inspection.started_at.desc())
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

        history_items.append(
            InspectionHistoryItem(
                id=insp.id,
                asset_id=insp.asset_id,
                asset_name=insp.asset.name if insp.asset else "Activo Desconocido",
                asset_tag=insp.asset.tag_code if insp.asset else "N/A",
                asset_type=insp.asset.asset_type.value if insp.asset else "N/A",
                template_title=insp.template.title if insp.template else "Checklist",
                inspector_name=insp.inspector_name,
                status=insp.status,
                started_at=insp.started_at,
                completed_at=insp.completed_at,
                total_items=total_items,
                evaluated_items=evaluated_items,
                non_compliant_count=non_compliant
            )
        )

    return history_items
