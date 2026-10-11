import pytest
import hmac
import hashlib
import json
from datetime import datetime, timezone, timedelta, date
from httpx import AsyncClient
from sqlalchemy import select, func

from app.core.config import settings
from app.models.hierarchy import Asset, Sector, Hospital, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.inspection import Inspection, InspectionStatus, InspectionResponse
from app.models.compliance import NormativeReference, AuditLog, AuditEventType, ComplianceResult, ComplianceStatus, ComplianceSeverity
from app.models.notification import (
    Alert,
    AlertSeverity,
    AlertStatus,
    AlertSource,
    AlertScopeType,
    NotificationChannel,
    AlertRule,
    NotificationDelivery,
    ChannelType,
    DeliveryStatus,
)
from app.services.notifications.rules import DEFAULT_RULES
from app.services.notifications.alert_engine import AlertEngine
from app.services.notifications.broker import alert_broker
from app.services.notifications.dispatcher import dispatcher
from app.services.notifications.scheduler import run_scheduled_checks
from app.services.notifications.channels.email import email_backend
from app.services.notifications.channels.webhook import webhook_backend


async def ensure_rules_seeded(db_session):
    for code, rdef in DEFAULT_RULES.items():
        stmt = select(AlertRule).where(AlertRule.rule_code == code)
        res = await db_session.execute(stmt)
        if not res.scalars().first():
            rule = AlertRule(
                rule_code=code,
                name=rdef.name,
                description=rdef.description,
                is_enabled=True,
                severity_override=None,
                params=rdef.params,
                notify_external=rdef.notify_external,
                escalate_after_minutes=rdef.escalate_after_minutes,
            )
            db_session.add(rule)
    await db_session.flush()


@pytest.mark.asyncio
async def test_critical_non_compliance_raises_alert(client: AsyncClient, db_session):
    """Test 1: Presión 2.0 bar en M-01 genera alerta CMP-CRIT-NC CRITICAL OPEN provisional"""
    await ensure_rules_seeded(db_session)

    # 1. Crear inspección
    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Dr. House",
        "notes": "Prueba de presión crítica"
    })
    assert insp_res.status_code == 201
    insp_id = insp_res.json()["id"]

    # 2. Cargar respuesta no conforme crítica en M-01 (min 4.0 bar, enviamos 2.0 bar)
    resp_res = await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [
            {
                "item_id": 1,
                "val_numeric": 2.0,
                "observation": "Presión muy baja en colector"
            }
        ]
    })
    assert resp_res.status_code == 200

    # 3. Invocar evaluación de compliance
    comp_res = await client.get(f"/api/v1/inspections/{insp_id}/compliance")
    assert comp_res.status_code == 200

    # 4. Verificar que se creó la alerta en base de datos
    alert_stmt = select(Alert).where(Alert.inspection_id == insp_id, Alert.item_id == 1)
    alert_res = await db_session.execute(alert_stmt)
    alert = alert_res.scalars().first()

    assert alert is not None
    assert alert.rule_code == "CMP-CRIT-NC"
    assert alert.severity == AlertSeverity.CRITICAL
    assert alert.status == AlertStatus.OPEN
    assert alert.is_provisional is True
    assert "2.0" in alert.actual_value
    assert alert.normative_ref == "ISO 7396-1:cl.5.3"
    assert alert.occurrence_count == 1


@pytest.mark.asyncio
async def test_repeated_validation_is_deduplicated(client: AsyncClient, db_session):
    """Test 2: Llamar /compliance 5 veces no crea 5 alertas sino 1 con occurrence_count == 5"""
    await ensure_rules_seeded(db_session)

    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Dr. House"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 1, "val_numeric": 2.0}]
    })

    # Llamar 5 veces al endpoint
    for _ in range(5):
        await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    alert_stmt = select(Alert).where(Alert.inspection_id == insp_id, Alert.item_id == 1)
    res = await db_session.execute(alert_stmt)
    alerts = res.scalars().all()

    assert len(alerts) == 1
    assert alerts[0].occurrence_count == 5


