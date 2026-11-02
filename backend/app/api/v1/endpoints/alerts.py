import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import Permission
from app.core.security import decode_token
from app.models.hierarchy import Asset, Sector, Hospital
from app.models.checklist import ChecklistItem
from app.models.compliance import AuditLog
from app.models.user import User
from app.models.notification import (
    Alert,
    AlertSeverity,
    AlertStatus,
    AlertSource,
    AlertScopeType,
    NotificationDelivery,
)
from app.schemas.notification import (
    AlertRead,
    AlertDetailRead,
    AlertListResponse,
    AlertSummary,
    AlertAcknowledgeRequest,
    AlertResolveRequest,
    AlertSilenceRequest,
    AlertBulkAckRequest,
    NotificationDeliveryRead,
)
from app.services.notifications.alert_engine import AlertEngine
from app.services.notifications.broker import alert_broker
from app.services.notifications.scheduler import run_scheduled_checks
from app.services.access_control import (
    scope_filter_hospital_ids,
    assert_hospital_in_scope,
    get_user_hospital_ids,
)
from app.api.deps import require_permissions, get_request_context, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


def _populate_alert_read(alert: Alert) -> AlertRead:
    read_obj = AlertRead.model_validate(alert)
    if alert.asset:
        read_obj.asset_tag = alert.asset.tag_code
        read_obj.asset_name = alert.asset.name
    if alert.sector:
        read_obj.sector_name = alert.sector.name
    if alert.hospital:
        read_obj.hospital_code = alert.hospital.code
    if alert.item:
        read_obj.item_code = alert.item.code
        read_obj.item_title = alert.item.title
    return read_obj


