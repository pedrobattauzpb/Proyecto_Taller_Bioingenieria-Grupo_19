from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import Permission, ROLE_PERMISSIONS
from app.models.inspection import Inspection, InspectionStatus
from app.models.compliance import ComplianceResult, AuditLog, AuditEventType
from app.models.hierarchy import Asset, Sector
from app.models.user import User, UserRole
from app.schemas.compliance import (
    ComplianceSummary,
    ComplianceResultRead,
    AuditLogRead,
    AuditLogCreate,
)
from app.services.compliance_engine import ComplianceEngine
from app.services.access_control import (
    assert_can_read_inspection,
    scope_filter_hospital_ids,
)
from app.api.deps import require_permissions, require_any_permission, get_request_context

router = APIRouter()


@router.get("/inspections/{id}/compliance", response_model=ComplianceSummary, summary="Obtener auditoría normativa y resultados en tiempo real")
async def get_inspection_compliance(
    id: int,
    recalculate: bool = Query(True, description="Forzar re-cálculo en tiempo real mediante el ComplianceEngine"),
    user: User = Depends(require_any_permission(Permission.COMPLIANCE_READ, Permission.COMPLIANCE_RECALCULATE)),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la evaluación de cumplimiento normativo.
    - Si recalculate=True: exige el permiso compliance:recalculate (no disponible para AUDITOR).
    - Si recalculate=False: exige compliance:read y retorna los resultados almacenados sin modificar la base.
    """
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección ID {id} no encontrada."
        )

    await assert_can_read_inspection(user, inspection, db)

    user_perms = ROLE_PERMISSIONS.get(user.role, frozenset())

    if recalculate:
        if Permission.COMPLIANCE_RECALCULATE not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes: el rol Auditor no tiene autorización para forzar re-cálculo normativo."
            )

        # Si es técnico, solo sobre inspecciones propias y abiertas
        if user.role == UserRole.TECHNICIAN:
            if inspection.inspector_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo puede forzar re-cálculo en inspecciones propias."
                )

        lic = f" (Mat. {user.professional_license})" if user.professional_license else ""
        actor_snapshot = f"{user.full_name}{lic} <{user.email}>"

        summary = await ComplianceEngine.validate_inspection_compliance(
            inspection_id=id,
            db=db,
            record_audit_log=True,
            actor=actor_snapshot
        )

        from app.services.notifications.hooks import on_compliance_evaluated
        await on_compliance_evaluated(db, inspection, summary)
        return summary
    else:
        # Read-only: no escribe en compliance_results ni en audit_logs
        return await ComplianceEngine.get_existing_compliance_summary(id, db)


@router.get("/inspections/{id}/compliance-summary", response_model=ComplianceSummary, summary="Resumen ejecutivo de cumplimiento normativo")
async def get_inspection_compliance_summary_fast(
    id: int,
    user: User = Depends(require_permissions(Permission.COMPLIANCE_READ)),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el estado de auditoría y porcentaje de conformidad legal sin escribir."""
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección ID {id} no encontrada."
        )

    await assert_can_read_inspection(user, inspection, db)
    return await ComplianceEngine.get_existing_compliance_summary(id, db)


@router.get("/audit-logs", response_model=List[AuditLogRead], summary="Consultar bitácora de auditoría inmutable")
async def list_audit_logs(
    inspection_id: Optional[int] = Query(None, description="Filtrar por inspección"),
    event_type: Optional[AuditEventType] = Query(None, description="Filtrar por tipo de evento regulatorio"),
    actor_user_id: Optional[int] = Query(None, description="Filtrar por usuario autor"),
    date_from: Optional[datetime] = Query(None, description="Fecha desde (ISO)"),
    date_to: Optional[datetime] = Query(None, description="Fecha hasta (ISO)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_permissions(Permission.AUDIT_LOGS_READ)),
    db: AsyncSession = Depends(get_db)
):
    """
    Acceso a la bitácora inmutable (append-only) filtrada según el alcance del usuario.
    SUPERVISOR y AUDITOR ven únicamente los eventos asociados a sus hospitales o eventos generales.
    """
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    conditions = []

    if inspection_id is not None:
        conditions.append(AuditLog.inspection_id == inspection_id)
    if event_type is not None:
        conditions.append(AuditLog.event_type == event_type)
    if actor_user_id is not None:
        conditions.append(AuditLog.actor_user_id == actor_user_id)
    if date_from is not None:
        conditions.append(AuditLog.created_at >= date_from)
    if date_to is not None:
        conditions.append(AuditLog.created_at <= date_to)

    allowed_hospitals = scope_filter_hospital_ids(user)
    if allowed_hospitals is not None:
        # Eventos sin inspección (login, users) o inspecciones dentro del alcance del usuario
        h_subquery = (
            select(Inspection.id)
            .join(Asset, Inspection.asset_id == Asset.id)
            .join(Sector, Asset.sector_id == Sector.id)
            .where(Sector.hospital_id.in_(allowed_hospitals))
        )
        conditions.append(
            or_(
                AuditLog.inspection_id.is_(None),
                AuditLog.inspection_id.in_(h_subquery)
            )
        )

    if conditions:
        query = query.where(and_(*conditions))

    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()