@pytest.mark.asyncio
async def test_alert_auto_resolves_when_value_corrected(client: AsyncClient, db_session):
    """Test 3: Corregir el valor a 4.8 bar auto-resuelve la alerta previa a AUTO_RESOLVED"""
    await ensure_rules_seeded(db_session)

    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Dr. House"
    })
    insp_id = insp_res.json()["id"]

    # Primero carga errónea
    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 1, "val_numeric": 2.0}]
    })
    await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    alert_stmt = select(Alert).where(Alert.inspection_id == insp_id, Alert.item_id == 1)
    alert = (await db_session.execute(alert_stmt)).scalars().first()
    assert alert.status == AlertStatus.OPEN

    # Corrección a 4.8 bar (conforme)
    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 1, "val_numeric": 4.8}]
    })
    await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    await db_session.refresh(alert)
    assert alert.status == AlertStatus.AUTO_RESOLVED
    assert alert.resolved_by == "SYSTEM"


@pytest.mark.asyncio
async def test_warning_band_raises_medium_alert(client: AsyncClient, db_session):
    """Test 4: Valor 4.05 bar (banda de advertencia) genera CMP-WARN-BAND MEDIUM"""
    await ensure_rules_seeded(db_session)

    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Ing. Preventivo"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 1, "val_numeric": 4.05}]
    })
    await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    stmt = select(Alert).where(Alert.inspection_id == insp_id, Alert.item_id == 1)
    alert = (await db_session.execute(stmt)).scalars().first()

    assert alert is not None
    assert alert.rule_code == "CMP-WARN-BAND"
    assert alert.severity == AlertSeverity.MEDIUM


@pytest.mark.asyncio
async def test_boolean_failure_alarm_item(client: AsyncClient, db_session):
    """Test 5: Falla en ítem de Alarma (M-02 = False) genera alerta CRITICAL"""
    await ensure_rules_seeded(db_session)

    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Técnico Alarmas"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 2, "val_boolean": False}]
    })
    await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    stmt = select(Alert).where(Alert.inspection_id == insp_id, Alert.item_id == 2)
    alert = (await db_session.execute(stmt)).scalars().first()

    assert alert is not None
    assert alert.rule_code == "CMP-CRIT-NC"
    assert alert.severity == AlertSeverity.CRITICAL


@pytest.mark.asyncio
async def test_completion_consolidates_and_dispatches_external(client: AsyncClient, db_session, monkeypatch):
    """Test 6: Completar inspección consolida alertas y despacha external email delivery"""
    await ensure_rules_seeded(db_session)

    # Crear canal email activo
    chan = NotificationChannel(
        name="Email Guardia",
        channel_type=ChannelType.EMAIL,
        target="guardia@hospital.local",
        min_severity=AlertSeverity.HIGH,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(chan)
    await db_session.flush()

    emails_sent = []
    async def fake_send_email(alert, event, target):
        emails_sent.append((alert.id, event, target))

    monkeypatch.setattr(email_backend, "send", fake_send_email)

    # Crear inspección y responder ítems (uno crítico y uno ok)
    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Dr. Cierre"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [
            {"item_id": 1, "val_numeric": 2.0},
            {"item_id": 2, "val_boolean": True}
        ]
    })
    await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    # Al completar la inspección
    comp_res = await client.post(f"/api/v1/inspections/{insp_id}/complete", json={
        "inspector_name": "Dr. Cierre",
        "notes": "Cierre con desvío"
    })
    assert comp_res.status_code == 200

    # Verificar que las alertas pasaron a is_provisional == False
    stmt = select(Alert).where(Alert.inspection_id == insp_id)
    alerts = (await db_session.execute(stmt)).scalars().all()
    for a in alerts:
        assert a.is_provisional is False

    # Verificar alerta INS-CLOSED-NC creada
    closed_nc = [a for a in alerts if a.rule_code == "INS-CLOSED-NC"]
    assert len(closed_nc) == 1

    # Verificar delivery SENT
    deliv_stmt = select(NotificationDelivery).where(NotificationDelivery.status == DeliveryStatus.SENT)
    delivs = (await db_session.execute(deliv_stmt)).scalars().all()
    assert len(delivs) >= 1
    assert any(d.target == "guardia@hospital.local" for d in delivs)


