import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Set, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.hierarchy import Asset, Sector
from app.models.checklist import ChecklistItem
from app.models.compliance import AuditLog, AuditEventType, ComplianceSeverity, ComplianceStatus
from app.models.notification import (
    Alert,
    AlertSeverity,
    AlertStatus,
    AlertSource,
    AlertScopeType,
)
from app.services.notifications.fingerprint import build_fingerprint
from app.services.notifications.rules import get_effective_rule
from app.services.notifications.templates import render_alert_title
from app.services.notifications.dispatcher import dispatcher, SEVERITY_RANK

logger = logging.getLogger(__name__)


def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AlertEngine:
    @staticmethod
    async def raise_or_update(
        db: AsyncSession,
        *,
        rule_code: str,
        severity: AlertSeverity,
        scope_type: AlertScopeType,
        scope_id: int,
        title: str,
        message: str,
        source: AlertSource = AlertSource.COMPLIANCE,
        normative_ref: Optional[str] = None,
        hospital_id: Optional[int] = None,
        sector_id: Optional[int] = None,
        asset_id: Optional[int] = None,
        inspection_id: Optional[int] = None,
        item_id: Optional[int] = None,
        template_id: Optional[int] = None,
        expected_value: Optional[str] = None,
        actual_value: Optional[str] = None,
        context: Optional[dict] = None,
        is_provisional: bool = False,
    ) -> Tuple[Alert, bool]:
        """
        Detección reactiva/programada con deduplicación por fingerprint.
        Retorna (alerta, should_dispatch).
        """
        fingerprint = build_fingerprint(rule_code, scope_type, scope_id, item_id)
        now = utc_now_naive()

        # 1. Verificar si hay una alerta SILENCIADA aún vigente
        silenced_stmt = select(Alert).where(
            Alert.fingerprint == fingerprint,
            Alert.status == AlertStatus.SILENCED,
            Alert.silenced_until > now,
        )
        silenced_res = await db.execute(silenced_stmt)
        silenced_alert = silenced_res.scalars().first()
        if silenced_alert:
            return silenced_alert, False

        # 2. Buscar si existe alerta "viva" (OPEN o ACKNOWLEDGED)
        stmt = select(Alert).where(
            Alert.fingerprint == fingerprint,
            Alert.status.in_([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]),
        )
        res = await db.execute(stmt)
        existing: Optional[Alert] = res.scalars().first()

        if existing:
            existing.occurrence_count += 1
            existing.last_detected_at = now
            existing.actual_value = actual_value
            existing.expected_value = expected_value
            if context:
                existing.context = context

            is_escalated = False
            # Si la severidad nueva es mayor que la existente, escalar severidad
            if SEVERITY_RANK.get(severity, 0) > SEVERITY_RANK.get(existing.severity, 0):
                existing.severity = severity
                existing.last_escalated_at = now
                is_escalated = True

            await db.flush()
            return existing, is_escalated

        # 3. No existe alerta viva: crear una nueva
        initial_status = AlertStatus.OPEN
        resolved_at = None
        resolved_by = None
        if rule_code == "INS-CLOSED-OK":
            initial_status = AlertStatus.RESOLVED
            resolved_at = now
            resolved_by = "SYSTEM"

        new_alert = Alert(
            fingerprint=fingerprint,
            rule_code=rule_code,
            source=source,
            severity=severity,
            status=initial_status,
            title=title,
            message=message,
            normative_ref=normative_ref,
            scope_type=scope_type,
            hospital_id=hospital_id,
            sector_id=sector_id,
            asset_id=asset_id,
            inspection_id=inspection_id,
            item_id=item_id,
            template_id=template_id,
            expected_value=expected_value,
            actual_value=actual_value,
            context=context or {},
            is_provisional=is_provisional,
            occurrence_count=1,
            first_detected_at=now,
            last_detected_at=now,
            resolved_at=resolved_at,
            resolved_by=resolved_by,
            created_at=now,
            updated_at=now,
        )
        db.add(new_alert)
        await db.flush()

        # Registro en AuditLog
        audit = AuditLog(
            inspection_id=inspection_id,
            event_type=AuditEventType.ALERT_RAISED,
            actor="SYSTEM",
            event_detail={
                "alert_id": new_alert.id,
                "rule_code": rule_code,
                "fingerprint": fingerprint,
                "severity": severity.value,
                "title": title,
                "scope_type": scope_type.value,
                "scope_id": scope_id,
            },
            created_at=now,
        )
        db.add(audit)
        await db.flush()

        return new_alert, True

    @staticmethod
    async def auto_resolve(
        db: AsyncSession,
        *,
        fingerprints_vivos: Set[str],
        scope_filter: Dict[str, Any],
    ) -> List[Alert]:
        """
        Auto-resuelve alertas del scope especificado que ya no están en fingerprints_vivos.
        """
        conditions = [
            Alert.status.in_([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]),
        ]

        if "inspection_id" in scope_filter:
            conditions.append(Alert.inspection_id == scope_filter["inspection_id"])
        if "asset_id" in scope_filter:
            conditions.append(Alert.asset_id == scope_filter["asset_id"])
        if "rule_code" in scope_filter:
            conditions.append(Alert.rule_code == scope_filter["rule_code"])
        if "source" in scope_filter:
            conditions.append(Alert.source == scope_filter["source"])

        stmt = select(Alert).where(and_(*conditions))
        res = await db.execute(stmt)
        candidates: List[Alert] = res.scalars().all()

        resolved_alerts: List[Alert] = []
        now = utc_now_naive()

        for alert in candidates:
            if alert.fingerprint not in fingerprints_vivos:
                alert.status = AlertStatus.AUTO_RESOLVED
                alert.resolved_at = now
                alert.resolved_by = "SYSTEM"
                alert.resolution_note = "Condición normalizada automáticamente"
                alert.updated_at = now

                # AuditLog
                audit = AuditLog(
                    inspection_id=alert.inspection_id,
                    event_type=AuditEventType.ALERT_RESOLVED,
                    actor="SYSTEM",
                    event_detail={
                        "alert_id": alert.id,
                        "rule_code": alert.rule_code,
                        "fingerprint": alert.fingerprint,
                        "to_status": AlertStatus.AUTO_RESOLVED.value,
                        "note": alert.resolution_note,
                    },
                    created_at=now,
                )
                db.add(audit)
                resolved_alerts.append(alert)

        if resolved_alerts:
            await db.flush()
            for r_alert in resolved_alerts:
                await dispatcher.dispatch(db, r_alert, event="RESOLVED")

        return resolved_alerts

    @staticmethod
    async def process_compliance_summary(
        db: AsyncSession,
        inspection: Any,
        summary: Any,
    ) -> List[Alert]:
        """
        Hook reactivo invocado tras validate_inspection_compliance.
        Procesa desvíos y auto-resuelve alertas superadas de la inspección.
        """
        live_fingerprints: Set[str] = set()
        raised_alerts: List[Alert] = []

        # Determinar si la inspección sigue en curso (provisional)
        is_provisional = getattr(inspection, "status", None) != "COMPLETED"

        asset = getattr(inspection, "asset", None)
        if not asset and getattr(inspection, "asset_id", None):
            asset = await db.get(Asset, inspection.asset_id)

        asset_name = asset.name if asset else None
        sector_id = asset.sector_id if asset else None
        hospital_id = None
        if sector_id:
            sector = await db.get(Sector, sector_id)
            if sector:
                hospital_id = sector.hospital_id

        for result in summary.results:
            rule_code = None
            alert_sev = None

            c_status = getattr(result, "compliance_status", getattr(result, "status", None))
            status_val = c_status.value if hasattr(c_status, "value") else str(c_status)
            c_sev = getattr(result, "severity", None)
            sev_val = c_sev.value if hasattr(c_sev, "value") else str(c_sev)

            if status_val == "NON_COMPLIANT":
                if sev_val == "CRITICAL":
                    rule_code = "CMP-CRIT-NC"
                    alert_sev = AlertSeverity.CRITICAL
                elif sev_val == "MAJOR":
                    rule_code = "CMP-MAJOR-NC"
                    alert_sev = AlertSeverity.HIGH
                elif sev_val == "MINOR":
                    rule_code = "CMP-MINOR-NC"
                    alert_sev = AlertSeverity.LOW
            elif status_val == "WARNING":
                rule_code = "CMP-WARN-BAND"
                alert_sev = AlertSeverity.MEDIUM

            if rule_code and alert_sev:
                fp = build_fingerprint(
                    rule_code,
                    AlertScopeType.INSPECTION,
                    inspection.id,
                    result.item_id,
                )
                live_fingerprints.add(fp)

                item = await db.get(ChecklistItem, result.item_id)
                item_title = item.title if item else f"Ítem #{result.item_id}"
                title = render_alert_title(rule_code, asset_name, item_title)
                dev_detail = getattr(result, "deviation_detail", getattr(result, "finding_detail", None))
                message = dev_detail or f"Desvío detectado en {item_title}"
                norm_ref = getattr(result, "normative_ref", getattr(result, "normative_reference", None))

                alert, should_dispatch = await AlertEngine.raise_or_update(
                    db,
                    rule_code=rule_code,
                    severity=alert_sev,
                    scope_type=AlertScopeType.INSPECTION,
                    scope_id=inspection.id,
                    source=AlertSource.COMPLIANCE,
                    title=title,
                    message=message,
                    normative_ref=norm_ref,
                    hospital_id=hospital_id,
                    sector_id=sector_id,
                    asset_id=inspection.asset_id,
                    inspection_id=inspection.id,
                    item_id=result.item_id,
                    template_id=inspection.template_id,
                    expected_value=result.expected_value,
                    actual_value=result.actual_value,
                    is_provisional=is_provisional,
                )
                raised_alerts.append(alert)

                if should_dispatch:
                    await dispatcher.dispatch(db, alert, event="RAISED")

        # Auto-resolver alertas de compliance de esta inspección que ya no fallan
        await AlertEngine.auto_resolve(
            db,
            fingerprints_vivos=live_fingerprints,
            scope_filter={
                "inspection_id": inspection.id,
                "source": AlertSource.COMPLIANCE,
            },
        )

        return raised_alerts

    @staticmethod
    async def process_inspection_completed(
        db: AsyncSession,
        inspection: Any,
        summary: Any,
    ) -> List[Alert]:
        """
        Hook ejecutado al completar/cerrar una inspección.
        Consolida alertas provisionales, emite INS-CLOSED-* y resuelve alertas programadas.
        """
        now = utc_now_naive()
        asset = getattr(inspection, "asset", None)
        if not asset and getattr(inspection, "asset_id", None):
            asset = await db.get(Asset, inspection.asset_id)

        asset_name = asset.name if asset else None
        sector_id = asset.sector_id if asset else None
        hospital_id = None
        if sector_id:
            sector = await db.get(Sector, sector_id)
            if sector:
                hospital_id = sector.hospital_id

        # 1. Consolidar alertas provisionales de esta inspección
        stmt_prov = select(Alert).where(
            Alert.inspection_id == inspection.id,
            Alert.is_provisional == True,
            Alert.status.in_([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]),
        )
        res_prov = await db.execute(stmt_prov)
        prov_alerts = res_prov.scalars().all()

        for a in prov_alerts:
            a.is_provisional = False
            a.updated_at = now
            # Despachar a canales externos ahora que está consolidada
            await dispatcher.dispatch(db, a, event="RAISED")

        alerts_created: List[Alert] = list(prov_alerts)

        # 2. Emitir INS-CLOSED-NC o INS-CLOSED-OK
        if summary.non_compliant_items > 0:
            has_crit = any(
                (getattr(r, "severity", None) in (ComplianceSeverity.CRITICAL, "CRITICAL")) and
                (getattr(r, "compliance_status", getattr(r, "status", None)) in (ComplianceStatus.NON_COMPLIANT, "NON_COMPLIANT"))
                for r in summary.results
            )
            rule_code = "INS-CLOSED-NC"
            sev = AlertSeverity.CRITICAL if has_crit else AlertSeverity.HIGH
            title = render_alert_title(rule_code, asset_name)
            msg = f"Inspección {inspection.id} finalizada con {summary.non_compliant_items} desvío(s) no conformes."

            closed_alert, should_dispatch = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=sev,
                scope_type=AlertScopeType.INSPECTION,
                scope_id=inspection.id,
                source=AlertSource.INSPECTION_LIFECYCLE,
                title=title,
                message=msg,
                hospital_id=hospital_id,
                sector_id=sector_id,
                asset_id=inspection.asset_id,
                inspection_id=inspection.id,
                template_id=inspection.template_id,
                is_provisional=False,
            )
            alerts_created.append(closed_alert)
            if should_dispatch:
                await dispatcher.dispatch(db, closed_alert, event="RAISED")
        elif summary.is_fully_compliant:
            rule_code = "INS-CLOSED-OK"
            title = render_alert_title(rule_code, asset_name)
            msg = f"Inspección {inspection.id} completada 100% conforme a normativa."
            closed_alert, _ = await AlertEngine.raise_or_update(
                db,
                rule_code=rule_code,
                severity=AlertSeverity.INFO,
                scope_type=AlertScopeType.INSPECTION,
                scope_id=inspection.id,
                source=AlertSource.INSPECTION_LIFECYCLE,
                title=title,
                message=msg,
                hospital_id=hospital_id,
                sector_id=sector_id,
                asset_id=inspection.asset_id,
                inspection_id=inspection.id,
                template_id=inspection.template_id,
                is_provisional=False,
            )
            alerts_created.append(closed_alert)

        # 3. Auto-resolver alertas de activo vencido / por vencer para este activo
        if inspection.asset_id:
            await AlertEngine.auto_resolve(
                db,
                fingerprints_vivos=set(),
                scope_filter={
                    "asset_id": inspection.asset_id,
                    "rule_code": "AST-INSP-OVERDUE",
                },
            )
            await AlertEngine.auto_resolve(
                db,
                fingerprints_vivos=set(),
                scope_filter={
                    "asset_id": inspection.asset_id,
                    "rule_code": "AST-INSP-DUE-SOON",
                },
            )

        # 4. Auto-resolver INS-STALE para esta inspección
        await AlertEngine.auto_resolve(
            db,
            fingerprints_vivos=set(),
            scope_filter={
                "inspection_id": inspection.id,
                "rule_code": "INS-STALE",
            },
        )

        return alerts_created

    @staticmethod
    async def acknowledge(
        db: AsyncSession,
        alert_id: int,
        actor: str,
        note: Optional[str] = None,
    ) -> Alert:
        stmt = select(Alert).where(Alert.id == alert_id)
        res = await db.execute(stmt)
        alert = res.scalars().first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alerta no encontrada")

        if alert.status in [AlertStatus.RESOLVED, AlertStatus.AUTO_RESOLVED]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"La alerta ya se encuentra resuelta ({alert.status.value})",
            )

        now = utc_now_naive()
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = now
        alert.acknowledged_by = actor
        alert.updated_at = now

        audit = AuditLog(
            inspection_id=alert.inspection_id,
            event_type=AuditEventType.ALERT_ACKNOWLEDGED,
            actor=actor,
            event_detail={
                "alert_id": alert.id,
                "rule_code": alert.rule_code,
                "fingerprint": alert.fingerprint,
                "note": note,
            },
            created_at=now,
        )
        db.add(audit)
        await db.flush()

        await dispatcher.dispatch(db, alert, event="ACKNOWLEDGED")
        return alert

    @staticmethod
    async def resolve(
        db: AsyncSession,
        alert_id: int,
        actor: str,
        note: Optional[str] = None,
    ) -> Alert:
        stmt = select(Alert).where(Alert.id == alert_id)
        res = await db.execute(stmt)
        alert = res.scalars().first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alerta no encontrada")

        if alert.severity == AlertSeverity.CRITICAL and (not note or not note.strip()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Nota de resolución obligatoria para alertas críticas",
            )

        now = utc_now_naive()
        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = now
        alert.resolved_by = actor
        alert.resolution_note = note
        alert.updated_at = now

        audit = AuditLog(
            inspection_id=alert.inspection_id,
            event_type=AuditEventType.ALERT_RESOLVED,
            actor=actor,
            event_detail={
                "alert_id": alert.id,
                "rule_code": alert.rule_code,
                "fingerprint": alert.fingerprint,
                "note": note,
            },
            created_at=now,
        )
        db.add(audit)
        await db.flush()

        await dispatcher.dispatch(db, alert, event="RESOLVED")
        return alert

    @staticmethod
    async def silence(
        db: AsyncSession,
        alert_id: int,
        actor: str,
        until: datetime,
        note: Optional[str] = None,
    ) -> Alert:
        stmt = select(Alert).where(Alert.id == alert_id)
        res = await db.execute(stmt)
        alert = res.scalars().first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alerta no encontrada")

        now = utc_now_naive()
        # Normalizar until a naive UTC si viene con tzinfo
        until_naive = until.replace(tzinfo=None) if until.tzinfo else until

        if until_naive <= now:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La fecha de silencio debe ser futura",
            )

        max_silence = now + timedelta(hours=settings.ALERTS_MAX_SILENCE_HOURS)
        if until_naive > max_silence:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El período de silencio excede el máximo permitido ({settings.ALERTS_MAX_SILENCE_HOURS} horas)",
            )

        # Regla clínica de negocio: no se puede silenciar incumplimiento legal crítico
        if alert.severity == AlertSeverity.CRITICAL and alert.rule_code in ("CYL-HYDRO-EXPIRED", "INS-CLOSED-NC"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"La alerta reglamentaria {alert.rule_code} no puede silenciarse por imperativo legal",
            )

        alert.status = AlertStatus.SILENCED
        alert.silenced_until = until_naive
        alert.updated_at = now

        audit = AuditLog(
            inspection_id=alert.inspection_id,
            event_type=AuditEventType.ALERT_SILENCED,
            actor=actor,
            event_detail={
                "alert_id": alert.id,
                "rule_code": alert.rule_code,
                "fingerprint": alert.fingerprint,
                "silenced_until": until_naive.isoformat(),
                "note": note,
            },
            created_at=now,
        )
        db.add(audit)
        await db.flush()

        return alert

    @staticmethod
    async def bulk_acknowledge(
        db: AsyncSession,
        ids: List[int],
        actor: str,
    ) -> int:
        count = 0
        now = utc_now_naive()
        for alert_id in ids:
            stmt = select(Alert).where(Alert.id == alert_id)
            res = await db.execute(stmt)
            alert = res.scalars().first()
            if alert and alert.status == AlertStatus.OPEN:
                alert.status = AlertStatus.ACKNOWLEDGED
                alert.acknowledged_at = now
                alert.acknowledged_by = actor
                alert.updated_at = now

                audit = AuditLog(
                    inspection_id=alert.inspection_id,
                    event_type=AuditEventType.ALERT_ACKNOWLEDGED,
                    actor=actor,
                    event_detail={"alert_id": alert.id, "rule_code": alert.rule_code, "action": "bulk"},
                    created_at=now,
                )
                db.add(audit)
                count += 1
        if count > 0:
            await db.flush()
        return count
