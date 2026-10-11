import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.notification import (
    Alert,
    AlertSeverity,
    ChannelType,
    DeliveryStatus,
    NotificationChannel,
    NotificationDelivery,
)
from app.services.notifications.channels.in_app import in_app_backend
from app.services.notifications.channels.email import email_backend
from app.services.notifications.channels.webhook import webhook_backend
from app.services.notifications.rules import get_effective_rule

logger = logging.getLogger(__name__)

SEVERITY_RANK = {
    AlertSeverity.INFO: 0,
    AlertSeverity.LOW: 1,
    AlertSeverity.MEDIUM: 2,
    AlertSeverity.HIGH: 3,
    AlertSeverity.CRITICAL: 4,
}


def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class NotificationDispatcher:
    def __init__(self):
        self.in_app = in_app_backend
        self.email = email_backend
        self.webhook = webhook_backend

    async def dispatch(
        self,
        db: AsyncSession,
        alert: Alert,
        event: Literal["RAISED", "ESCALATED", "RESOLVED"] = "RAISED",
    ) -> None:
        """
        Punto de entrada de despacho multicanal.
        Siempre notifica in-app de forma inmediata vía Broker/SSE.
        Despacha canales externos si corresponde según filtros y modo sync/async.
        """
        # 1. Entrega in-app siempre (en memoria, pub/sub)
        try:
            await self.in_app.send(alert=alert, event=event, target="*")
        except Exception as e:
            logger.warning("Error entregando alerta in-app: %s", e)

        # 2. Despacho a canales externos
        if settings.ALERTS_DISPATCH_SYNC:
            await self._dispatch_external(db, alert.id, event)
        else:
            asyncio.create_task(self._background_dispatch(alert.id, event))

    async def _background_dispatch(self, alert_id: int, event: str) -> None:
        try:
            async with AsyncSessionLocal() as session:
                await self._dispatch_external(session, alert_id, event)
                await session.commit()
        except Exception as e:
            logger.exception("Error en despacho en segundo plano para alerta %s: %s", alert_id, e)

    async def _dispatch_external(self, db: AsyncSession, alert_id: int, event: str) -> None:
        alert_stmt = select(Alert).where(Alert.id == alert_id)
        alert_res = await db.execute(alert_stmt)
        alert = alert_res.scalars().first()
        if not alert:
            return

        rule = await get_effective_rule(db, alert.rule_code)
        if not rule or not rule.notify_external:
            return

        # Si es provisional: solo se envía externamente si es CRITICAL y ALERTS_NOTIFY_CRITICAL_LIVE está activo
        if alert.is_provisional:
            if not (alert.severity == AlertSeverity.CRITICAL and settings.ALERTS_NOTIFY_CRITICAL_LIVE):
                return

        # Buscar canales activos (excluyendo IN_APP que ya fue entregado)
        stmt = select(NotificationChannel).where(
            NotificationChannel.is_active == True,
            NotificationChannel.channel_type != ChannelType.IN_APP,
        )
        res = await db.execute(stmt)
        channels: List[NotificationChannel] = res.scalars().all()

        alert_rank = SEVERITY_RANK.get(alert.severity, 0)
        now = utc_now_naive()
        one_hour_ago = now - timedelta(hours=1)

        for channel in channels:
            chan_min_rank = SEVERITY_RANK.get(channel.min_severity, 0)
            if alert_rank < chan_min_rank:
                continue

            # Filtros jerárquicos
            if channel.hospital_id is not None and alert.hospital_id is not None:
                if channel.hospital_id != alert.hospital_id:
                    continue
            if channel.sector_id is not None and alert.sector_id is not None:
                if channel.sector_id != alert.sector_id:
                    continue

            # Rate limit por canal
            rate_stmt = select(func.count(NotificationDelivery.id)).where(
                NotificationDelivery.channel_id == channel.id,
                NotificationDelivery.status == DeliveryStatus.SENT,
                NotificationDelivery.created_at >= one_hour_ago,
            )
            count_res = await db.execute(rate_stmt)
            sent_count = count_res.scalar() or 0
            if sent_count >= settings.ALERTS_MAX_EXTERNAL_PER_HOUR:
                delivery = NotificationDelivery(
                    alert_id=alert.id,
                    channel_id=channel.id,
                    channel_type=channel.channel_type,
                    target=channel.target,
                    event=event,
                    status=DeliveryStatus.SKIPPED,
                    attempts=0,
                    error="Rate limit excedido por hora",
                    created_at=now,
                )
                db.add(delivery)
                continue

            # Envío con reintentos
            delivery = NotificationDelivery(
                alert_id=alert.id,
                channel_id=channel.id,
                channel_type=channel.channel_type,
                target=channel.target,
                event=event,
                status=DeliveryStatus.PENDING,
                attempts=0,
                created_at=now,
            )
            db.add(delivery)
            await db.flush()

            success = False
            last_err = None
            max_attempts = 3

            for attempt in range(1, max_attempts + 1):
                delivery.attempts = attempt
                try:
                    if channel.channel_type == ChannelType.EMAIL:
                        await self.email.send(alert=alert, event=event, target=channel.target)
                    elif channel.channel_type == ChannelType.WEBHOOK:
                        await self.webhook.send(
                            alert=alert,
                            event=event,
                            target=channel.target,
                            secret=channel.secret,
                        )
                    success = True
                    break
                except Exception as ex:
                    last_err = str(ex)
                    logger.warning(
                        "Fallo intento %d/%d al entregar a canal %s: %s",
                        attempt,
                        max_attempts,
                        channel.target,
                        ex,
                    )
                    if attempt < max_attempts and not settings.ALERTS_DISPATCH_SYNC:
                        await asyncio.sleep(2 ** attempt)

            if success:
                delivery.status = DeliveryStatus.SENT
                delivery.sent_at = utc_now_naive()
                delivery.error = None
            else:
                delivery.status = DeliveryStatus.FAILED
                delivery.error = last_err


dispatcher = NotificationDispatcher()