@pytest.mark.asyncio
async def test_provisional_alerts_not_sent_externally(client: AsyncClient, db_session, monkeypatch):
    """Test 7: Con ALERTS_NOTIFY_CRITICAL_LIVE=False no se envían desvíos en curso"""
    await ensure_rules_seeded(db_session)
    monkeypatch.setattr(settings, "ALERTS_NOTIFY_CRITICAL_LIVE", False)

    chan = NotificationChannel(
        name="Email Guardia",
        channel_type=ChannelType.EMAIL,
        target="guardia@hospital.local",
        min_severity=AlertSeverity.HIGH,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(chan)
    await db_session.flush()

    emails_sent = []
    async def fake_send_email(alert, event, target):
        emails_sent.append((alert.id, event, target))
    monkeypatch.setattr(email_backend, "send", fake_send_email)

    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Inspector Vivo"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 1, "val_numeric": 2.0}]
    })
    await client.get(f"/api/v1/inspections/{insp_id}/compliance")

    # No debe haberse enviado nada por email porque es provisional
    assert len(emails_sent) == 0


@pytest.mark.asyncio
async def test_min_severity_filter_on_channel(client: AsyncClient, db_session, monkeypatch):
    """Test 8: Canal con min_severity=CRITICAL no despacha alerta HIGH"""
    await ensure_rules_seeded(db_session)

    chan = NotificationChannel(
        name="Solo Críticas",
        channel_type=ChannelType.EMAIL,
        target="jefe@hospital.local",
        min_severity=AlertSeverity.CRITICAL,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(chan)
    await db_session.flush()

    sent = []
    async def fake_send(alert, event, target):
        sent.append(alert.id)
    monkeypatch.setattr(email_backend, "send", fake_send)

    # Emitir alerta HIGH
    high_alert, _ = await AlertEngine.raise_or_update(
        db_session,
        rule_code="CMP-MAJOR-NC",
        severity=AlertSeverity.HIGH,
        scope_type=AlertScopeType.INSPECTION,
        scope_id=999,
        title="Desvío mayor",
        message="Detalle mayor",
        is_provisional=False
    )
    await dispatcher.dispatch(db_session, high_alert, event="RAISED")

    assert len(sent) == 0


@pytest.mark.asyncio
async def test_acknowledge_resolve_flow_and_audit_log(client: AsyncClient, db_session):
    """Test 9: Flujo ACK -> RESOLVED con notas y trazabilidad en AuditLog"""
    await ensure_rules_seeded(db_session)

    alert, _ = await AlertEngine.raise_or_update(
        db_session,
        rule_code="CMP-CRIT-NC",
        severity=AlertSeverity.CRITICAL,
        scope_type=AlertScopeType.INSPECTION,
        scope_id=1,
        title="Fuga crítica",
        message="Fuga en rampa",
        is_provisional=False
    )
    await db_session.commit()

    # 1. Reconocer
    ack_res = await client.post(f"/api/v1/alerts/{alert.id}/acknowledge", json={
        "actor": "Ing. Perez",
        "note": "Personal técnico desplazado a sala"
    })
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # 2. Intentar resolver CRITICAL sin nota -> 422
    fail_res = await client.post(f"/api/v1/alerts/{alert.id}/resolve", json={
        "actor": "Ing. Perez",
        "note": ""
    })
    assert fail_res.status_code == 422

    # 3. Resolver con nota -> 200
    ok_res = await client.post(f"/api/v1/alerts/{alert.id}/resolve", json={
        "actor": "Ing. Perez",
        "note": "Sello elastomérico sustituido y presurizado conforme"
    })
    assert ok_res.status_code == 200
    assert ok_res.json()["status"] == "RESOLVED"

    # 4. Intentar ACK de alerta ya resuelta -> 409
    conflict_res = await client.post(f"/api/v1/alerts/{alert.id}/acknowledge", json={
        "actor": "Ing. Perez"
    })
    assert conflict_res.status_code == 409

    # 5. Verificar logs de auditoría
    audit_stmt = select(AuditLog).where(
        AuditLog.event_type.in_([AuditEventType.ALERT_ACKNOWLEDGED, AuditEventType.ALERT_RESOLVED])
    )
    logs = (await db_session.execute(audit_stmt)).scalars().all()
    assert len(logs) >= 2


@pytest.mark.asyncio
async def test_silence_rules(client: AsyncClient, db_session):
    """Test 10: Reglas de silencio y restricciones sobre CYL-HYDRO-EXPIRED"""
    await ensure_rules_seeded(db_session)
    now = datetime.utcnow()

    # 1. Alerta HIGH se puede silenciar
    high_alert, _ = await AlertEngine.raise_or_update(
        db_session,
        rule_code="CMP-MAJOR-NC",
        severity=AlertSeverity.HIGH,
        scope_type=AlertScopeType.ASSET,
        scope_id=1,
        title="Desvío mayor",
        message="Prueba"
    )
    await db_session.commit()

    sil_res = await client.post(f"/api/v1/alerts/{high_alert.id}/silence", json={
        "actor": "Supervisor",
        "until": (now + timedelta(hours=4)).isoformat(),
        "note": "Espera de repuestos"
    })
    assert sil_res.status_code == 200
    assert sil_res.json()["status"] == "SILENCED"

    # 2. Período excesivo (> 72 horas) -> 422
    too_long_res = await client.post(f"/api/v1/alerts/{high_alert.id}/silence", json={
        "actor": "Supervisor",
        "until": (now + timedelta(hours=100)).isoformat(),
    })
    assert too_long_res.status_code == 422

    # 3. Alerta reglamentaria legal crítica CYL-HYDRO-EXPIRED no se puede silenciar -> 422
    hydro_alert, _ = await AlertEngine.raise_or_update(
        db_session,
        rule_code="CYL-HYDRO-EXPIRED",
        severity=AlertSeverity.CRITICAL,
        scope_type=AlertScopeType.ASSET,
        scope_id=2,
        title="PH Vencida",
        message="IRAM 2529 vencida"
    )
    await db_session.commit()

    legal_fail = await client.post(f"/api/v1/alerts/{hydro_alert.id}/silence", json={
        "actor": "Supervisor",
        "until": (now + timedelta(hours=2)).isoformat(),
        "note": "Intentando silenciar ilegalmente"
    })
    assert legal_fail.status_code == 422


@pytest.mark.asyncio
async def test_scheduler_overdue_inspection(db_session):
    """Test 11: Activo sin inspección previa genera AST-INSP-OVERDUE y se auto-resuelve al completar"""
    await ensure_rules_seeded(db_session)
    now = datetime.utcnow()

    # Ejecutar scheduler
    checks = await run_scheduled_checks(db_session, now=now)
    assert checks.get("AST-INSP-OVERDUE", 0) >= 1

    stmt = select(Alert).where(Alert.rule_code == "AST-INSP-OVERDUE", Alert.asset_id == 1)
    alert = (await db_session.execute(stmt)).scalars().first()
    assert alert is not None
    assert alert.status == AlertStatus.OPEN

    # Completar una inspección satisfactoria para el activo 1
    insp = Inspection(
        asset_id=1,
        template_id=1,
        status=InspectionStatus.COMPLETED,
        inspector_name="Inspector Test",
        started_at=now - timedelta(hours=1),
        completed_at=now,
    )
    db_session.add(insp)
    await db_session.flush()

    class MockSummary:
        non_compliant_items = 0
        is_fully_compliant = True
        results = []

    await AlertEngine.process_inspection_completed(db_session, insp, MockSummary())

    await db_session.refresh(alert)
    assert alert.status == AlertStatus.AUTO_RESOLVED


@pytest.mark.asyncio
async def test_scheduler_hydraulic_test_expired_and_soon(client: AsyncClient, db_session):
    """Test 12: Detección de PH vencida (IRAM 2529) y por vencer; auto-resolución vía PUT activo"""
    await ensure_rules_seeded(db_session)
    now = datetime.utcnow()

    # Setear fechas en activos tipo cilindro
    stmt_cyl = select(Asset).where(Asset.asset_type == AssetType.GAS_CYLINDER)
    cyl = (await db_session.execute(stmt_cyl)).scalars().first()
    assert cyl is not None

    # Vencido hace 6 años
    cyl.hydraulic_test_date = (now - timedelta(days=2200)).date()
    await db_session.commit()

    # Ejecutar barrido
    await run_scheduled_checks(db_session, now=now)

    stmt_alert = select(Alert).where(Alert.rule_code == "CYL-HYDRO-EXPIRED", Alert.asset_id == cyl.id)
    alert = (await db_session.execute(stmt_alert)).scalars().first()
    assert alert is not None
    assert alert.status == AlertStatus.OPEN

    # Actualizar fecha de prueba hidráulica vía endpoint PUT /hierarchy/assets/{id}
    put_res = await client.put(f"/api/v1/hierarchy/assets/{cyl.id}", json={
        "hydraulic_test_date": date.today().isoformat()
    })
    assert put_res.status_code == 200

    await db_session.refresh(alert)
    assert alert.status == AlertStatus.AUTO_RESOLVED


@pytest.mark.asyncio
async def test_scheduler_stale_inspection(db_session):
    """Test 13: Inspección en curso sin cerrar hace 72 horas genera INS-STALE"""
    await ensure_rules_seeded(db_session)
    now = datetime.utcnow()

    insp = Inspection(
        asset_id=1,
        template_id=1,
        status=InspectionStatus.IN_PROGRESS,
        inspector_name="Olvidadizo",
        started_at=now - timedelta(hours=72),
    )
    db_session.add(insp)
    await db_session.commit()

    await run_scheduled_checks(db_session, now=now)

    stmt = select(Alert).where(Alert.rule_code == "INS-STALE", Alert.inspection_id == insp.id)
    alert = (await db_session.execute(stmt)).scalars().first()
    assert alert is not None
    assert alert.severity == AlertSeverity.MEDIUM


@pytest.mark.asyncio
async def test_superseded_normative_alert(db_session):
    """Test 14: Plantilla que referencia una norma no vigente genera NRM-SUPERSEDED"""
    await ensure_rules_seeded(db_session)
    now = datetime.utcnow()

    old_norm = NormativeReference(
        code="ISO-OBSOLETE:2000",
        title="Norma vieja",
        issuing_body="ISO",
        current_version="2000",
        is_current=False,
    )
    db_session.add(old_norm)
    await db_session.flush()

    tmpl = ChecklistTemplate(
        title="Plantilla Desactualizada",
        asset_type=AssetType.MANIFOLD,
        is_active=True
    )
    db_session.add(tmpl)
    await db_session.flush()

    item = ChecklistItem(
        template_id=tmpl.id,
        order_index=1,
        code="OBS-01",
        title="Punto viejo",
        input_type=ItemType.BOOLEAN,
        referencia_normativa="ISO-OBSOLETE:2000"
    )
    db_session.add(item)
    await db_session.commit()

    await run_scheduled_checks(db_session, now=now)

    stmt = select(Alert).where(Alert.rule_code == "NRM-SUPERSEDED", Alert.template_id == tmpl.id)
    alert = (await db_session.execute(stmt)).scalars().first()
    assert alert is not None
    assert alert.severity == AlertSeverity.HIGH


@pytest.mark.asyncio
async def test_recurrent_failure_detection(db_session):
    """Test 15: Falla en 3 de las últimas 5 inspecciones genera AST-RECURRENT-FAIL"""
    await ensure_rules_seeded(db_session)
    now = datetime.utcnow()

    # Crear 3 inspecciones completadas con falla en item_id=1
    for i in range(3):
        insp = Inspection(
            asset_id=1,
            template_id=1,
            status=InspectionStatus.COMPLETED,
            inspector_name="Inspector",
            started_at=now - timedelta(days=i + 1),
            completed_at=now - timedelta(days=i),
        )
        db_session.add(insp)
        await db_session.flush()

        comp_res = ComplianceResult(
            inspection_id=insp.id,
            item_id=1,
            compliance_status=ComplianceStatus.NON_COMPLIANT,
            severity=ComplianceSeverity.CRITICAL,
            normative_ref="ISO 7396-1:cl.5.3",
            deviation_detail="Falla reiterada",
        )
        db_session.add(comp_res)

    await db_session.commit()

    await run_scheduled_checks(db_session, now=now)

    stmt = select(Alert).where(Alert.rule_code == "AST-RECURRENT-FAIL", Alert.asset_id == 1)
    alert = (await db_session.execute(stmt)).scalars().first()
    assert alert is not None
    assert alert.severity == AlertSeverity.HIGH


@pytest.mark.asyncio
async def test_escalation_after_timeout(db_session):
    """Test 16: Alerta no reconocida en 20 min escala a nivel 1"""
    await ensure_rules_seeded(db_session)
    past = datetime.utcnow() - timedelta(minutes=25)

    alert = Alert(
        fingerprint="test-escalation-fp",
        rule_code="CMP-CRIT-NC",
        source=AlertSource.COMPLIANCE,
        severity=AlertSeverity.CRITICAL,
        status=AlertStatus.OPEN,
        title="Alerta para escalar",
        message="No atendida",
        scope_type=AlertScopeType.INSPECTION,
        first_detected_at=past,
        last_detected_at=past,
        escalation_level=0,
        created_at=past,
        updated_at=past,
    )
    db_session.add(alert)
    await db_session.commit()

    now = datetime.utcnow()
    await run_scheduled_checks(db_session, now=now)

    await db_session.refresh(alert)
    assert alert.escalation_level == 1
    assert alert.last_escalated_at is not None


@pytest.mark.asyncio
async def test_alerts_list_filters_and_summary(client: AsyncClient, db_session):
    """Test 17: Filtros de listado y endpoint de resumen para estado de red"""
    await ensure_rules_seeded(db_session)

    # Crear alerta abierta
    await AlertEngine.raise_or_update(
        db_session,
        rule_code="CMP-CRIT-NC",
        severity=AlertSeverity.CRITICAL,
        scope_type=AlertScopeType.ASSET,
        scope_id=1,
        title="Crítica Activa",
        message="Prueba filtros",
        is_provisional=False
    )
    await db_session.commit()

    # Listar con filtro
    list_res = await client.get("/api/v1/alerts?severity=CRITICAL&status=OPEN")
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] >= 1
    assert data["items"][0]["severity"] == "CRITICAL"

    # Resumen
    summary_res = await client.get("/api/v1/alerts/summary")
    assert summary_res.status_code == 200
    s_data = summary_res.json()
    assert s_data["open_total"] >= 1
    assert s_data["health"] == "CRITICAL"


