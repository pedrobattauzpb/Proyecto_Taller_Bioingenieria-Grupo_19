import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.notification import (
    NotificationChannel,
    AlertRule,
    NotificationDelivery,
    Alert,
    AlertSeverity,
    AlertStatus,
    AlertSource,
    AlertScopeType,
    ChannelType,
    DeliveryStatus,
)
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelUpdate,
    NotificationChannelRead,
    AlertRuleRead,
    AlertRuleUpdate,
    NotificationDeliveryRead,
)
from app.services.notifications.rules import DEFAULT_RULES
from app.services.notifications.channels.email import email_backend
from app.services.notifications.channels.webhook import webhook_backend

logger = logging.getLogger(__name__)

router = APIRouter()


def _channel_to_read(c: NotificationChannel) -> NotificationChannelRead:
    return NotificationChannelRead(
        id=c.id,
        name=c.name,
        channel_type=c.channel_type,
        target=c.target,
        min_severity=c.min_severity,
        hospital_id=c.hospital_id,
        sector_id=c.sector_id,
        is_active=c.is_active,
        has_secret=bool(c.secret),
        created_at=c.created_at,
    )


# --- CANALES ---

@router.get("/channels", response_model=List[NotificationChannelRead], summary="Listado de canales de notificación")
async def list_channels(db: AsyncSession = Depends(get_db)):
    stmt = select(NotificationChannel).order_by(NotificationChannel.id.asc())
    res = await db.execute(stmt)
    channels = res.scalars().all()
    return [_channel_to_read(c) for c in channels]


