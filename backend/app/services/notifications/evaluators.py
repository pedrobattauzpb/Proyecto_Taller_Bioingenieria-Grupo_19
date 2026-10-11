import logging
from datetime import datetime, timezone, timedelta, date
from typing import Tuple, Set, Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.hierarchy import Asset, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.inspection import Inspection, InspectionStatus, InspectionResponse
from app.models.compliance import NormativeReference, ComplianceResult, ComplianceStatus
from app.models.notification import (
    Alert,
    AlertSeverity,
    AlertSource,
    AlertScopeType,
)
from app.services.notifications.fingerprint import build_fingerprint
from app.services.notifications.alert_engine import AlertEngine
from app.services.notifications.templates import render_alert_title
from app.services.notifications.dispatcher import dispatcher

logger = logging.getLogger(__name__)


def get_current_time(now: Optional[datetime] = None) -> datetime:
    if now is not None:
        return now.replace(tzinfo=None) if now.tzinfo else now
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def evaluate_asset_overdue_and_due_soon(
    db: AsyncSession,
    now: datetime,
) -> Tuple[Set[str], Set[str]]:
    """
    Evalúa AST-INSP-OVERDUE y AST-INSP-DUE-SOON sobre activos en servicio.
    Retorna (overdue_fingerprints, due_soon_fingerprints).
    """
    overdue_fps: Set[str] = set()
    due_soon_fps: Set[str] = set()

    stmt = select(Asset).where(Asset.is_active == True)
    res = await db.execute(stmt)
    assets: List[Asset] = res.scalars().all()

    for asset in assets:
        # Buscar última inspección COMPLETED del activo
        insp_stmt = (
            select(Inspection)
            .where(Inspection.asset_id == asset.id, Inspection.status == InspectionStatus.COMPLETED)
            .order_by(desc(Inspection.completed_at), desc(Inspection.id))
            .limit(1)
        )
        insp_res = await db.execute(insp_stmt)
        last_insp = insp_res.scalars().first()

        # Determinar intervalo aplicable en días
        interval_days = asset.inspection_interval_days
        if interval_days is None:
            # Buscar plantilla por asset_type
            tmpl_stmt = select(ChecklistTemplate).where(
                ChecklistTemplate.asset_type == asset.asset_type,
                ChecklistTemplate.is_active == True,
            ).limit(1)
            tmpl_res = await db.execute(tmpl_stmt)
            tmpl = tmpl_res.scalars().first()
            if tmpl and tmpl.default_interval_days:
                interval_days = tmpl.default_interval_days
            else:
                interval_days = settings.ALERTS_DEFAULT_INSPECTION_INTERVAL_DAYS

        if not last_insp or not last_insp.completed_at:
            # Nunca fue inspeccionado -> OVERDUE inmediato
            rule_code = "AST-INSP-OVERDUE"
            sev = AlertSeverity.HIGH
            fp = build_fingerprint(rule_code, AlertScopeType.ASSET, asset.id)
            overdue_fps.add(fp)

            title = render_alert_title(rule_code, asset.name)
            msg = f"El activo {asset.tag_code} ({asset.name}) no registra ninguna inspección previa completada."
            alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=sev,
                scope_type=AlertScopeType.ASSET,
                scope_id=asset.id,
                source=AlertSource.SCHEDULER,
                title=title,
                message=msg,
                hospital_id=getattr(asset.sector, "hospital_id", None) if getattr(asset, "sector", None) else None,
                sector_id=asset.sector_id,
                asset_id=asset.id,
                context={"interval_days": interval_days, "never_inspected": True},
            )
            if should_dispatch:
                await dispatcher.dispatch(db, alert, event="RAISED")
            continue

        last_date = last_insp.completed_at
        due_date = last_date + timedelta(days=interval_days)

        if now > due_date:
            # VENCIDO
            rule_code = "AST-INSP-OVERDUE"
            days_overdue = (now - due_date).days
            sev = AlertSeverity.CRITICAL if days_overdue > (interval_days * 2) else AlertSeverity.HIGH
            fp = build_fingerprint(rule_code, AlertScopeType.ASSET, asset.id)
            overdue_fps.add(fp)

            title = render_alert_title(rule_code, asset.name)
            msg = f"Inspección de {asset.tag_code} vencida hace {days_overdue} días (intervalo: {interval_days} d)."
            alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=sev,
                scope_type=AlertScopeType.ASSET,
                scope_id=asset.id,
                source=AlertSource.SCHEDULER,
                title=title,
                message=msg,
                hospital_id=getattr(asset.sector, "hospital_id", None) if getattr(asset, "sector", None) else None,
                sector_id=asset.sector_id,
                asset_id=asset.id,
                context={"interval_days": interval_days, "days_overdue": days_overdue},
            )
            if should_dispatch:
                await dispatcher.dispatch(db, alert, event="RAISED")
        elif now + timedelta(days=settings.ALERTS_DUE_SOON_DAYS) >= due_date:
            # PRÓXIMO A VENCER
            rule_code = "AST-INSP-DUE-SOON"
            days_remaining = (due_date - now).days
            fp = build_fingerprint(rule_code, AlertScopeType.ASSET, asset.id)
            due_soon_fps.add(fp)

            title = render_alert_title(rule_code, asset.name)
            msg = f"La inspección de {asset.tag_code} vencerá en {days_remaining} días (límite: {due_date.strftime('%Y-%m-%d')})."
            alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=AlertSeverity.LOW,
                scope_type=AlertScopeType.ASSET,
                scope_id=asset.id,
                source=AlertSource.SCHEDULER,
                title=title,
                message=msg,
                hospital_id=getattr(asset.sector, "hospital_id", None) if getattr(asset, "sector", None) else None,
                sector_id=asset.sector_id,
                asset_id=asset.id,
                context={"interval_days": interval_days, "days_remaining": days_remaining},
            )
            if should_dispatch:
                await dispatcher.dispatch(db, alert, event="RAISED")

    return overdue_fps, due_soon_fps