@pytest.mark.asyncio
async def test_notification_channels_crud_and_secret_hidden(client: AsyncClient, db_session):
    """Test 18: CRUD de canales, ocultamiento de secret y validaciones"""
    # 1. Crear canal webhook con secreto
    create_res = await client.post("/api/v1/notifications/channels", json={
        "name": "Webhook Notificaciones",
        "channel_type": "WEBHOOK",
        "target": "https://webhook.site/unique-test-path",
        "min_severity": "HIGH",
        "secret": "clave-secreta-hmac"
    })
    assert create_res.status_code == 201
    chan_data = create_res.json()
    chan_id = chan_data["id"]
    assert chan_data["has_secret"] is True
    assert "secret" not in chan_data

    # 2. URL inválida -> 422
    bad_res = await client.post("/api/v1/notifications/channels", json={
        "name": "Canal Roto",
        "channel_type": "WEBHOOK",
        "target": "ftp://servidor-invalido.local",
        "min_severity": "INFO"
    })
    assert bad_res.status_code == 422

    # 3. Listar canales
    list_res = await client.get("/api/v1/notifications/channels")
    assert list_res.status_code == 200
    assert any(c["id"] == chan_id for c in list_res.json())

    # 4. Eliminar canal
    del_res = await client.delete(f"/api/v1/notifications/channels/{chan_id}")
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_webhook_payload_and_signature(monkeypatch):
    """Test 19: Doble de webhook recibe payload JSON con cabecera X-GMAO-Signature válida"""
    captured_requests = []

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def post(self, url, content=None, headers=None):
            captured_requests.append({"url": url, "content": content, "headers": headers})
            class MockResponse:
                status_code = 200
                def raise_for_status(self):
                    pass
            return MockResponse()

    monkeypatch.setattr("httpx.AsyncClient", MockAsyncClient)

    now = datetime.utcnow()
    alert = Alert(
        id=42,
        fingerprint="test-fp",
        rule_code="CMP-CRIT-NC",
        source=AlertSource.COMPLIANCE,
        severity=AlertSeverity.CRITICAL,
        status=AlertStatus.OPEN,
        title="Fuga crítica",
        message="Falla severa",
        scope_type=AlertScopeType.INSPECTION,
        first_detected_at=now,
        created_at=now,
    )

    secret = "secreto-taller"
    await webhook_backend.send(alert=alert, event="RAISED", target="https://api.external.com/webhook", secret=secret)

    assert len(captured_requests) == 1
    req = captured_requests[0]
    headers = req["headers"]
    assert "X-GMAO-Signature" in headers
    sig_header = headers["X-GMAO-Signature"]

    # Validar firma HMAC
    expected_sig = hmac.new(secret.encode("utf-8"), req["content"], hashlib.sha256).hexdigest()
    assert sig_header == f"sha256={expected_sig}"


