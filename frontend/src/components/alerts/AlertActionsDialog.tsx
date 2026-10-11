import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle, CheckCircle, Clock, VolumeX } from 'lucide-react';
import type { Alert } from '../../services/types';
import { AlertSeverityBadge } from './AlertSeverityBadge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export type AlertActionType = 'acknowledge' | 'resolve' | 'silence';

interface AlertActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: Alert | null;
  actionType: AlertActionType;
  onConfirm: (payload: {
    alertId: number;
    action: AlertActionType;
    actor: string;
    note?: string;
    until?: string;
  }) => Promise<void>;
}

export const AlertActionsDialog: React.FC<AlertActionsDialogProps> = ({
  open,
  onOpenChange,
  alert,
  actionType,
  onConfirm,
}) => {
  const [actor, setActor] = useState<string>('Bioing. Santiago');
  const [note, setNote] = useState<string>('');
  const [silenceHours, setSilenceHours] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem('gmao.inspectorName');
      if (stored) {
        setActor(stored);
      }
      setNote('');
      setError(null);
      setSilenceHours(4);
    }
  }, [open]);

  if (!alert) return null;

  const isCritical = alert.severity === 'CRITICAL';
  const isCannotSilence =
    actionType === 'silence' &&
    (alert.rule_code === 'CYL-HYDRO-EXPIRED' ||
      alert.rule_code === 'INS-CLOSED-NC' ||
      (isCritical && alert.source === 'NORMATIVE'));

  const handleExecute = async () => {
    if (!actor.trim()) {
      setError('El nombre del profesional u operador es obligatorio.');
      return;
    }

    if (actionType === 'resolve' && isCritical && !note.trim()) {
      setError(
        'Para desvíos con severidad CRÍTICA es obligatorio detallar la nota de resolución técnica antes de cerrar.'
      );
      return;
    }

    if (isCannotSilence) {
      setError('Esta alerta no admite silenciamiento por requisitos de seguridad del paciente.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let untilIso: string | undefined;
      if (actionType === 'silence') {
        const untilDate = new Date(Date.now() + silenceHours * 3600 * 1000);
        untilIso = untilDate.toISOString();
      }

      // Guardar el operador en localStorage
      localStorage.setItem('gmao.inspectorName', actor.trim());

      await onConfirm({
        alertId: alert.id,
        action: actionType,
        actor: actor.trim(),
        note: note.trim() || undefined,
        until: untilIso,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('Error al procesar acción de alerta:', err);
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Ocurrió un error al procesar la acción sobre la alerta.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AlertActionType, { title: string; icon: React.ReactNode; btnText: string }> =
    {
      acknowledge: {
        title: 'Reconocer Alerta',
        icon: <Clock className="w-5 h-5 text-[var(--warn)]" />,
        btnText: 'Confirmar Reconocimiento',
      },
      resolve: {
        title: 'Resolver y Normalizar Alerta',
        icon: <CheckCircle className="w-5 h-5 text-[var(--ok)]" />,
        btnText: 'Resolver Alerta',
      },
      silence: {
        title: 'Silenciar Notificaciones',
        icon: <VolumeX className="w-5 h-5 text-[var(--ink-soft)]" />,
        btnText: 'Aplicar Silencio',
      },
    };

  const currentMeta = titles[actionType];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              {currentMeta.icon}
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                {currentMeta.title}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Resumen de la Alerta */}
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[var(--accent)]">
                {alert.rule_code}
              </span>
              <AlertSeverityBadge severity={alert.severity} size="sm" />
            </div>
            <p className="text-xs font-bold text-[var(--ink)] m-0">{alert.title}</p>
            {alert.normative_ref && (
              <p className="text-[11px] text-[var(--ink-soft)] m-0">
                Norma: <span className="font-semibold">{alert.normative_ref}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-xl flex items-start gap-2 text-xs text-[var(--danger)]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isCannotSilence && (
            <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-xl text-xs text-[var(--danger)] leading-relaxed">
              <strong>Restricción Normativa:</strong> Las alertas asociadas a pruebas hidráulicas
              vencidas o desvíos críticos consolidados no pueden silenciarse por requerimiento legal
              (Res. MSAL 1130 / IRAM 2529).
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Input
              label="Profesional / Operador que actúa"
              value={actor}
              onChangeText={setActor}
              placeholder="Ej: Bioing. Juan Pérez"
            />

            {actionType === 'silence' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[var(--ink)]">
                  Duración del Silenciamiento
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 4, 24, 72].map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setSilenceHours(hours)}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                        silenceHours === hours
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                          : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)] hover:bg-[var(--border)]'
                      }`}
                    >
                      {hours} h
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[var(--ink-faint)]">
                  Vence en {silenceHours} horas. Si la condición persiste tras expirar, volverá a
                  notificarse.
                </span>
              </div>
            )}

            <Input
              label={
                actionType === 'resolve' && isCritical
                  ? 'Nota Técnica de Corrección / Mitigación (Obligatoria)'
                  : 'Observaciones / Justificación (Opcional)'
              }
              value={note}
              onChangeText={setNote}
              placeholder={
                actionType === 'resolve'
                  ? 'Describa el recambio de pieza, reajuste de regulador o acción correctiva efectuada...'
                  : 'Comentarios adicionales para la bitácora...'
              }
              multiline
              numberOfLines={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)] mt-1">
            <Button
              title="Cancelar"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            />
            <Button
              title={currentMeta.btnText}
              variant={actionType === 'resolve' ? 'success' : 'primary'}
              onClick={handleExecute}
              loading={loading}
              disabled={isCannotSilence || loading}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
