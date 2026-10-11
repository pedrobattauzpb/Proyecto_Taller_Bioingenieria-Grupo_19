from typing import Protocol, Optional
from app.models.notification import Alert


class NotificationChannelBackend(Protocol):
    async def send(self, alert: Alert, event: str, target: str, secret: Optional[str] = None) -> None:
        """Envía la notificación por el canal correspondiente."""
        ...
