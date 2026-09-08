from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.inspection import Inspection
from app.models.compliance import ComplianceResult, AuditLog, AuditEventType
from app.schemas.compliance import (
    ComplianceSummary,
    ComplianceResultRead,
    AuditLogRead,
    AuditLogCreate,
)
from app.services.compliance_engine import ComplianceEngine

router = APIRouter()


@router.get("/inspections/{id}/compliance", response_model=ComplianceSummary, summary="Obtener auditoría normativa y resultados en tiempo real")
async def get_inspection_compliance(
    id: int,
    recalculate: bool = Query(True, description="Forzar re-cálculo en tiempo real mediante el ComplianceEngine"),
    db: AsyncSession = Depends(get_db)
):
    """
    Ejecuta el algoritmo de validación del ComplianceEngine sobre la inspección dada.
    Valida tolerancias de presión, reglas booleanas, completitud, referencias normativas y severidad.
    """
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección ID {id} no encontrada."
        )

    summary = await ComplianceEngine.validate_inspection_compliance(
        inspection_id=id,
        db=db,
        record_audit_log=recalculate,
        actor="API_COMPLIANCE_SERVICE"
    )
    return summary


@router.get("/inspections/{id}/compliance-summary", response_model=ComplianceSummary, summary="Resumen ejecutivo de cumplimiento normativo")
async def get_inspection_compliance_summary_fast(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Retorna el estado de auditoría y porcentaje de conformidad legal."""
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección ID {id} no encontrada."
        )

    return await ComplianceEngine.validate_inspection_compliance(
        inspection_id=id,
        db=db,
        record_audit_log=False,
        actor="SUMMARY_STUB"
    )


@router.get("/audit-logs", response_model=List[AuditLogRead], summary="Consultar bitácora de auditoría inmutable")
async def list_audit_logs(
    inspection_id: Optional[int] = Query(None, description="Filtrar por inspección"),
    event_type: Optional[AuditEventType] = Query(None, description="Filtrar por tipo de evento regulatorio"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    Acceso de sólo lectura (append-only) a la bitácora de auditoría técnica.
    Garantiza trazabilidad y no repudio para inspecciones de bioingeniería.
    """
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if inspection_id is not None:
        query = query.where(AuditLog.inspection_id == inspection_id)
    if event_type is not None:
        query = query.where(AuditLog.event_type == event_type)

    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()