async def evaluate_stale_inspections(
    db: AsyncSession,
    now: datetime,
) -> Set[str]:
    """
    Evalúa INS-STALE para inspecciones en curso o borrador sin cerrar.
    """
    stale_fps: Set[str] = set()
    cutoff = now - timedelta(hours=settings.ALERTS_STALE_INSPECTION_HOURS)

    stmt = (
        select(Inspection)
        .options(selectinload(Inspection.asset).selectinload(Asset.sector))
        .where(
            Inspection.status.in_([InspectionStatus.IN_PROGRESS, InspectionStatus.DRAFT]),
            Inspection.started_at < cutoff,
        )
    )
    res = await db.execute(stmt)
    inspections = res.scalars().all()

    rule_code = "INS-STALE"
    for insp in inspections:
        fp = build_fingerprint(rule_code, AlertScopeType.INSPECTION, insp.id)
        stale_fps.add(fp)

        hours_stale = int((now - insp.started_at).total_seconds() // 3600)
        asset_name = insp.asset.name if insp.asset else f"Activo #{insp.asset_id}"
        title = render_alert_title(rule_code, asset_name)
        msg = f"Inspección #{insp.id} iniciada por {insp.inspector_name} hace {hours_stale} horas sin cierre ni dictamen final."

        hospital_id = None
        sector_id = None
        if insp.asset:
            sector_id = insp.asset.sector_id
            if getattr(insp.asset, "sector", None):
                hospital_id = insp.asset.sector.hospital_id

        alert, should_dispatch = await AlertEngine.raise_or_update(
            db,
            rule_code=rule_code,
            severity=AlertSeverity.MEDIUM,
            scope_type=AlertScopeType.INSPECTION,
            scope_id=insp.id,
            source=AlertSource.SCHEDULER,
            title=title,
            message=msg,
            hospital_id=hospital_id,
            sector_id=sector_id,
            asset_id=insp.asset_id,
            inspection_id=insp.id,
            context={"hours_stale": hours_stale},
        )
        if should_dispatch:
            await dispatcher.dispatch(db, alert, event="RAISED")

    return stale_fps


async def evaluate_cylinder_hydro_tests(
    db: AsyncSession,
    now: datetime,
) -> Tuple[Set[str], Set[str]]:
    """
    Evalúa CYL-HYDRO-EXPIRED y CYL-HYDRO-SOON conforme IRAM 2529 / Res. 1130 (5 años de validez).
    """
    expired_fps: Set[str] = set()
    soon_fps: Set[str] = set()

    stmt = select(Asset).where(
        Asset.asset_type == AssetType.GAS_CYLINDER,
        Asset.is_active == True,
        Asset.hydraulic_test_date != None,
    )
    res = await db.execute(stmt)
    cylinders = res.scalars().all()

    current_date = now.date()
    validity_days = int(settings.ALERTS_HYDRO_TEST_VALIDITY_YEARS * 365.25)
    warn_days = settings.ALERTS_HYDRO_TEST_WARN_DAYS

    for cyl in cylinders:
        hydro_date: date = cyl.hydraulic_test_date
        expiry_date = hydro_date + timedelta(days=validity_days)

        if current_date > expiry_date:
            # Caducada
            rule_code = "CYL-HYDRO-EXPIRED"
            fp = build_fingerprint(rule_code, AlertScopeType.ASSET, cyl.id)
            expired_fps.add(fp)

            days_expired = (current_date - expiry_date).days
            title = render_alert_title(rule_code, cyl.name)
            msg = (
                f"Cilindro {cyl.tag_code} tiene su prueba hidráulica caducada hace {days_expired} días "
                f"(ensayo IRAM 2529 de fecha {hydro_date.strftime('%Y-%m-%d')}, límite reglamentario 5 años)."
            )
            alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=AlertSeverity.CRITICAL,
                scope_type=AlertScopeType.ASSET,
                scope_id=cyl.id,
                source=AlertSource.SCHEDULER,
                title=title,
                message=msg,
                normative_ref="IRAM 2529 / Res. MSAL 1130/2000",
                hospital_id=getattr(cyl.sector, "hospital_id", None) if getattr(cyl, "sector", None) else None,
                sector_id=cyl.sector_id,
                asset_id=cyl.id,
                expected_value=f"Vigente hasta {expiry_date.strftime('%Y-%m-%d')}",
                actual_value=f"Caducada el {expiry_date.strftime('%Y-%m-%d')}",
                context={"hydro_date": hydro_date.isoformat(), "days_expired": days_expired},
            )
            if should_dispatch:
                await dispatcher.dispatch(db, alert, event="RAISED")
        elif current_date + timedelta(days=warn_days) >= expiry_date:
            # Próxima a caducar
            rule_code = "CYL-HYDRO-SOON"
            fp = build_fingerprint(rule_code, AlertScopeType.ASSET, cyl.id)
            soon_fps.add(fp)

            days_remaining = (expiry_date - current_date).days
            title = render_alert_title(rule_code, cyl.name)
            msg = f"Prueba hidráulica de {cyl.tag_code} vencerá en {days_remaining} días ({expiry_date.strftime('%Y-%m-%d')})."

            alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=AlertSeverity.MEDIUM,
                scope_type=AlertScopeType.ASSET,
                scope_id=cyl.id,
                source=AlertSource.SCHEDULER,
                title=title,
                message=msg,
                normative_ref="IRAM 2529 / Res. MSAL 1130/2000",
                hospital_id=getattr(cyl.sector, "hospital_id", None) if getattr(cyl, "sector", None) else None,
                sector_id=cyl.sector_id,
                asset_id=cyl.id,
                expected_value=f"Vigente hasta {expiry_date.strftime('%Y-%m-%d')}",
                actual_value=f"Vence en {days_remaining} días",
                context={"hydro_date": hydro_date.isoformat(), "days_remaining": days_remaining},
            )
            if should_dispatch:
                await dispatcher.dispatch(db, alert, event="RAISED")

    return expired_fps, soon_fps


