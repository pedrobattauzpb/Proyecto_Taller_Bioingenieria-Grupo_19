import React from 'react';
import type { AlertDetail, NotificationDelivery, AuditLogEntry } from '../../services/types';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Mail,
  Send,
  Bell,
  TrendingUp,
  User,
} from 'lucide-react';
import { formatRelativeTime } from '../../utils/date';

interface AlertTimelineProps {
  alert: AlertDetail;
}

export const AlertTimeline: React.FC<AlertTimelineProps> = ({ alert }) => {
  const deliveries: NotificationDelivery[] = alert.deliveries || [];
  const auditLogs: AuditLogEntry[] = alert.audit_trail || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Sección 1: Ciclo de vida y auditoría */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-bold text-[var(--ink-faint)] uppercase tracking-wider m-0">
          Línea de Vida y Trazabilidad
        </h5>

        <div className="relative pl-6 border-l-2 border-[var(--border)] flex flex-col gap-4 text-xs">
          {/* Detección inicial */}
          <div className="relative">
            <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[var(--danger)] text-white flex items-center justify-center">
              <AlertTriangle className="w-2.5 h-2.5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--ink)]">Detección Inicial</span>
                <span className="text-[var(--ink-faint)]">
                  {formatRelativeTime(alert.first_detected_at)}
                </span>
              </div>
              <p className="text-[var(--ink-soft)] m-0">
                Condición detectada por{' '}
                <span className="font-semibold text-[var(--ink)]">{alert.source}</span>.
                {alert.occurrence_count > 1 && (
                  <span> Confirmada {alert.occurrence_count} veces consecutivas.</span>
                )}
              </p>
            </div>
          </div>

          {/* Escalamientos */}
          {alert.last_escalated_at && (
            <div className="relative">
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[var(--danger)] text-white flex items-center justify-center">
                <TrendingUp className="w-2.5 h-2.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--danger)]">
                    Escalada a Nivel {alert.escalation_level}
                  </span>
                  <span className="text-[var(--ink-faint)]">
                    {formatRelativeTime(alert.last_escalated_at)}
                  </span>
                </div>
                <p className="text-[var(--ink-soft)] m-0">
                  Sin reconocimiento humano tras cumplirse el tiempo límite estipulado.
                </p>
              </div>
            </div>
          )}

          {/* Reconocimiento */}
          {alert.acknowledged_at && (
            <div className="relative">
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[var(--warn)] text-white flex items-center justify-center">
                <Clock className="w-2.5 h-2.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">Alerta Reconocida</span>
                  <span className="text-[var(--ink-faint)]">
                    {formatRelativeTime(alert.acknowledged_at)}
                  </span>
                </div>
                <p className="text-[var(--ink-soft)] m-0">
                  Por <span className="font-semibold">{alert.acknowledged_by || 'Operador'}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Silenciamiento */}
          {alert.silenced_until && (
            <div className="relative">
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[var(--ink-faint)] text-white flex items-center justify-center">
                <Clock className="w-2.5 h-2.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)]">Silenciada Temporalmente</span>
                  <span className="text-[var(--ink-faint)]">
                    Hasta {new Date(alert.silenced_until).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[var(--ink-soft)] m-0">
                  Las notificaciones externas están pausadas hasta la fecha fijada.
                </p>
              </div>
            </div>
          )}

          {/* Resolución */}
          {alert.resolved_at && (
            <div className="relative">
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[var(--ok)] text-white flex items-center justify-center">
                <CheckCircle className="w-2.5 h-2.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ok)]">Alerta Resuelta</span>
                  <span className="text-[var(--ink-faint)]">
                    {formatRelativeTime(alert.resolved_at)}
                  </span>
                </div>
                <p className="text-[var(--ink-soft)] m-0">
                  Cerrada por <span className="font-semibold">{alert.resolved_by || 'Sistema'}</span>.
                </p>
                {alert.resolution_note && (
                  <div className="mt-1 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] text-[var(--ink)]">
                    <span className="font-bold text-[var(--ink-soft)]">Dictamen: </span>
                    {alert.resolution_note}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logs adicionales de auditoría si existen */}
          {auditLogs.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-bold text-[var(--ink-faint)] block mb-2">
                Eventos de Auditoría Registrados ({auditLogs.length})
              </span>
              <div className="flex flex-col gap-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[11px] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-[var(--ink-faint)]" />
                      <span className="font-semibold text-[var(--ink)]">{log.actor}</span>
                      <span className="text-[var(--ink-soft)]">· {log.event_type}</span>
                    </div>
                    <span className="text-[var(--ink-faint)]">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sección 2: Despachos y Notificaciones Multicanal */}
      <div className="flex flex-col gap-3">
        <h5 className="text-xs font-bold text-[var(--ink-faint)] uppercase tracking-wider m-0">
          Entregas Multicanal ({deliveries.length})
        </h5>

        {deliveries.length === 0 ? (
          <p className="text-xs text-[var(--ink-faint)] italic m-0">
            No se han registrado despachos externos para esta alerta (o permaneció como provisional).
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {deliveries.map((del) => {
              const isSent = del.status === 'SENT';
              const isFailed = del.status === 'FAILED';

              const ChannelIcon =
                del.channel_type === 'EMAIL'
                  ? Mail
                  : del.channel_type === 'WEBHOOK'
                  ? Send
                  : Bell;

              return (
                <div
                  key={del.id}
                  className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ChannelIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="font-bold text-[var(--ink)]">{del.channel_type}</span>
                      <span className="text-[11px] text-[var(--ink-soft)] font-mono">
                        ({del.event})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSent
                            ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                            : isFailed
                            ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                            : 'bg-[var(--surface)] text-[var(--ink-faint)]'
                        }`}
                      >
                        {del.status}
                      </span>
                      <span className="text-[10px] text-[var(--ink-faint)]">
                        {formatRelativeTime(del.sent_at || del.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--ink-soft)] font-mono truncate">
                    Destino: {del.target}
                  </div>

                  {del.error && (
                    <div className="text-[10.5px] text-[var(--danger)] bg-[var(--danger-soft)]/50 p-1 rounded font-mono">
                      Error: {del.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
