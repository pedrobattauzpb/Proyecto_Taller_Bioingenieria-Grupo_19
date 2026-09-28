"""
Ensamblador de datos para el motor de reportes técnicos.
Extrae y estructura la información de la base de datos relacional
para su posterior renderizado en PDF, Excel o visualización.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload, joinedload

from app.models.hierarchy import Hospital, Sector, Asset, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem
from app.models.inspection import Inspection, InspectionResponse, InspectionStatus
from app.models.evidence import InspectionEvidence
from app.models.compliance import (
    ComplianceResult,
    AuditLog,
    ComplianceStatus,
    ComplianceSeverity,
)
from app.services.compliance_engine import ComplianceEngine
from app.schemas.reports import (
    InspectionReportData,
    ReportItemResult,
    ReportEvidenceEntry,
    ReportAuditEntry,
    AssetHistoryReportData,
    ExecutiveReportData,
)


def _get_asset_type_display_name(asset_type: Any) -> str:
    """Retorna el nombre legible del tipo de activo clínico."""
    type_str = str(asset_type.value if hasattr(asset_type, "value") else asset_type)
    names = {
        "MANIFOLD": "Manifold Central de Suministro",
        "AVSU_VALVE": "Válvula de Corte de Área (AVSU)",
        "TERMINAL_UNIT": "Boca / Toma Terminal de Consumo",
        "PRESSURE_REGULATOR": "Estación Reguladora de Presión",
        "GAS_CYLINDER": "Cilindro / Envase a Presión (Res. 1130)",
        "PANEL_ALARMA": "Panel de Alarmas Clínicas",
        "POLIDUCTO": "Poliducto / Cabezal Quirúrgico",
        "COMPRESOR": "Central de Aire Comprimido",
    }
    return names.get(type_str, type_str)


async def assemble_inspection_report_data(
    inspection_id: int, db: AsyncSession
) -> Optional[InspectionReportData]:
    """
    Reúne y estructura toda la información de una inspección para el Acta Técnica PDF.
    """
    stmt = (
        select(Inspection)
        .where(Inspection.id == inspection_id)
        .options(
            selectinload(Inspection.asset)
            .selectinload(Asset.sector)
            .selectinload(Sector.hospital),
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses),
            selectinload(Inspection.evidences),
            selectinload(Inspection.audit_logs),
        )
    )
    res = await db.execute(stmt)
    inspection = res.scalar_one_or_none()
    if not inspection:
        return None

    # Ejecutar validación de compliance para obtener el resumen más fiel
    compliance_summary = await ComplianceEngine.validate_inspection_compliance(
        inspection_id=inspection.id,
        db=db,
        record_audit_log=False,
    )

    # Mapa de resultados de compliance por item_id
    compliance_by_item: Dict[int, Any] = {}
    for cr in compliance_summary.results:
        compliance_by_item[cr.item_id] = cr

    # Mapa de respuestas por item_id
    responses_by_item: Dict[int, InspectionResponse] = {
        r.item_id: r for r in inspection.responses
    }

    # Evidencias organizadas
    evidence_item_ids = {e.item_id for e in inspection.evidences if e.item_id}

    # Construir ítems de reporte ordenados
    report_items: List[ReportItemResult] = []
    sorted_items = sorted(
        inspection.template.items, key=lambda x: (x.order_index, x.id)
    )

    for item in sorted_items:
        resp = responses_by_item.get(item.id)
        comp = compliance_by_item.get(item.id)

        input_type_val = (
            item.input_type.value
            if hasattr(item.input_type, "value")
            else str(item.input_type)
        )

        comp_status = comp.compliance_status if comp else ComplianceStatus.NOT_EVALUATED
        status_val = (
            comp_status.value if hasattr(comp_status, "value") else str(comp_status)
        )

        comp_sev = comp.severity if comp else ComplianceSeverity.OBSERVATION
        sev_val = comp_sev.value if hasattr(comp_sev, "value") else str(comp_sev)

        report_items.append(
            ReportItemResult(
                order_index=item.order_index,
                code=item.code,
                title=item.title,
                description=item.description,
                input_type=input_type_val,
                unit=item.unit,
                is_mandatory=item.is_mandatory,
                normative_ref=item.referencia_normativa,
                val_boolean=resp.val_boolean if resp else None,
                val_numeric=resp.val_numeric if resp else None,
                val_text=resp.val_text if resp else None,
                observations=resp.observations if resp else None,
                min_value=item.min_value,
                max_value=item.max_value,
                compliance_status=status_val,
                severity=sev_val,
                expected_value=comp.expected_value if comp else None,
                actual_value=comp.actual_value if comp else None,
                deviation_detail=comp.deviation_detail if comp else None,
                has_evidence=(item.id in evidence_item_ids),
            )
        )

    # Formatear evidencias
    evidences_list: List[ReportEvidenceEntry] = [
        ReportEvidenceEntry(
            id=e.id,
            item_id=e.item_id,
            file_type=(
                e.file_type.value
                if hasattr(e.file_type, "value")
                else str(e.file_type)
            ),
            storage_url=e.storage_url,
            file_size_bytes=e.file_size_bytes,
            uploaded_at=e.uploaded_at,
            uploaded_by=e.uploaded_by,
        )
        for e in inspection.evidences
    ]

    # Formatear bitácora de auditoría
    audit_trail: List[ReportAuditEntry] = [
        ReportAuditEntry(
            id=a.id,
            event_type=(
                a.event_type.value
                if hasattr(a.event_type, "value")
                else str(a.event_type)
            ),
            event_detail=a.event_detail,
            actor=a.actor or "SYSTEM",
            created_at=a.created_at,
        )
        for a in inspection.audit_logs
    ]

    asset = inspection.asset
    sector = asset.sector if asset else None
    hospital = sector.hospital if sector else None

    status_str = (
        inspection.status.value
        if hasattr(inspection.status, "value")
        else str(inspection.status)
    )

    return InspectionReportData(
        hospital_name=hospital.name if hospital else "Hospital Clínico",
        hospital_code=hospital.code if hospital else "HOSP-01",
        hospital_address=hospital.address if hospital else None,
        sector_name=sector.name if sector else "Sector General",
        sector_floor=sector.floor_level if sector else None,
        asset_id=asset.id if asset else 0,
        asset_name=asset.name if asset else "Activo Desconocido",
        asset_tag=asset.tag_code if asset else "TAG-N/A",
        asset_type=_get_asset_type_display_name(asset.asset_type) if asset else "N/A",
        asset_serial=asset.serial_number if asset else None,
        asset_qr=asset.qr_code if asset else None,
        inspection_id=inspection.id,
        inspector_name=inspection.inspector_name or "Inspector Técnico",
        status=status_str,
        started_at=inspection.started_at,
        completed_at=inspection.completed_at,
        notes=inspection.notes,
        template_title=inspection.template.title if inspection.template else "Checklist",
        template_version=inspection.template.version if inspection.template else "1.0",
        items=report_items,
        compliance_summary=compliance_summary,
        normative_currency=compliance_summary.normative_currency,
        evidences=evidences_list,
        audit_trail=audit_trail,
    )


async def assemble_asset_history_report_data(
    asset_id: int, db: AsyncSession
) -> Optional[AssetHistoryReportData]:
    """
    Reúne el historial completo y métricas de un activo clínico.
    """
    stmt = (
        select(Asset)
        .where(Asset.id == asset_id)
        .options(
            selectinload(Asset.sector).selectinload(Sector.hospital),
            selectinload(Asset.inspections).selectinload(Inspection.compliance_results),
            selectinload(Asset.inspections).selectinload(Inspection.evidences),
            selectinload(Asset.inspections).selectinload(Inspection.template),
        )
    )
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        return None

    sector = asset.sector
    hospital = sector.hospital if sector else None

    # Ordenar inspecciones de más reciente a más antigua
    sorted_inspections = sorted(
        asset.inspections, key=lambda x: x.started_at, reverse=True
    )

    total_inspections = len(sorted_inspections)
    completed_inspections = sum(
        1 for i in sorted_inspections if i.status == InspectionStatus.COMPLETED
    )

    # Desvíos por ítem para detectar fallas recurrentes
    deviation_counts: Dict[str, Dict[str, Any]] = {}
    history_entries: List[Dict[str, Any]] = []
    compliance_pcts: List[float] = []

    for insp in sorted_inspections:
        # Calcular cumplimiento de esta inspección
        results = insp.compliance_results
        total_items = len(results)
        compliant_items = sum(
            1 for r in results if r.compliance_status == ComplianceStatus.COMPLIANT
        )
        non_compliant_count = sum(
            1 for r in results if r.compliance_status == ComplianceStatus.NON_COMPLIANT
        )

        pct = (compliant_items / total_items * 100.0) if total_items > 0 else 100.0
        compliance_pcts.append(pct)

        history_entries.append({
            "id": insp.id,
            "started_at": insp.started_at.strftime("%d/%m/%Y %H:%M"),
            "completed_at": (
                insp.completed_at.strftime("%d/%m/%Y %H:%M")
                if insp.completed_at
                else "En Curso"
            ),
            "inspector_name": insp.inspector_name,
            "status": (
                insp.status.value
                if hasattr(insp.status, "value")
                else str(insp.status)
            ),
            "template_title": insp.template.title if insp.template else "Checklist",
            "compliance_percentage": round(pct, 1),
            "non_compliant_count": non_compliant_count,
            "evidence_count": len(insp.evidences),
            "notes": insp.notes,
        })

        # Acumular no conformidades para recurrentes
        for r in results:
            if r.compliance_status == ComplianceStatus.NON_COMPLIANT:
                key = r.normative_ref or f"item-{r.item_id}"
                if key not in deviation_counts:
                    deviation_counts[key] = {
                        "normative_ref": key,
                        "count": 0,
                        "severity": (
                            r.severity.value
                            if hasattr(r.severity, "value")
                            else str(r.severity)
                        ),
                        "last_detail": r.deviation_detail or "Sin detalle",
                    }
                deviation_counts[key]["count"] += 1

    avg_compliance = (
        sum(compliance_pcts) / len(compliance_pcts) if compliance_pcts else 100.0
    )

    recurrent = sorted(
        deviation_counts.values(), key=lambda x: x["count"], reverse=True
    )

    return AssetHistoryReportData(
        hospital_name=hospital.name if hospital else "Hospital Clínico",
        sector_name=sector.name if sector else "Sector General",
        asset_id=asset.id,
        asset_name=asset.name,
        asset_tag=asset.tag_code,
        asset_type=_get_asset_type_display_name(asset.asset_type),
        asset_serial=asset.serial_number,
        asset_qr=asset.qr_code,
        is_active=asset.is_active,
        total_inspections=total_inspections,
        completed_inspections=completed_inspections,
        average_compliance_percentage=round(avg_compliance, 1),
        last_inspection_date=(
            sorted_inspections[0].started_at if sorted_inspections else None
        ),
        history_entries=history_entries,
        recurrent_deviations=recurrent,
    )


async def assemble_executive_report_data(
    hospital_id: Optional[int], db: AsyncSession
) -> Optional[ExecutiveReportData]:
    """
    Reúne los datos agregados para el Informe Ejecutivo Institucional de Calidad y Normativa.
    """
    # Buscar hospital
    if hospital_id:
        h_stmt = select(Hospital).where(Hospital.id == hospital_id)
    else:
        h_stmt = select(Hospital).order_by(Hospital.id)

    h_res = await db.execute(h_stmt)
    hospital = h_res.scalars().first()
    if not hospital:
        return None

    # Cargar sectores del hospital con activos e inspecciones
    sec_stmt = (
        select(Sector)
        .where(Sector.hospital_id == hospital.id)
        .options(
            selectinload(Sector.assets)
            .selectinload(Asset.inspections)
            .selectinload(Inspection.compliance_results)
        )
    )
    sec_res = await db.execute(sec_stmt)
    sectors = sec_res.scalars().all()

    total_sectors = len(sectors)
    total_assets = sum(len(s.assets) for s in sectors)
    active_assets = sum(sum(1 for a in s.assets if a.is_active) for s in sectors)

    all_inspections: List[Inspection] = []
    for s in sectors:
        for a in s.assets:
            all_inspections.extend(a.inspections)

    total_inspections = len(all_inspections)
    completed_inspections = sum(
        1 for i in all_inspections if i.status == InspectionStatus.COMPLETED
    )
    in_progress_inspections = total_inspections - completed_inspections

    # Compliance por sector
    sector_stats: List[Dict[str, Any]] = []
    all_compliance_percentages: List[float] = []

    for s in sectors:
        s_inspections: List[Inspection] = []
        for a in s.assets:
            s_inspections.extend(a.inspections)

        s_total = len(s_inspections)
        s_completed = sum(
            1 for i in s_inspections if i.status == InspectionStatus.COMPLETED
        )

        # Calcular compliance promedio del sector
        s_pcts = []
        for i in s_inspections:
            results = i.compliance_results
            if results:
                comp_count = sum(
                    1 for r in results if r.compliance_status == ComplianceStatus.COMPLIANT
                )
                s_pcts.append(comp_count / len(results) * 100.0)

        s_avg_pct = round(sum(s_pcts) / len(s_pcts), 1) if s_pcts else 100.0
        all_compliance_percentages.extend(s_pcts)

        sector_stats.append({
            "sector_id": s.id,
            "sector_name": s.name,
            "floor_level": s.floor_level or "P.B.",
            "total_assets": len(s.assets),
            "total_inspections": s_total,
            "completed_inspections": s_completed,
            "compliance_percentage": s_avg_pct,
        })

    # Compliance por tipo de activo
    asset_type_map: Dict[str, Dict[str, Any]] = {}
    for s in sectors:
        for a in s.assets:
            t_name = _get_asset_type_display_name(a.asset_type)
            if t_name not in asset_type_map:
                asset_type_map[t_name] = {
                    "asset_type": t_name,
                    "count": 0,
                    "inspections": 0,
                    "compliance_pcts": [],
                }
            asset_type_map[t_name]["count"] += 1
            for i in a.inspections:
                asset_type_map[t_name]["inspections"] += 1
                if i.compliance_results:
                    comp = sum(
                        1
                        for r in i.compliance_results
                        if r.compliance_status == ComplianceStatus.COMPLIANT
                    )
                    asset_type_map[t_name]["compliance_pcts"].append(
                        comp / len(i.compliance_results) * 100.0
                    )

    asset_type_stats = []
    for t_name, info in asset_type_map.items():
        pcts = info["compliance_pcts"]
        avg_pct = round(sum(pcts) / len(pcts), 1) if pcts else 100.0
        asset_type_stats.append({
            "asset_type": t_name,
            "total_assets": info["count"],
            "total_inspections": info["inspections"],
            "compliance_percentage": avg_pct,
        })

    # Distribución de severidades y Top activos con no conformidades
    severity_dist: Dict[str, int] = {
        "CRITICAL": 0,
        "MAJOR": 0,
        "MINOR": 0,
        "OBSERVATION": 0,
    }
    asset_deviations: Dict[int, Dict[str, Any]] = {}

    for s in sectors:
        for a in s.assets:
            for i in a.inspections:
                for r in i.compliance_results:
                    sev = (
                        r.severity.value
                        if hasattr(r.severity, "value")
                        else str(r.severity)
                    )
                    if sev in severity_dist:
                        severity_dist[sev] += 1

                    if r.compliance_status == ComplianceStatus.NON_COMPLIANT:
                        if a.id not in asset_deviations:
                            asset_deviations[a.id] = {
                                "asset_id": a.id,
                                "asset_name": a.name,
                                "tag_code": a.tag_code,
                                "sector_name": s.name,
                                "non_compliant_count": 0,
                                "critical_count": 0,
                            }
                        asset_deviations[a.id]["non_compliant_count"] += 1
                        if sev == "CRITICAL":
                            asset_deviations[a.id]["critical_count"] += 1

    top_risk = sorted(
        asset_deviations.values(),
        key=lambda x: (x["critical_count"], x["non_compliant_count"]),
        reverse=True,
    )[:5]

    global_pct = (
        round(
            sum(all_compliance_percentages) / len(all_compliance_percentages), 1
        )
        if all_compliance_percentages
        else 100.0
    )

    return ExecutiveReportData(
        hospital_name=hospital.name,
        hospital_code=hospital.code,
        generated_at=datetime.now(timezone.utc),
        total_sectors=total_sectors,
        total_assets=total_assets,
        active_assets=active_assets,
        total_inspections=total_inspections,
        completed_inspections=completed_inspections,
        in_progress_inspections=in_progress_inspections,
        global_compliance_percentage=global_pct,
        sector_stats=sector_stats,
        asset_type_stats=asset_type_stats,
        severity_distribution=severity_dist,
        top_risk_assets=top_risk,
    )
