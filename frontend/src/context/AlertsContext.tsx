import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { apiService } from '../services/api';
import { useAlertStream, type StreamConnectionStatus } from '../hooks/useAlertStream';
import type { Alert, AlertSummary, AlertStreamEvent } from '../services/types';

interface AlertsContextValue {
  summary: AlertSummary | null;
  recentAlerts: Alert[];
  unreadCount: number;
  connection: StreamConnectionStatus;
  toastAlerts: Alert[];
  dismissToast: (alertId: number) => void;
  markSeen: () => void;
  refresh: () => Promise<void>;
  onAlertEvent: (callback: (event: AlertStreamEvent) => void) => () => void;
}

const AlertsContext = createContext<AlertsContextValue | undefined>(undefined);

const LAST_SEEN_KEY = 'gmao.alerts.lastSeenAt';

export const AlertsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toastAlerts, setToastAlerts] = useState<Alert[]>([]);

  const listenersRef = useRef<Set<(event: AlertStreamEvent) => void>>(new Set());

  // Calcular unreadCount en base a recentAlerts y lastSeenAt
  const updateUnreadCount = useCallback((alerts: Alert[], currentSummary: AlertSummary | null) => {
    const lastSeenStr = localStorage.getItem(LAST_SEEN_KEY);
    if (!lastSeenStr) {
      setUnreadCount(currentSummary?.open_total ?? alerts.filter((a) => a.status === 'OPEN').length);
      return;
    }

    const lastSeenTime = new Date(lastSeenStr).getTime();
    const count = alerts.filter((a) => {
      const alertTime = new Date(a.last_detected_at || a.created_at).getTime();
      return alertTime > lastSeenTime && (a.status === 'OPEN' || a.status === 'ACKNOWLEDGED');
    }).length;

    setUnreadCount(count);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [sumRes, alertsRes] = await Promise.allSettled([
        apiService.getAlertSummary(undefined, true),
        apiService.getAlerts({ limit: 20, sort: '-last_detected_at' }),
      ]);

      let newSummary: AlertSummary | null = null;
      let newAlerts: Alert[] = [];

      if (sumRes.status === 'fulfilled') {
        newSummary = sumRes.value;
        setSummary(newSummary);
      }
      if (alertsRes.status === 'fulfilled') {
        newAlerts = alertsRes.value.items;
        setRecentAlerts(newAlerts);
      }

      updateUnreadCount(newAlerts, newSummary);
    } catch (err) {
      console.warn('[AlertsContext] Error al refrescar alertas:', err);
    }
  }, [updateUnreadCount]);

  // Manejador central de eventos entrantes de SSE
  const handleStreamEvent = useCallback(
    (ev: AlertStreamEvent) => {
      // Notificar a los observadores registrados
      listenersRef.current.forEach((cb) => {
        try {
          cb(ev);
        } catch (e) {
          console.error('[AlertsContext] Error en listener de alerta:', e);
        }
      });

      if (ev.event === 'summary') {
        const sum = ev.data as AlertSummary;
        setSummary(sum);
        return;
      }

      if (
        ev.event === 'alert.raised' ||
        ev.event === 'alert.updated' ||
        ev.event === 'alert.resolved' ||
        ev.event === 'alert.escalated'
      ) {
        const incomingAlert = ev.data as Alert;
        if (!incomingAlert?.id) return;

        // Actualizar lista en memoria (últimas 20)
        setRecentAlerts((prev) => {
          const filtered = prev.filter((a) => a.id !== incomingAlert.id);
          const updated = [incomingAlert, ...filtered].slice(0, 20);
          return updated;
        });

        // Toasts reactivos: solo para nuevas alertas o escaladas
        if (ev.event === 'alert.raised' || ev.event === 'alert.escalated') {
          setToastAlerts((prev) => {
            const without = prev.filter((t) => t.id !== incomingAlert.id);
            // Máximo 3 visibles simultáneamente
            return [incomingAlert, ...without].slice(0, 3);
          });
        }

        // Si se resolvió, quitar de los toasts si estuviera
        if (ev.event === 'alert.resolved') {
          setToastAlerts((prev) => prev.filter((t) => t.id !== incomingAlert.id));
        }

        // Refrescar resumen para sincronizar contadores
        apiService
          .getAlertSummary(undefined, false)
          .then((newSummary) => {
            setSummary(newSummary);
            setRecentAlerts((currentAlerts) => {
              updateUnreadCount(currentAlerts, newSummary);
              return currentAlerts;
            });
          })
          .catch(() => {});
      }
    },
    [updateUnreadCount]
  );

  const { connection } = useAlertStream({
    enabled: true,
    onEvent: handleStreamEvent,
    onSummaryPoll: (polledSummary) => {
      setSummary(polledSummary);
      setRecentAlerts((currentAlerts) => {
        updateUnreadCount(currentAlerts, polledSummary);
        return currentAlerts;
      });
    },
  });

  const markSeen = useCallback(() => {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback((alertId: number) => {
    setToastAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const onAlertEvent = useCallback((callback: (event: AlertStreamEvent) => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  // Carga inicial al montar
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AlertsContext.Provider
      value={{
        summary,
        recentAlerts,
        unreadCount,
        connection,
        toastAlerts,
        dismissToast,
        markSeen,
        refresh,
        onAlertEvent,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
};

export function useAlerts(): AlertsContextValue {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts debe utilizarse dentro de un AlertsProvider');
  }
  return context;
}
