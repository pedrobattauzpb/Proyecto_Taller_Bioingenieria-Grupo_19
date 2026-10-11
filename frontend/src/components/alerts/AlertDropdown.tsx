import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAlerts } from '../../context/AlertsContext';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { formatRelativeTime } from '../../utils/date';
import { Bell, CheckCheck, ExternalLink, ShieldCheck } from 'lucide-react';
import type { Alert } from '../../services/types';

interface AlertDropdownProps {
  open: boolean;
  onClose: () => void;
  onSelectAlert?: (alert: Alert) => void;
}

export const AlertDropdown: React.FC<AlertDropdownProps> = ({
  open,
  onClose,
  onSelectAlert,
}) => {
  const { recentAlerts, markSeen, unreadCount } = useAlerts();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera o presionar Escape
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const displayAlerts = recentAlerts.slice(0, 8);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col text-[var(--ink)] animate-in fade-in slide-in-from-top-2 duration-150"
      role="region"
      aria-label="Panel de alertas recientes"
    >
      {/* Cabecera del Dropdown */}
      <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--accent)]" />
          <span className="font-bold text-xs text-[var(--ink)]">Alertas y Notificaciones</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--danger)] text-white">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markSeen}
            className="text-[11px] font-semibold text-[var(--ink-soft)] hover:text-[var(--accent)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Marcar todas como leídas"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Marcar leídas</span>
          </button>
        )}
      </div>

      {/* Lista de Alertas */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border)]">
        {displayAlerts.length === 0 ? (
          <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
            <ShieldCheck className="w-8 h-8 text-[var(--ok)]" />
            <p className="text-xs font-semibold text-[var(--ink)] m-0">
              Red hospitalaria en conformidad
            </p>
            <p className="text-[11px] text-[var(--ink-soft)] m-0">
              No existen alertas registradas recientemente.
            </p>
          </div>
        ) : (
          displayAlerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            return (
              <div
                key={alert.id}
                onClick={() => {
                  onSelectAlert?.(alert);
                  onClose();
                }}
                className={`p-3 transition-colors cursor-pointer flex flex-col gap-1.5 hover:bg-[var(--surface-2)] ${
                  isCritical ? 'bg-[var(--danger-soft)]/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertSeverityBadge severity={alert.severity} size="sm" />
                    {alert.is_provisional && (
                      <span className="text-[9.5px] font-semibold text-[var(--ink-faint)] bg-[var(--surface-2)] px-1 rounded border border-[var(--border)]">
                        Provisional
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--ink-faint)]">
                    {formatRelativeTime(alert.last_detected_at || alert.created_at)}
                  </span>
                </div>

                <p className="text-xs font-bold text-[var(--ink)] line-clamp-1 m-0">
                  {alert.title}
                </p>

                <div className="flex items-center justify-between text-[11px] text-[var(--ink-soft)]">
                  <span>
                    {alert.asset_tag && (
                      <strong className="font-mono text-[var(--accent)]">{alert.asset_tag}</strong>
                    )}
                    {alert.sector_name ? ` · ${alert.sector_name}` : ''}
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--ink-faint)]">
                    {alert.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pie con enlace directo a /alerts */}
      <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center">
        <Link
          to="/alerts"
          onClick={onClose}
          className="text-xs font-bold text-[var(--accent)] hover:text-[var(--accent-strong)] flex items-center gap-1.5 no-underline cursor-pointer"
        >
          <span>Ir al Centro de Alertas Completo</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
