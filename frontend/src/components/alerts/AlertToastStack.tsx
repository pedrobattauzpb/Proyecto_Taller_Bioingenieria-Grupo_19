import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../../context/AlertsContext';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import type { Alert } from '../../services/types';

export const AlertToastStack: React.FC = () => {
  const navigate = useNavigate();
  const { toastAlerts, dismissToast } = useAlerts();

  // Control de auto-cierre para no críticas y vibración/sonido para críticas
  useEffect(() => {
    toastAlerts.forEach((alert) => {
      if (alert.severity !== 'CRITICAL') {
        const timer = setTimeout(() => {
          dismissToast(alert.id);
        }, 6000);
        return () => clearTimeout(timer);
      } else {
        // Vibración háptica en móviles si está disponible
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {
            // Ignore if restricted by browser permissions
          }
        }
      }
    });
  }, [toastAlerts, dismissToast]);

  if (toastAlerts.length === 0) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none flex flex-col gap-2 p-4 bottom-4 right-4 sm:bottom-6 sm:right-6 max-w-sm w-full"
      role="status"
      aria-live="assertive"
    >
      {toastAlerts.map((alert: Alert) => {
        const isCritical = alert.severity === 'CRITICAL';

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-200 flex flex-col gap-2 ${
              isCritical
                ? 'bg-[var(--surface)] border-[var(--danger)]/50 ring-2 ring-[var(--danger)]/30'
                : 'bg-[var(--surface)] border-[var(--border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertSeverityBadge severity={alert.severity} size="sm" />
                {isCritical && (
                  <span className="text-[10px] font-extrabold uppercase text-[var(--danger)] animate-pulse flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Atención Inmediata
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(alert.id)}
                className="p-1 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-0.5">
              <h5 className="text-xs font-bold text-[var(--ink)] m-0 leading-tight">
                {alert.title}
              </h5>
              <p className="text-[11.5px] text-[var(--ink-soft)] line-clamp-2 m-0 leading-relaxed">
                {alert.message}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[11px]">
              <span className="font-mono text-[var(--accent)] font-semibold">
                {alert.asset_tag || alert.rule_code}
              </span>

              <button
                type="button"
                onClick={() => {
                  dismissToast(alert.id);
                  navigate(`/alerts?id=${alert.id}`);
                }}
                className="font-bold text-[var(--accent)] hover:text-[var(--accent-strong)] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Inspeccionar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
