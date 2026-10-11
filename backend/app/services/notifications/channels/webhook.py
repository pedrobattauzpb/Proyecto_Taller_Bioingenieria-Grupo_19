import json
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx

from app.core.config import settings
from app.models.notification import Alert

logger = logging.getLogger(__name__)


class WebhookChannelBackend:
    async def send(self, alert: Alert, event: str, target: str, secret: Optional[str] = None) -> None:
        payload = {
            "event": event,
            "alert": {
                "id": alert.id,
                "rule_code": alert.rule_code,
                "severity": alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity),
                "status": alert.status.value if hasattr(alert.status, "value") else str(alert.status),
                "title": alert.title,
                "message": alert.message,
                "normative_ref": alert.normative_ref,
                "asset": {
                    "id": alert.asset_id,
                    "tag_code": getattr(alert.asset, "tag_code", None) if alert.asset else None,
                    "name": getattr(alert.asset, "name", None) if alert.asset else None,
                } if alert.asset_id else None,
                "sector": {
                    "id": alert.sector_id,
                    "name": getattr(alert.sector, "name", None) if alert.sector else None,
                } if alert.sector_id else None,
                "hospital": {
                    "id": alert.hospital_id,
                    "code": getattr(alert.hospital, "code", None) if alert.hospital else None,
                } if alert.hospital_id else None,
                "inspection_id": alert.inspection_id,
                "expected_value": alert.expected_value,
                "actual_value": alert.actual_value,
                "first_detected_at": alert.first_detected_at.isoformat() if alert.first_detected_at else None,
                "occurrence_count": alert.occurrence_count,
                "url": f"{settings.FRONTEND_BASE_URL}/alerts?id={alert.id}",
            },
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

        payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-GMAO-Event": event,
        }

        if secret:
            signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
            headers["X-GMAO-Signature"] = f"sha256={signature}"

        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.post(target, content=payload_bytes, headers=headers)
            response.raise_for_status()

        logger.info("Webhook entregado exitosamente a %s", target)


webhook_backend = WebhookChannelBackend()
