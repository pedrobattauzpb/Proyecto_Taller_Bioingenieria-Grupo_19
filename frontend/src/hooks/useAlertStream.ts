import { useEffect, useRef, useState, useCallback } from 'react';
import { apiService } from '../services/api';
import type { AlertStreamEvent, AlertSummary } from '../services/types';

export type StreamConnectionStatus = 'live' | 'polling' | 'offline';

interface UseAlertStreamOptions {
  hospitalId?: number;
  enabled?: boolean;
  onEvent?: (event: AlertStreamEvent) => void;
  onSummaryPoll?: (summary: AlertSummary) => void;
}

const BACKOFF_DELAYS = [1000, 2000, 5000, 15000];
const MAX_FAILURES_BEFORE_POLLING = 3;
const POLLING_INTERVAL_MS = 30000;
const VISIBILITY_HIDDEN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

export function useAlertStream({
  hospitalId,
  enabled = true,
  onEvent,
  onSummaryPoll,
}: UseAlertStreamOptions = {}) {
  const [connection, setConnection] = useState<StreamConnectionStatus>('live');
  const eventSourceRef = useRef<EventSource | null>(null);
  const failureCountRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const hiddenTimeoutRef = useRef<number | null>(null);
  const isPausedRef = useRef<boolean>(false);

  const onEventRef = useRef(onEvent);
  const onSummaryPollRef = useRef(onSummaryPoll);
  const connectSSERef = useRef<() => void>(() => {});

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSummaryPollRef.current = onSummaryPoll;
  }, [onSummaryPoll]);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Polling fallback
  const startPolling = useCallback(() => {
    clearTimers();
    closeEventSource();
    setConnection('polling');

    const poll = async () => {
      try {
        const summary = await apiService.getAlertSummary(hospitalId);
        setConnection('polling');
        onSummaryPollRef.current?.(summary);
      } catch (err) {
        console.warn('[useAlertStream] Fallo al consultar summary en polling:', err);
        setConnection('offline');
      }
    };

    // Ejecutar inmediatamente y luego por intervalo
    poll();
    pollingIntervalRef.current = window.setInterval(poll, POLLING_INTERVAL_MS);
  }, [hospitalId, clearTimers, closeEventSource]);

  // Conexión SSE con EventSource
  const connectSSE = useCallback(() => {
    if (!enabled || isPausedRef.current) return;

    clearTimers();
    closeEventSource();

    try {
      const streamUrl = apiService.alertStreamUrl(hospitalId);
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        failureCountRef.current = 0;
        setConnection('live');
      };

      const handleCustomEvent = (eventName: AlertStreamEvent['event'], ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data);
          onEventRef.current?.({ event: eventName, data: parsed });
        } catch {
          onEventRef.current?.({ event: eventName, data: ev.data });
        }
      };

      const eventNames: AlertStreamEvent['event'][] = [
        'alert.raised',
        'alert.updated',
        'alert.resolved',
        'alert.escalated',
        'summary',
        'ping',
      ];

      eventNames.forEach((evName) => {
        es.addEventListener(evName, (e) => handleCustomEvent(evName, e as MessageEvent));
      });

      // Evento genérico por defecto
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const evType = (payload.event as AlertStreamEvent['event']) || 'alert.updated';
          onEventRef.current?.({ event: evType, data: payload.data || payload });
        } catch {
          // Keep-alive or raw string
        }
      };

      es.onerror = () => {
        closeEventSource();
        failureCountRef.current += 1;

        if (failureCountRef.current >= MAX_FAILURES_BEFORE_POLLING) {
          console.warn('[useAlertStream] SSE falló 3 veces. Activando fallback a polling.');
          startPolling();
        } else {
          setConnection('offline');
          const delayIndex = Math.min(failureCountRef.current - 1, BACKOFF_DELAYS.length - 1);
          const delay = BACKOFF_DELAYS[delayIndex];
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectSSERef.current();
          }, delay);
        }
      };
    } catch (err) {
      console.error('[useAlertStream] Error instanciando EventSource:', err);
      startPolling();
    }
  }, [enabled, hospitalId, clearTimers, closeEventSource, startPolling]);

  useEffect(() => {
    connectSSERef.current = connectSSE;
  }, [connectSSE]);

  // Control de visibilitychange
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimeoutRef.current = window.setTimeout(() => {
          isPausedRef.current = true;
          closeEventSource();
          clearTimers();
        }, VISIBILITY_HIDDEN_TIMEOUT_MS);
      } else {
        if (hiddenTimeoutRef.current) {
          window.clearTimeout(hiddenTimeoutRef.current);
          hiddenTimeoutRef.current = null;
        }
        if (isPausedRef.current) {
          isPausedRef.current = false;
          failureCountRef.current = 0;
          connectSSE();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (hiddenTimeoutRef.current) {
        window.clearTimeout(hiddenTimeoutRef.current);
      }
    };
  }, [connectSSE, closeEventSource, clearTimers]);

  // Ciclo de vida principal
  useEffect(() => {
    if (!enabled) {
      closeEventSource();
      clearTimers();
      return;
    }

    failureCountRef.current = 0;
    connectSSE();

    return () => {
      closeEventSource();
      clearTimers();
    };
  }, [enabled, hospitalId, connectSSE, closeEventSource, clearTimers]);

  const reconnect = useCallback(() => {
    failureCountRef.current = 0;
    connectSSE();
  }, [connectSSE]);

  return {
    connection,
    reconnect,
  };
}
