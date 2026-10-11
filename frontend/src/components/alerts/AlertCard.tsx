import React from 'react';
import type { Alert } from '../../services/types';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { AlertStatusBadge } from './AlertStatusBadge';
import { formatRelativeTime } from '../../utils/date';
import { cn } from '../../lib/utils';
import {
  CheckCircle,
  Clock,
  VolumeX,
  Layers,
  FileCheck2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface AlertCardProps {
  alert: Alert;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onAcknowledge?: (alert: Alert) => void;
  onResolve?: (alert: Alert) => void;
  onSilence?: (alert: Alert) => void;
  onViewDetail?: (alert: Alert) => void;
  compact?: boolean;
  className?: string;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  selected = false,
  onSelect,
  onAcknowledge,
  onResolve,
  onSilence,
  onViewDetail,
  compact = false,
  className,
}) => {
  const isCritical = alert.severity === 'CRITICAL';
  const isHigh = alert.severity === 'HIGH';
  const isOpen = alert.status === 'OPEN';
  const isAcknowledged = alert.status === 'ACKNOWLEDGED';
  const canAct = isOpen || isAcknowledged;

  if (compact) {
    return (
      <div
        onClick={() => onViewDetail?.(alert)}
        className={cn(
          'p-2.5 rounded-lg border transition-all text-left flex flex-col gap-1.5 cursor-pointer bg-[var(--surface)] hover:bg-[var(--surface-2)]',
          isCritical && 'border-[var(--danger)]/40 bg-[var(--danger-soft)]/20',
          !isCritical && 'border-[var(--border)]',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertSeverityBadge severity={alert.severity} size="sm" />
            {alert.is_provisional && (
              <span className="text-[10px] font-semibold text-[var(--ink-faint)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                Provisional
              </span>
            )}
          </div>
          <span className="text-[10px] text-[var(--ink-faint)]">
            {formatRelativeTime(alert.last_detected_at || alert.created_at)}
          </span>
        </div>

        <div className="font-semibold text-xs text-[var(--ink)] line-clamp-1">
          {alert.title}
        </div>

        {(alert.asset_tag || alert.sector_name) && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--ink-soft)]">
            {alert.asset_tag && (
              <span className="font-mono font-bold text-[var(--accent)]">{alert.asset_tag}</span>
            )}
            {alert.sector_name && <span>· {alert.sector_name}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all bg-[var(--surface)] shadow-xs flex flex-col gap-3',
        selected && 'ring-2 ring-[var(--accent)] border-transparent',
        isCritical && 'border-l-4 border-l-[var(--danger)] border-[var(--border)]',
        isHigh && !isCritical && 'border-l-4 border-l-[var(--warn)] border-[var(--border)]',
        !isCritical && !isHigh && 'border-[var(--border)]',
        className
      )}
    >
      {/* Encabezado: Severidad, Estado, Tags de contexto y Checkbox */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {onSelect && canAct && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              aria-label={`Seleccionar alerta ${alert.title}`}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer mt-0.5"
            />
          )}

          <AlertSeverityBadge severity={alert.severity} size="sm" />
          <AlertStatusBadge status={alert.status} size="sm" />

          {alert.occurrence_count > 1 && (
            <span
              className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)] flex items-center gap-1"
              title={`Detectado ${alert.occurrence_count} veces consecutivas`}
            >
              <TrendingUp className="w-3 h-3 text-[var(--warn)]" />
              <span>×{alert.occurrence_count}</span>
            </span>
          )}

          {alert.escalation_level > 0 && (
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/30">
              Escalada L{alert.escalation_level}
            </span>
          )}

          {alert.is_provisional && (
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Provisional (en curso)
            </span>
          )}
        </div>

        <span className="text-xs text-[var(--ink-faint)] whitespace-nowrap shrink-0">
          {formatRelativeTime(alert.last_detected_at || alert.created_at)}
        </span>
      </div>

      {/* Título y Mensaje */}
      <div className="flex flex-col gap-1">
        <h4 className="text-sm sm:text-base font-bold text-[var(--ink)] leading-snug m-0">
          {alert.title}
        </h4>
        <p className="text-xs sm:text-sm text-[var(--ink-soft)] leading-relaxed m-0">
          {alert.message}
        </p>
      </div>

      {/* Metadatos Técnicos: Activo, Sector, Norma, Desvío */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)] text-xs text-[var(--ink-soft)]">
        {alert.asset_tag && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)] font-mono font-bold">
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            {alert.asset_tag}
            {alert.asset_name ? ` · ${alert.asset_name}` : ''}
          </span>
        )}

        {alert.sector_name && (
          <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-soft)]">
            {alert.hospital_code ? `${alert.hospital_code} / ` : ''}
            {alert.sector_name}
          </span>
        )}

        {alert.normative_ref && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)] font-medium">
            <FileCheck2 className="w-3.5 h-3.5 text-[var(--ok)]" />
            {alert.normative_ref}
          </span>
        )}

        {(alert.expected_value || alert.actual_value) && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)] font-mono text-[11px] border border-[var(--border)]">
            <span className="text-[var(--ink-faint)]">Esp:</span>
            <span className="font-semibold">{alert.expected_value || '—'}</span>
            <span className="text-[var(--ink-faint)]">|</span>
            <span className="text-[var(--danger)] font-bold">
              Real: {alert.actual_value || '—'}
            </span>
          </div>
        )}
      </div>

      {/* Acciones de la Alerta */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          {onViewDetail && (
            <button
              type="button"
              onClick={() => onViewDetail(alert)}
              className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 cursor-pointer py-1"
            >
              <span>Ver bitácora y auditoría</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {isOpen && onAcknowledge && (
            <button
              type="button"
              onClick={() => onAcknowledge(alert)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border)] border border-[var(--border)] cursor-pointer transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-[var(--warn)]" />
              <span>Reconocer</span>
            </button>
          )}

          {canAct && onSilence && (
            <button
              type="button"
              onClick={() => onSilence(alert)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--surface-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--border)] border border-[var(--border)] cursor-pointer transition-colors"
              title="Silenciar temporalmente"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Silenciar</span>
            </button>
          )}

          {canAct && onResolve && (
            <button
              type="button"
              onClick={() => onResolve(alert)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-[var(--ok)] text-white hover:opacity-90 cursor-pointer shadow-xs transition-opacity"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Resolver</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
