"""
Endpoints de API para la generación, consulta y descarga de reportes técnicos,
actas de inspección, historiales de componentes y resúmenes ejecutivos.
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import Permission
from app.api.deps import require_permissions
from app.services.access_control import (
    assert_can_read_inspection,
    assert_hospital_in_scope,
    scope_filter_hospital_ids,
)
from app.models.user import User
from app.models.inspection import Inspection
from app.models.hierarchy import Asset
from app.services.report_engine import (
    InspectionPDFGenerator,
    AssetHistoryPDFGenerator,
    ExecutivePDFGenerator,
    InspectionExcelGenerator,
    ExecutiveExcelGenerator,
    assemble_inspection_report_data,
    assemble_asset_history_report_data,
    assemble_executive_report_data,
)
from app.schemas.reports import ExecutiveReportData

router = APIRouter(prefix="/reports", tags=["Reportes Técnicos y Normativos"])

# Instancias reutilizables de generadores
_pdf_gen = InspectionPDFGenerator()
_history_pdf_gen = AssetHistoryPDFGenerator()
_executive_pdf_gen = ExecutivePDFGenerator()
_excel_gen = InspectionExcelGenerator()
_executive_excel_gen = ExecutiveExcelGenerator()


@router.get(
    "/inspections/{inspection_id}/pdf",
    summary="Descargar Acta de Inspección Técnica en PDF",
    response_description="Archivo PDF del Acta Formal de Inspección",
)
async def download_inspection_pdf(
    inspection_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.REPORTS_INSPECTION)),
):
    """
    Genera y descarga el **Acta Oficial de Inspección Técnica** en formato PDF A4.
    Requiere permiso `reports:inspection` y valida regla O+C.
    """
    stmt = (
        select(Inspection)
        .where(Inspection.id == inspection_id)
        .options(selectinload(Inspection.asset).selectinload(Asset.sector))
    )
    res = await db.execute(stmt)
    inspection = res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección #{inspection_id} no encontrada.",
        )

    await assert_can_read_inspection(current_user, inspection, db)

    data = await assemble_inspection_report_data(inspection_id, db)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección #{inspection_id} no encontrada.",
        )

    pdf_buffer = _pdf_gen.generate(data)

    safe_tag = "".join(c for c in data.asset_tag if c.isalnum() or c in ("-", "_"))
    date_str = data.started_at.strftime("%Y%m%d")
    filename = f"Acta_Inspeccion_{data.inspection_id}_{safe_tag}_{date_str}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/inspections/{inspection_id}/excel",
    summary="Exportar Datos de Inspección a Excel (.xlsx)",
    response_description="Libro de cálculo Excel con hojas de Resumen, Checklist y Evidencias",
)
async def download_inspection_excel(
    inspection_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.REPORTS_INSPECTION)),
):
    """
    Exporta la auditoría completa en formato Microsoft Excel (.xlsx) estructurado.
    Requiere permiso `reports:inspection` y valida regla O+C.
    """
    stmt = (
        select(Inspection)
        .where(Inspection.id == inspection_id)
        .options(selectinload(Inspection.asset).selectinload(Asset.sector))
    )
    res = await db.execute(stmt)
    inspection = res.scalar_one_or_none()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección #{inspection_id} no encontrada.",
        )

    await assert_can_read_inspection(current_user, inspection, db)

    data = await assemble_inspection_report_data(inspection_id, db)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección #{inspection_id} no encontrada.",
        )

    excel_buffer = _excel_gen.generate(data)

    safe_tag = "".join(c for c in data.asset_tag if c.isalnum() or c in ("-", "_"))
    date_str = data.started_at.strftime("%Y%m%d")
    filename = f"Inspeccion_{data.inspection_id}_{safe_tag}_{date_str}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/assets/{asset_id}/history-pdf",
    summary="Descargar Informe Histórico del Componente en PDF",
    response_description="Archivo PDF con trazabilidad cronológica y análisis de fallas recurrentes",
)
async def download_asset_history_pdf(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.REPORTS_ASSET_HISTORY)),
):
    """
    Genera el informe histórico completo de un activo clínico.
    Requiere permiso `reports:asset_history` y valida pertenencia de hospital.
    """
    stmt = (
        select(Asset)
        .where(Asset.id == asset_id)
        .options(selectinload(Asset.sector))
    )
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset or not asset.sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo #{asset_id} no encontrado.",
        )

    assert_hospital_in_scope(current_user, asset.sector.hospital_id)

    data = await assemble_asset_history_report_data(asset_id, db)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo #{asset_id} no encontrado.",
        )

    pdf_buffer = _history_pdf_gen.generate(data)

    safe_tag = "".join(c for c in data.asset_tag if c.isalnum() or c in ("-", "_"))
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"Historial_Activo_{safe_tag}_{date_str}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/executive/pdf",
    summary="Descargar Informe Ejecutivo Institucional en PDF",
    response_description="Informe gerencial con KPIs globales, cumplimiento por sector y matriz de riesgo",
)
async def download_executive_pdf(
    hospital_id: Optional[int] = Query(None, description="ID del hospital a auditar"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.REPORTS_EXECUTIVE)),
):
    """
    Genera el Informe Ejecutivo Institucional para Dirección Médica y Calidad.
    Requiere permiso `reports:executive` (Supervisor, Auditor, Admin).
    """
    target_hospital_id = hospital_id
    if target_hospital_id is not None:
        assert_hospital_in_scope(current_user, target_hospital_id)
    else:
        allowed_ids = scope_filter_hospital_ids(current_user)
        if allowed_ids is not None:
            if not allowed_ids:
                raise HTTPException(status_code=404, detail="No hay hospitales asignados.")
            target_hospital_id = allowed_ids[0]
        else:
            target_hospital_id = None

    data = await assemble_executive_report_data(target_hospital_id, db)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontraron registros hospitalarios para emitir el informe ejecutivo.",
        )

    pdf_buffer = _executive_pdf_gen.generate(data)

    safe_code = "".join(c for c in data.hospital_code if c.isalnum() or c in ("-", "_"))
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"Informe_Ejecutivo_{safe_code}_{date_str}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/executive/excel",
    summary="Exportar Informe Ejecutivo Institucional a Excel (.xlsx)",
    response_description="Libro de cálculo con KPIs globales, tablas por sector y tipos de activos",
)
async def download_executive_excel(
    hospital_id: Optional[int] = Query(None, description="ID del hospital a auditar"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.REPORTS_EXECUTIVE)),
):
    """
    Exporta todas las métricas institucionales en formato Excel estructurado con hojas separadas.
    Requiere permiso `reports:executive` (Supervisor, Auditor, Admin).
    """
    target_hospital_id = hospital_id
    if target_hospital_id is not None:
        assert_hospital_in_scope(current_user, target_hospital_id)
    else:
        allowed_ids = scope_filter_hospital_ids(current_user)
        if allowed_ids is not None:
            if not allowed_ids:
                raise HTTPException(status_code=404, detail="No hay hospitales asignados.")
            target_hospital_id = allowed_ids[0]
        else:
            target_hospital_id = None

    data = await assemble_executive_report_data(target_hospital_id, db)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontraron registros hospitalarios para exportar.",
        )

    excel_buffer = _executive_excel_gen.generate(data)

    safe_code = "".join(c for c in data.hospital_code if c.isalnum() or c in ("-", "_"))
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"Informe_Ejecutivo_{safe_code}_{date_str}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/executive/data",
    response_model=ExecutiveReportData,
    summary="Obtener Datos de Reporte Ejecutivo en JSON (Dashboard/Charts)",
)
async def get_executive_report_data(
    hospital_id: Optional[int] = Query(None, description="ID del hospital"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.REPORTS_EXECUTIVE)),
):
    """
    Retorna los datos agregados del informe ejecutivo en JSON para alimentar
    directamente los gráficos interactivos (Recharts) en la interfaz de usuario.
    Requiere permiso `reports:executive` (Supervisor, Auditor, Admin).
    """
    target_hospital_id = hospital_id
    if target_hospital_id is not None:
        assert_hospital_in_scope(current_user, target_hospital_id)
    else:
        allowed_ids = scope_filter_hospital_ids(current_user)
        if allowed_ids is not None:
            if not allowed_ids:
                raise HTTPException(status_code=404, detail="No hay hospitales asignados.")
            target_hospital_id = allowed_ids[0]
        else:
            target_hospital_id = None

    data = await assemble_executive_report_data(target_hospital_id, db)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital no encontrado.",
        )
    return data