@pytest.mark.asyncio
async def test_alert_failure_does_not_break_compliance(client: AsyncClient, monkeypatch):
    """Test 20: Fallo en motor de alertas no rompe validación ni cierre de inspección"""
    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Dr. Resiliente"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [
            {"item_id": 1, "val_numeric": 4.8},
            {"item_id": 2, "val_boolean": True}
        ]
    })


    # Simular caída del alert engine
    async def broken_compliance_hook(*args, **kwargs):
        raise RuntimeError("Simulated alert engine failure")

    monkeypatch.setattr(AlertEngine, "process_compliance_summary", broken_compliance_hook)

    # /compliance debe responder 200 exitosamente
    comp_res = await client.get(f"/api/v1/inspections/{insp_id}/compliance")
    assert comp_res.status_code == 200

    # Simular caída del alert engine al completar
    async def broken_completed_hook(*args, **kwargs):
        raise RuntimeError("Simulated completion alert failure")

    monkeypatch.setattr(AlertEngine, "process_inspection_completed", broken_completed_hook)

    # Completar inspección también debe tener éxito 200
    comp_done = await client.post(f"/api/v1/inspections/{insp_id}/complete", json={
        "inspector_name": "Dr. Resiliente"
    })
    assert comp_done.status_code == 200


@pytest.mark.asyncio
async def test_sse_stream_emits_event():
    """Test 21: AlertBroker subscribe y publish emite evento a la cola correctamente"""
    queue = await alert_broker.subscribe()
    try:
        test_payload = {
            "event": "alert.raised",
            "data": {"id": 101, "title": "Prueba SSE"}
        }
        alert_broker.publish(test_payload)

        received = queue.get_nowait()
        assert received["event"] == "alert.raised"
        assert received["data"]["id"] == 101
    finally:
        await alert_broker.unsubscribe(queue)


@pytest.mark.asyncio
async def test_compliance_summary_endpoint_has_no_side_effects(client: AsyncClient, db_session):
    """Test 22: /compliance-summary es de solo lectura y no genera alertas"""
    insp_res = await client.post("/api/v1/inspections", json={
        "asset_id": 1,
        "template_id": 1,
        "inspector_name": "Dr. Solo Lectura"
    })
    insp_id = insp_res.json()["id"]

    await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json={
        "responses": [{"item_id": 1, "val_numeric": 2.0}]
    })

    count_before = (await db_session.execute(select(func.count(Alert.id)))).scalar() or 0

    # Consultar endpoint de solo lectura
    res = await client.get(f"/api/v1/inspections/{insp_id}/compliance-summary")
    assert res.status_code == 200

    count_after = (await db_session.execute(select(func.count(Alert.id)))).scalar() or 0
    assert count_before == count_after