async def evaluate_superseded_normatives(
    db: AsyncSession,
    now: datetime,
) -> Set[str]:
    """
    Evalúa NRM-SUPERSEDED para plantillas activas con normas superadas.
    """
    superseded_fps: Set[str] = set()

    # Buscar normas no vigentes
    norm_stmt = select(NormativeReference).where(NormativeReference.is_current == False)
    norm_res = await db.execute(norm_stmt)
    old_norms = norm_res.scalars().all()
    old_codes = {n.code for n in old_norms}

    if not old_codes:
        return superseded_fps

    # Buscar plantillas activas con ítems que referencien alguna de estas normas
    tmpl_stmt = select(ChecklistTemplate).options(selectinload(ChecklistTemplate.items)).where(
        ChecklistTemplate.is_active == True,
    )
    tmpl_res = await db.execute(tmpl_stmt)
    templates = tmpl_res.scalars().all()

    rule_code = "NRM-SUPERSEDED"
    for tmpl in templates:
        conflicts = [item for item in tmpl.items if item.referencia_normativa in old_codes]
        if conflicts:
            fp = build_fingerprint(rule_code, AlertScopeType.TEMPLATE, tmpl.id)
            superseded_fps.add(fp)

            ref_codes = ", ".join({it.referencia_normativa for it in conflicts})
            title = f"Plantilla '{tmpl.title}' referencia normativa superada ({ref_codes})"
            msg = (
                f"La plantilla técnica activa #{tmpl.id} contiene {len(conflicts)} ítem(s) "
                f"referenciando ediciones normativas no vigentes ({ref_codes}). Requiere migración a versión vigente."
            )

            alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=AlertSeverity.HIGH,
                scope_type=AlertScopeType.TEMPLATE,
                scope_id=tmpl.id,
                source=AlertSource.NORMATIVE,
                title=title,
                message=msg,
                normative_ref=ref_codes,
                template_id=tmpl.id,
                context={"conflicting_items_count": len(conflicts), "normatives": list(ref_codes)},
            )
            if should_dispatch:
                await dispatcher.dispatch(db, alert, event="RAISED")

    return superseded_fps