@router.get("", response_model=AlertListResponse, summary="Listado filtrable de alertas")
async def get_alerts(
    status: Optional[List[AlertStatus]] = Query(None),
    severity: Optional[List[AlertSeverity]] = Query(None),
    rule_code: Optional[str] = Query(None),
    hospital_id: Optional[int] = Query(None),
    sector_id: Optional[int] = Query(None),
    asset_id: Optional[int] = Query(None),
    inspection_id: Optional[int] = Query(None),
    include_provisional: bool = Query(True),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort: str = Query("-last_detected_at"),
    user: User = Depends(require_permissions(Permission.ALERTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    allowed_hospitals = scope_filter_hospital_ids(user)

    if hospital_id:
        assert_hospital_in_scope(user, hospital_id)
        conditions.append(Alert.hospital_id == hospital_id)
    elif allowed_hospitals is not None:
        conditions.append(or_(Alert.hospital_id.in_(allowed_hospitals), Alert.hospital_id.is_(None)))

    if status:
        conditions.append(Alert.status.in_(status))
    if severity:
        conditions.append(Alert.severity.in_(severity))
    if rule_code:
        conditions.append(Alert.rule_code == rule_code)
    if sector_id:
        conditions.append(Alert.sector_id == sector_id)
    if asset_id:
        conditions.append(Alert.asset_id == asset_id)
    if inspection_id:
        conditions.append(Alert.inspection_id == inspection_id)
    if not include_provisional:
        conditions.append(Alert.is_provisional == False)

    if q:
        search_filter = or_(
            Alert.title.ilike(f"%{q}%"),
            Alert.message.ilike(f"%{q}%"),
            Alert.rule_code.ilike(f"%{q}%"),
        )
        conditions.append(search_filter)

    # Conteo total
    count_stmt = select(func.count(Alert.id)).where(and_(*conditions)) if conditions else select(func.count(Alert.id))
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # Conteos agrupados
    sev_stmt = (
        select(Alert.severity, func.count(Alert.id))
        .where(and_(*conditions))
        .group_by(Alert.severity)
        if conditions
        else select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
    )
    sev_res = await db.execute(sev_stmt)
    counts_by_sev = {s.value: 0 for s in AlertSeverity}
    for sev, count in sev_res.all():
        counts_by_sev[sev.value] = count

    stat_stmt = (
        select(Alert.status, func.count(Alert.id))
        .where(and_(*conditions))
        .group_by(Alert.status)
        if conditions
        else select(Alert.status, func.count(Alert.id)).group_by(Alert.status)
    )
    stat_res = await db.execute(stat_stmt)
    counts_by_stat = {st.value: 0 for st in AlertStatus}
    for st, count in stat_res.all():
        counts_by_stat[st.value] = count

    # Consulta principal
    query = (
        select(Alert)
        .options(
            selectinload(Alert.asset),
            selectinload(Alert.sector),
            selectinload(Alert.hospital),
            selectinload(Alert.item),
        )
    )
    if conditions:
        query = query.where(and_(*conditions))

    # Ordenamiento
    sort_fields = {
        "-last_detected_at": desc(Alert.last_detected_at),
        "last_detected_at": asc(Alert.last_detected_at),
        "-severity": desc(Alert.severity),
        "severity": asc(Alert.severity),
        "-created_at": desc(Alert.created_at),
        "created_at": asc(Alert.created_at),
    }
    query = query.order_by(sort_fields.get(sort, desc(Alert.last_detected_at)))
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    alerts = result.scalars().all()

    items = [_populate_alert_read(a) for a in alerts]

    return AlertListResponse(
        items=items,
        total=total,
        counts_by_severity=counts_by_sev,
        counts_by_status=counts_by_stat,
    )


@router.get("/summary", response_model=AlertSummary, summary="Resumen ejecutivo de alertas")
async def get_alert_summary(
    hospital_id: Optional[int] = Query(None),
    with_metrics: bool = Query(False),
    user: User = Depends(require_permissions(Permission.ALERTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    allowed_hospitals = scope_filter_hospital_ids(user)
    conditions = [
        Alert.status.in_([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]),
    ]
    if hospital_id:
        assert_hospital_in_scope(user, hospital_id)
        conditions.append(Alert.hospital_id == hospital_id)
    elif allowed_hospitals is not None:
        conditions.append(or_(Alert.hospital_id.in_(allowed_hospitals), Alert.hospital_id.is_(None)))

    stmt = (
        select(Alert.severity, func.count(Alert.id))
        .where(and_(*conditions))
        .group_by(Alert.severity)
    )
    res = await db.execute(stmt)
    open_by_severity = {s.value: 0 for s in AlertSeverity}
    for sev, count in res.all():
        open_by_severity[sev.value] = count

    open_total = sum(open_by_severity.values())

    # Críticas sin reconocer (solo status OPEN)
    crit_cond = [
        Alert.severity == AlertSeverity.CRITICAL,
        Alert.status == AlertStatus.OPEN,
    ]
    if hospital_id:
        crit_cond.append(Alert.hospital_id == hospital_id)
    elif allowed_hospitals is not None:
        crit_cond.append(or_(Alert.hospital_id.in_(allowed_hospitals), Alert.hospital_id.is_(None)))

    crit_res = await db.execute(select(func.count(Alert.id)).where(and_(*crit_cond)))
    unack_crit = crit_res.scalar() or 0

    # Última alerta detectada
    last_res = await db.execute(
        select(func.max(Alert.last_detected_at)).where(and_(*conditions))
    )
    last_detected = last_res.scalar()

    # Health general
    health = "OK"
    if open_by_severity.get("CRITICAL", 0) > 0:
        health = "CRITICAL"
    elif open_by_severity.get("HIGH", 0) > 0 or open_by_severity.get("MEDIUM", 0) > 0:
        health = "DEGRADED"

    mtta = None
    mttr = None
    if with_metrics:
        thirty_days_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        mtta_stmt = select(Alert).where(
            Alert.acknowledged_at != None,
            Alert.created_at >= thirty_days_ago,
        )
        if hospital_id:
            mtta_stmt = mtta_stmt.where(Alert.hospital_id == hospital_id)
        elif allowed_hospitals is not None:
            mtta_stmt = mtta_stmt.where(Alert.hospital_id.in_(allowed_hospitals))

        mtta_res = await db.execute(mtta_stmt)
        ack_alerts = mtta_res.scalars().all()
        if ack_alerts:
            deltas = [(a.acknowledged_at - a.first_detected_at).total_seconds() / 60.0 for a in ack_alerts if a.acknowledged_at and a.first_detected_at]
            if deltas:
                mtta = round(sum(deltas) / len(deltas), 1)

        mttr_stmt = select(Alert).where(
            Alert.resolved_at != None,
            Alert.created_at >= thirty_days_ago,
        )
        if hospital_id:
            mttr_stmt = mttr_stmt.where(Alert.hospital_id == hospital_id)
        elif allowed_hospitals is not None:
            mttr_stmt = mttr_stmt.where(Alert.hospital_id.in_(allowed_hospitals))

        mttr_res = await db.execute(mttr_stmt)
        res_alerts = mttr_res.scalars().all()
        if res_alerts:
            deltas_r = [(a.resolved_at - a.first_detected_at).total_seconds() / 60.0 for a in res_alerts if a.resolved_at and a.first_detected_at]
            if deltas_r:
                mttr = round(sum(deltas_r) / len(deltas_r), 1)

    return AlertSummary(
        open_total=open_total,
        open_by_severity=open_by_severity,
        unacknowledged_critical=unack_crit,
        last_alert_at=last_detected,
        health=health,
        mtta_minutes=mtta,
        mttr_minutes=mttr,
    )


@router.get("/stream", summary="Stream de eventos en tiempo real (SSE con ticket temporal)")
async def stream_alerts(
    request: Request,
    hospital_id: Optional[int] = Query(None),
    ticket: Optional[str] = Query(None, description="Ticket JWT temporal de corta vida para SSE"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint Server-Sent Events (SSE). Exige autenticación via ticket (?ticket=...) o Bearer header.
    Filtra los eventos transmitidos según el alcance de hospitales del usuario autenticado.
    """
    # Autenticar usuario
    user = None
    if ticket:
        try:
            payload = decode_token(ticket)
            if payload.get("type") != "sse":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ticket SSE inválido (tipo incorrecto)")
            u_id = int(payload.get("sub"))
            tv = payload.get("tv")
            res = await db.execute(select(User).options(selectinload(User.hospitals)).where(User.id == u_id))
            user = res.scalar_one_or_none()
            if not user or not user.is_active or user.token_version != tv:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ticket SSE vencido o revocado")
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ticket SSE inválido o vencido")
    else:
        # Fallback a Bearer header
        auth_header = request.headers.get("authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Se requiere autenticación mediante ticket temporal o Bearer token")
        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
            u_id = int(payload.get("sub"))
            tv = payload.get("tv")
            res = await db.execute(select(User).options(selectinload(User.hospitals)).where(User.id == u_id))
            user = res.scalar_one_or_none()
            if not user or not user.is_active or user.token_version != tv:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o revocado")
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o vencido")

    # Validar permiso de alertas
    user_allowed_hospitals = scope_filter_hospital_ids(user)
    if hospital_id:
        assert_hospital_in_scope(user, hospital_id)

    async def event_generator():
        queue = await alert_broker.subscribe()
        try:
            yield "event: connected\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=25.0)
                    data = payload.get("data", {})
                    h_id = data.get("hospital_id")

                    # Filtrar por alcance del usuario
                    if user_allowed_hospitals is not None and h_id is not None and h_id not in user_allowed_hospitals:
                        continue

                    # Filtrar por query param si fue provisto
                    if hospital_id is not None and h_id is not None and h_id != hospital_id:
                        continue

                    event_name = payload.get("event", "alert.event")
                    yield f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
        finally:
            await alert_broker.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/run-checks", summary="Disparo manual del barrido de alertas")
async def trigger_run_checks(
    user: User = Depends(require_permissions(Permission.ALERTS_RUN_CHECKS)),
    db: AsyncSession = Depends(get_db)
):
    results = await run_scheduled_checks(db)
    await db.commit()
    return results


@router.get("/{id}", response_model=AlertDetailRead, summary="Detalle de una alerta")
async def get_alert_detail(
    id: int,
    user: User = Depends(require_permissions(Permission.ALERTS_READ)),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Alert)
        .options(
            selectinload(Alert.asset),
            selectinload(Alert.sector),
            selectinload(Alert.hospital),
            selectinload(Alert.item),
            selectinload(Alert.deliveries),
        )
        .where(Alert.id == id)
    )
    res = await db.execute(stmt)
    alert = res.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    if alert.hospital_id:
        assert_hospital_in_scope(user, alert.hospital_id)

    audit_stmt = (
        select(AuditLog)
        .where(
            AuditLog.event_type.in_([
                "ALERT_RAISED", "ALERT_ACKNOWLEDGED", "ALERT_RESOLVED", "ALERT_ESCALATED", "ALERT_SILENCED"
            ])
        )
        .order_by(AuditLog.created_at.asc())
    )
    audit_res = await db.execute(audit_stmt)
    logs = audit_res.scalars().all()
    matching_trail = []
    for log in logs:
        if log.event_detail and log.event_detail.get("alert_id") == alert.id:
            matching_trail.append({
                "id": log.id,
                "event_type": log.event_type.value if hasattr(log.event_type, "value") else str(log.event_type),
                "actor": log.actor,
                "event_detail": log.event_detail,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            })

    base_read = _populate_alert_read(alert)
    detail = AlertDetailRead(
        **base_read.model_dump(),
        deliveries=[NotificationDeliveryRead.model_validate(d) for d in alert.deliveries],
        audit_trail=matching_trail,
    )
    return detail


@router.post("/{id}/acknowledge", response_model=AlertRead, summary="Reconocer una alerta")
async def acknowledge_alert(
    id: int,
    body: AlertAcknowledgeRequest,
    request: Request,
    user: User = Depends(require_permissions(Permission.ALERTS_ACKNOWLEDGE)),
    db: AsyncSession = Depends(get_db),
):
    # Validar scope
    check_stmt = select(Alert.hospital_id).where(Alert.id == id)
    h_res = await db.execute(check_stmt)
    h_id = h_res.scalar_one_or_none()
    if h_id is not None:
        assert_hospital_in_scope(user, h_id)

    ip, ua = get_request_context(request)
    alert = await AlertEngine.acknowledge(db, id, note=body.note, user=user, ip=ip, user_agent=ua)
    await db.commit()

    stmt = select(Alert).options(
        selectinload(Alert.asset),
        selectinload(Alert.sector),
        selectinload(Alert.hospital),
        selectinload(Alert.item),
    ).where(Alert.id == id)
    res = await db.execute(stmt)
    loaded = res.scalars().first()
    return _populate_alert_read(loaded)


@router.post("/{id}/resolve", response_model=AlertRead, summary="Resolver una alerta")
async def resolve_alert(
    id: int,
    body: AlertResolveRequest,
    request: Request,
    user: User = Depends(require_permissions(Permission.ALERTS_RESOLVE)),
    db: AsyncSession = Depends(get_db),
):
    check_stmt = select(Alert.hospital_id).where(Alert.id == id)
    h_res = await db.execute(check_stmt)
    h_id = h_res.scalar_one_or_none()
    if h_id is not None:
        assert_hospital_in_scope(user, h_id)

    ip, ua = get_request_context(request)
    alert = await AlertEngine.resolve(db, id, note=body.note, user=user, ip=ip, user_agent=ua)
    await db.commit()

    stmt = select(Alert).options(
        selectinload(Alert.asset),
        selectinload(Alert.sector),
        selectinload(Alert.hospital),
        selectinload(Alert.item),
    ).where(Alert.id == id)
    res = await db.execute(stmt)
    loaded = res.scalars().first()
    return _populate_alert_read(loaded)


@router.post("/{id}/silence", response_model=AlertRead, summary="Silenciar una alerta")
async def silence_alert(
    id: int,
    body: AlertSilenceRequest,
    request: Request,
    user: User = Depends(require_permissions(Permission.ALERTS_SILENCE)),
    db: AsyncSession = Depends(get_db),
):
    check_stmt = select(Alert.hospital_id).where(Alert.id == id)
    h_res = await db.execute(check_stmt)
    h_id = h_res.scalar_one_or_none()
    if h_id is not None:
        assert_hospital_in_scope(user, h_id)

    ip, ua = get_request_context(request)
    alert = await AlertEngine.silence(db, id, until=body.until, note=body.note, user=user, ip=ip, user_agent=ua)
    await db.commit()

    stmt = select(Alert).options(
        selectinload(Alert.asset),
        selectinload(Alert.sector),
        selectinload(Alert.hospital),
        selectinload(Alert.item),
    ).where(Alert.id == id)
    res = await db.execute(stmt)
    loaded = res.scalars().first()
    return _populate_alert_read(loaded)


@router.post("/bulk-acknowledge", summary="Reconocimiento masivo de alertas")
async def bulk_acknowledge_alerts(
    body: AlertBulkAckRequest,
    request: Request,
    user: User = Depends(require_permissions(Permission.ALERTS_ACKNOWLEDGE)),
    db: AsyncSession = Depends(get_db),
):
    allowed_hospitals = scope_filter_hospital_ids(user)
    # Filtrar solo IDs que pertenezcan a hospitales permitidos
    target_ids = body.ids
    if allowed_hospitals is not None:
        check_stmt = select(Alert.id).where(Alert.id.in_(target_ids), Alert.hospital_id.in_(allowed_hospitals))
        target_ids = list((await db.execute(check_stmt)).scalars().all())

    ip, ua = get_request_context(request)
    updated = await AlertEngine.bulk_acknowledge(db, target_ids, user=user, ip=ip, user_agent=ua)
    await db.commit()
    return {"updated": updated}


# Router específico para /assets/{id}/alerts
asset_router = APIRouter()


@asset_router.get("/{id}/alerts", response_model=List[AlertRead], summary="Alertas de un activo")
async def get_asset_alerts(
    id: int,
    status: Optional[AlertStatus] = Query(None),
    user: User = Depends(require_permissions(Permission.ALERTS_READ)),
    db: AsyncSession = Depends(get_db),
):
    # Validar que el activo esté en el alcance
    asset_stmt = select(Sector.hospital_id).join(Asset, Asset.sector_id == Sector.id).where(Asset.id == id)
    h_id = (await db.execute(asset_stmt)).scalar_one_or_none()
    if h_id is not None:
        assert_hospital_in_scope(user, h_id)

    conditions = [Alert.asset_id == id]
    if status:
        conditions.append(Alert.status == status)

    stmt = (
        select(Alert)
        .options(
            selectinload(Alert.asset),
            selectinload(Alert.sector),
            selectinload(Alert.hospital),
            selectinload(Alert.item),
        )
        .where(and_(*conditions))
        .order_by(desc(Alert.last_detected_at))
    )
    res = await db.execute(stmt)
    alerts = res.scalars().all()
    return [_populate_alert_read(a) for a in alerts]