@router.post("/channels", response_model=NotificationChannelRead, status_code=status.HTTP_201_CREATED, summary="Crear un canal de notificación")
async def create_channel(
    body: NotificationChannelCreate,
    db: AsyncSession = Depends(get_db),
):
    channel = NotificationChannel(
        name=body.name,
        channel_type=body.channel_type,
        target=body.target,
        min_severity=body.min_severity,
        hospital_id=body.hospital_id,
        sector_id=body.sector_id,
        is_active=body.is_active,
        secret=body.secret,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return _channel_to_read(channel)


@router.put("/channels/{id}", response_model=NotificationChannelRead, summary="Actualizar un canal")
async def update_channel(
    id: int,
    body: NotificationChannelUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(NotificationChannel).where(NotificationChannel.id == id)
    res = await db.execute(stmt)
    channel = res.scalars().first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal no encontrado")

    update_data = body.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(channel, field, val)

    await db.commit()
    await db.refresh(channel)
    return _channel_to_read(channel)


@router.delete("/channels/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un canal")
async def delete_channel(id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(NotificationChannel).where(NotificationChannel.id == id)
    res = await db.execute(stmt)
    channel = res.scalars().first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal no encontrado")

    await db.delete(channel)
    await db.commit()
    return None


@router.post("/channels/{id}/test", response_model=NotificationDeliveryRead, summary="Probar entrega en un canal")
async def test_channel(id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(NotificationChannel).where(NotificationChannel.id == id)
    res = await db.execute(stmt)
    channel = res.scalars().first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal no encontrado")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Crear alerta sintética SYS-TEST
    test_alert = Alert(
        fingerprint="sys-test-fingerprint",
        rule_code="SYS-TEST",
        source=AlertSource.MANUAL,
        severity=AlertSeverity.INFO,
        status=AlertStatus.RESOLVED,
        title="Alerta de prueba del sistema",
        message=f"Prueba de conectividad para el canal '{channel.name}' ejecutada satisfactoriamente.",
        scope_type=AlertScopeType.SYSTEM,
        is_provisional=False,
        occurrence_count=1,
        first_detected_at=now,
        last_detected_at=now,
        resolved_at=now,
        resolved_by="SYSTEM",
        created_at=now,
        updated_at=now,
    )
    db.add(test_alert)
    await db.flush()

    delivery = NotificationDelivery(
        alert_id=test_alert.id,
        channel_id=channel.id,
        channel_type=channel.channel_type,
        target=channel.target,
        event="TEST",
        status=DeliveryStatus.PENDING,
        attempts=1,
        created_at=now,
    )
    db.add(delivery)
    await db.flush()

    try:
        if channel.channel_type == ChannelType.EMAIL:
            await email_backend.send(alert=test_alert, event="TEST", target=channel.target)
        elif channel.channel_type == ChannelType.WEBHOOK:
            await webhook_backend.send(
                alert=test_alert,
                event="TEST",
                target=channel.target,
                secret=channel.secret,
            )
        delivery.status = DeliveryStatus.SENT
        delivery.sent_at = datetime.now(timezone.utc).replace(tzinfo=None)
    except Exception as ex:
        delivery.status = DeliveryStatus.FAILED
        delivery.error = str(ex)

    await db.commit()
    await db.refresh(delivery)
    return NotificationDeliveryRead.model_validate(delivery)


# --- REGLAS ---

@router.get("/rules", response_model=List[AlertRuleRead], summary="Catálogo maestro de reglas")
async def list_rules(db: AsyncSession = Depends(get_db)):
    stmt = select(AlertRule).order_by(AlertRule.rule_code.asc())
    res = await db.execute(stmt)
    db_rules = {r.rule_code: r for r in res.scalars().all()}

    output = []
    for code, d_rule in DEFAULT_RULES.items():
        if code in db_rules:
            r = db_rules[code]
            output.append(AlertRuleRead(
                id=r.id,
                rule_code=r.rule_code,
                name=r.name,
                description=r.description,
                is_enabled=r.is_enabled,
                severity_override=r.severity_override,
                params=r.params,
                notify_external=r.notify_external,
                escalate_after_minutes=r.escalate_after_minutes,
                created_at=r.created_at,
            ))
        else:
            output.append(AlertRuleRead(
                id=0,
                rule_code=code,
                name=d_rule.name,
                description=d_rule.description,
                is_enabled=True,
                severity_override=None,
                params=d_rule.params,
                notify_external=d_rule.notify_external,
                escalate_after_minutes=d_rule.escalate_after_minutes,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            ))
    return output


@router.put("/rules/{rule_code}", response_model=AlertRuleRead, summary="Editar o anular regla")
async def update_rule(
    rule_code: str,
    body: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AlertRule).where(AlertRule.rule_code == rule_code)
    res = await db.execute(stmt)
    rule = res.scalars().first()

    if not rule:
        d_def = DEFAULT_RULES.get(rule_code)
        if not d_def:
            raise HTTPException(status_code=404, detail="Regla no encontrada")
        rule = AlertRule(
            rule_code=rule_code,
            name=d_def.name,
            description=d_def.description,
            is_enabled=True,
            params=d_def.params,
            notify_external=d_def.notify_external,
            escalate_after_minutes=d_def.escalate_after_minutes,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        db.add(rule)
        await db.flush()

    update_data = body.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(rule, field, val)

    await db.commit()
    await db.refresh(rule)
    return AlertRuleRead.model_validate(rule)


# --- ENTREGAS ---

@router.get("/deliveries", response_model=List[NotificationDeliveryRead], summary="Bitácora de envíos")
async def list_deliveries(
    alert_id: Optional[int] = Query(None),
    status: Optional[DeliveryStatus] = Query(None),
    channel_type: Optional[ChannelType] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if alert_id:
        conditions.append(NotificationDelivery.alert_id == alert_id)
    if status:
        conditions.append(NotificationDelivery.status == status)
    if channel_type:
        conditions.append(NotificationDelivery.channel_type == channel_type)

    stmt = (
        select(NotificationDelivery)
        .where(and_(*conditions) if conditions else True)
        .order_by(desc(NotificationDelivery.created_at))
        .offset(offset)
        .limit(limit)
    )
    res = await db.execute(stmt)
    deliveries = res.scalars().all()
    return [NotificationDeliveryRead.model_validate(d) for d in deliveries]
