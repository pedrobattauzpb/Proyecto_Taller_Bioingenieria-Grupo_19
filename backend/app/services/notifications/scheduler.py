import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.compliance import AuditLog, AuditEventType
from app.models.notification import Alert, AlertStatus, AlertSeverity
from app.services.notifications.alert_engine import AlertEngine
from app.services.notifications.rules import get_effective_rule
from app.services.notifications.dispatcher import dispatcher
from app.services.notifications.evaluators import (
    evaluate_asset_overdue_and_due_soon,
    evaluate_stale_inspections,
    evaluate_cylinder_hydro_tests,
    evaluate_superseded_normatives,
    evaluate_recurrent_failures,
    get_current_time,
)

logger = logging.getLogger(__name__)


async def run_scheduled_checks(
    db: AsyncSession,
    now: Optional[datetime] = None,
) -> Dict[str, int]:
    """
    Función pública y pura respecto del tiempo.
    Ejecuta el barrido programado de todas las reglas del scheduler y escalamiento.
    """
    current_now = get_current_time(now)
    results: Dict[str, int] = {}

    # 1. Reglas de inspección de activo
    overdue_fps, due_soon_fps = await evaluate_asset_overdue_and_due_soon(db, current_now)
    await AlertEngine.auto_resolve(
        db,
        fingerprints_vivos=overdue_fps,
        scope_filter={"rule_code": "AST-INSP-OVERDUE"},
    )
    await AlertEngine.auto_resolve(
        db,
        fingerprints_vivos=due_soon_fps,
        scope_filter={"rule_code": "AST-INSP-DUE-SOON"},
    )
    results["AST-INSP-OVERDUE"] = len(overdue_fps)
    results["AST-INSP-DUE-SOON"] = len(due_soon_fps)

    # 2. Inspecciones demoradas/abandonadas
    stale_fps = await evaluate_stale_inspections(db, current_now)
    await AlertEngine.auto_resolve(
        db,
        fingerprints_vivos=stale_fps,
        scope_filter={"rule_code": "INS-STALE"},
    )
    results["INS-STALE"] = len(stale_fps)

    # 3. Cilindros y prueba hidráulica (IRAM 2529)
    hydro_exp_fps, hydro_soon_fps = await evaluate_cylinder_hydro_tests(db, current_now)
    await AlertEngine.auto_resolve(
        db,
        fingerprints_vivos=hydro_exp_fps,
        scope_filter={"rule_code": "CYL-HYDRO-EXPIRED"},
    )
    await AlertEngine.auto_resolve(
        db,
        fingerprints_vivos=hydro_soon_fps,
        scope_filter={"rule_code": "CYL-HYDRO-SOON"},
    )
    results["CYL-HYDRO-EXPIRED"] = len(hydro_exp_fps)
    results["CYL-HYDRO-SOON"] = len(hydro_soon_fps)

    # 4. Normativas superadas
    norm_fps = await evaluate_superseded_normatives(db, current_now)
    await AlertEngine.auto_resolve(
        db,
        fingerprints_vivos=norm_fps,
        scope_filter={"rule_code": "NRM-SUPERSEDED"},
    )
    results["NRM-SUPERSEDED"] = len(norm_fps)

    # 5. Fallas recurrentes
    rec_fps = await evaluate_recurrent_failures(db, current_now)
    results["AST-RECURRENT-FAIL"] = len(rec_fps)

    # 6. Escalamiento de alertas no reconocidas
    escalated_count = 0
    stmt_open = select(Alert).where(Alert.status == AlertStatus.OPEN)
    res_open = await db.execute(stmt_open)
    open_alerts: List[Alert] = res_open.scalars().all()

    for alert in open_alerts:
        rule = await get_effective_rule(db, alert.rule_code)
        if rule and rule.escalate_after_minutes and alert.escalation_level < 3:
            basis_time = alert.last_escalated_at or alert.first_detected_at
            if current_now >= basis_time + timedelta(minutes=rule.escalate_after_minutes):
                alert.escalation_level += 1
                alert.last_escalated_at = current_now
                alert.updated_at = current_now

                audit = AuditLog(
                    inspection_id=alert.inspection_id,
                    event_type=AuditEventType.ALERT_ESCALATED,
                    actor="SYSTEM",
                    event_detail={
                        "alert_id": alert.id,
                        "rule_code": alert.rule_code,
                        "escalation_level": alert.escalation_level,
                    },
                    created_at=current_now,
                )
                db.add(audit)
                await db.flush()

                await dispatcher.dispatch(db, alert, event="ESCALATED")
                escalated_count += 1

    results["ESCALATED"] = escalated_count

    # 7. Expirar silencios vencidos
    stmt_silenced = select(Alert).where(
        Alert.status == AlertStatus.SILENCED,
        Alert.silenced_until < current_now,
    )
    res_silenced = await db.execute(stmt_silenced)
    silenced_alerts = res_silenced.scalars().all()
    for s_alert in silenced_alerts:
        s_alert.status = AlertStatus.OPEN
        s_alert.silenced_until = None
        s_alert.updated_at = current_now

    await db.flush()
    return results


class AlertScheduler:
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("AlertScheduler iniciado con intervalo de %d segundos.", settings.ALERTS_SCHEDULER_INTERVAL_SECONDS)

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("AlertScheduler detenido.")

    async def _loop(self) -> None:
        while self._running:
            try:
                await asyncio.sleep(settings.ALERTS_SCHEDULER_INTERVAL_SECONDS)
                if not self._running:
                    break

                if self._lock.locked():
                    logger.warning("Barrido anterior de AlertScheduler aún en curso. Saltando pasada.")
                    continue

                async with self._lock:
                    async with AsyncSessionLocal() as session:
                        results = await run_scheduled_checks(session)
                        await session.commit()
                        logger.debug("Barrido de AlertScheduler completado: %s", results)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Error inesperado en AlertScheduler: %s", e)


alert_scheduler = AlertScheduler()
