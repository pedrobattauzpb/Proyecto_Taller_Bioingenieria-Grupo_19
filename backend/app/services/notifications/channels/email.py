import logging
from typing import Optional
from email.message import EmailMessage
import aiosmtplib

from app.core.config import settings
from app.models.notification import Alert
from app.services.notifications.templates import render_email_subject, render_email_content

logger = logging.getLogger(__name__)


class EmailChannelBackend:
    async def send(self, alert: Alert, event: str, target: str, secret: Optional[str] = None) -> None:
        if not settings.SMTP_HOST:
            raise ValueError("SMTP no configurado")

        subject = render_email_subject(alert, event=event)
        plain_text, html_body = render_email_content(alert, event=event)

        message = EmailMessage()
        message["From"] = settings.SMTP_FROM
        message["To"] = target
        message["Subject"] = subject
        message.set_content(plain_text)
        message.add_alternative(html_body, subtype="html")

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER if settings.SMTP_USER else None,
            password=settings.SMTP_PASSWORD if settings.SMTP_PASSWORD else None,
            use_tls=settings.SMTP_USE_TLS,
            timeout=10,
        )
        logger.info("Email de alerta enviado exitosamente a %s", target)


email_backend = EmailChannelBackend()
