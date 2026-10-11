import logging
from typing import Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Alert
from app.services.notifications.alert_engine import AlertEngine

logger = logging.getLogger(__name__)


async def on_compliance_evaluated(
    db: AsyncSession,
    inspection: Any,
    summary: Any,
) -> List[Alert]:
    """
    Hook 100% no bloqueante sobre el flujo clínico de evaluación.
    Si falla el procesamiento de alertas, registra el error y realiza rollback
    sin interrumpir la respuesta del endpoint de compliance.
    """
    try:
        alerts = await AlertEngine.process_compliance_summary(db, inspection, summary)
        await db.commit()
        return alerts
    except Exception:
        logger.exception("OE-5: fallo no bloqueante al procesar alertas de compliance")
        try:
            await db.rollback()
        except Exception:
            pass
        return []


async def on_inspection_completed(
    db: AsyncSession,
    inspection: Any,
    summary: Any,
) -> List[Alert]:
    """
    Hook 100% no bloqueante tras el cierre formal de una inspección.
    Consolida alertas provisionales y emite dictámenes sin impedir el cierre clínico.
    """
    try:
        alerts = await AlertEngine.process_inspection_completed(db, inspection, summary)
        await db.commit()
        return alerts
    except Exception:
        logger.exception("OE-5: fallo no bloqueante al procesar alertas de cierre de inspección")
        try:
            await db.rollback()
        except Exception:
            pass
        return []