async def evaluate_recurrent_failures(
    db: AsyncSession,
    now: datetime,
) -> Set[str]:
    """
    Evalúa AST-RECURRENT-FAIL: mismo item_code fallando en >= threshold de las últimas window inspecciones completadas.
    """
    recurrent_fps: Set[str] = set()
    threshold = settings.ALERTS_RECURRENT_FAIL_THRESHOLD  # 3
    window = settings.ALERTS_RECURRENT_FAIL_WINDOW        # 5

    stmt = select(Asset).where(Asset.is_active == True)
    res = await db.execute(stmt)
    assets = res.scalars().all()

    rule_code = "AST-RECURRENT-FAIL"

    for asset in assets:
        # Últimas 'window' inspecciones completadas del activo
        insp_stmt = (
            select(Inspection.id)
            .where(Inspection.asset_id == asset.id, Inspection.status == InspectionStatus.COMPLETED)
            .order_by(desc(Inspection.completed_at), desc(Inspection.id))
            .limit(window)
        )
        insp_res = await db.execute(insp_stmt)
        inspection_ids = [row[0] for row in insp_res.all()]

        if len(inspection_ids) < threshold:
            continue

        # Buscar ComplianceResult NON_COMPLIANT en esas inspecciones
        comp_stmt = (
            select(
                ChecklistItem.id,
                ChecklistItem.code,
                ChecklistItem.title,
                func.count(ComplianceResult.id).label("fail_count"),
            )
            .join(ChecklistItem, ComplianceResult.item_id == ChecklistItem.id)
            .where(
                ComplianceResult.inspection_id.in_(inspection_ids),
                ComplianceResult.compliance_status == ComplianceStatus.NON_COMPLIANT,
            )
            .group_by(
                ChecklistItem.id,
                ChecklistItem.code,
                ChecklistItem.title,
            )
        )

        comp_res = await db.execute(comp_stmt)
        for item_id, item_code, item_title, fail_count in comp_res.all():
            if fail_count >= threshold:
                fp = build_fingerprint(rule_code, AlertScopeType.ASSET, asset.id, item_id)
                recurrent_fps.add(fp)

                title = f"Falla recurrente en {item_code} — {asset.name}"
                msg = (
                    f"El punto crítico '{item_title}' ({item_code}) resultó NO CONFORME en "
                    f"{fail_count} de las últimas {len(inspection_ids)} inspecciones del activo {asset.tag_code}."
                )

                alert, should_dispatch = await AlertEngine.raise_or_update(
                    db,
                    rule_code=rule_code,
                    severity=AlertSeverity.HIGH,
                    scope_type=AlertScopeType.ASSET,
                    scope_id=asset.id,
                    source=AlertSource.SCHEDULER,
                    title=title,
                    message=msg,
                    hospital_id=getattr(asset.sector, "hospital_id", None) if getattr(asset, "sector", None) else None,
                    sector_id=asset.sector_id,
                    asset_id=asset.id,
                    item_id=item_id,
                    context={"fail_count": fail_count, "window_inspections": len(inspection_ids)},
                )
                if should_dispatch:
                    await dispatcher.dispatch(db, alert, event="RAISED")

    return recurrent_fps
