import asyncio
import logging
from typing import Set, Dict, Any

logger = logging.getLogger(__name__)


class AlertBroker:
    """
    Broker in-process pub/sub para Server-Sent Events (SSE) y suscripciones in-app.
    Mantiene colas asyncio por suscriptor conectado.
    """

    def __init__(self, maxsize: int = 100):
        self.maxsize = maxsize
        self._subscribers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=self.maxsize)
        async with self._lock:
            self._subscribers.add(q)
        logger.debug("Nuevo suscriptor SSE conectado. Total: %d", len(self._subscribers))
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subscribers.discard(q)
        logger.debug("Suscriptor SSE desconectado. Total restante: %d", len(self._subscribers))

    def publish(self, event_dict: Dict[str, Any]) -> None:
        """
        Publica un mensaje a todos los suscriptores activos.
        Si la cola de un suscriptor está llena, descarta el mensaje más viejo.
        """
        for q in list(self._subscribers):
            try:
                if q.full():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(event_dict)
            except Exception as e:
                logger.warning("Error al entregar mensaje a suscriptor SSE: %s", e)


alert_broker = AlertBroker()
