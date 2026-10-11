from typing import Optional
from app.models.notification import Alert
from app.services.notifications.broker import alert_broker


class InAppChannelBackend:
    async def send(self, alert: Alert, event: str, target: str, secret: Optional[str] = None) -> None:
        event_name = f"alert.{event.lower()}" if not event.startswith("alert.") else event
        payload = {
            "event": event_name,
            "data": {
                "id": alert.id,
                "fingerprint": alert.fingerprint,
                "rule_code": alert.rule_code,
                "severity": alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity),
                "status": alert.status.value if hasattr(alert.status, "value") else str(alert.status),
                "title": alert.title,
                "message": alert.message,
                "normative_ref": alert.normative_ref,
                "hospital_id": alert.hospital_id,
                "sector_id": alert.sector_id,
                "asset_id": alert.asset_id,
                "inspection_id": alert.inspection_id,
                "item_id": alert.item_id,
                "expected_value": alert.expected_value,
                "actual_value": alert.actual_value,
                "is_provisional": alert.is_provisional,
                "occurrence_count": alert.occurrence_count,
                "escalation_level": alert.escalation_level,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
                "last_detected_at": alert.last_detected_at.isoformat() if alert.last_detected_at else None,
            }
        }
        alert_broker.publish(payload)


in_app_backend = InAppChannelBackend()
