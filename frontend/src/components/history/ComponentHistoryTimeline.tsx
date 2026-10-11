import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Calendar,
  User,
  Image as ImageIcon,
  RotateCw,
  ShieldAlert,
} from 'lucide-react';
import { apiService } from '../../services/api';
import type { InspectionHistoryItem, Alert } from '../../services/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EvidenceThumbnail } from '../checklist/EvidenceThumbnail';
import { AlertSeverityBadge } from '../alerts/AlertSeverityBadge';

interface ComponentHistoryTimelineProps {
  assetId: number;
  assetName?: string;
  assetTag?: string;
  onSelectInspection?: (inspectionId: number) => void;
}

export const ComponentHistoryTimeline: React.FC<ComponentHistoryTimelineProps> = ({
  assetId,
  assetName,
  assetTag,
  onSelectInspection,
}) => {
  const [history, setHistory] = useState<InspectionHistoryItem[]>([]);
  const [assetAlerts, setAssetAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assetId > 0) {
      loadHistory();
    }
  }, [assetId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const [histData, alertsData] = await Promise.allSettled([
        apiService.getAssetHistory(assetId),
        apiService.getAlerts({ asset_id: assetId, status: 'OPEN,ACKNOWLEDGED', limit: 20 }),
      ]);

      if (histData.status === 'fulfilled') {
        setHistory(histData.value);
      } else {
        throw histData.reason;
      }

      if (alertsData.status === 'fulfilled') {
        setAssetAlerts(alertsData.value.items);
      }
    } catch (err: any) {
      console.error('Error cargando historial de activo:', err);
      setError('No se pudo cargar el historial del activo.');
    } finally {
      setLoading(false);
    }
  };

  const handleEvidenceDeleted = async (evidenceId: number) => {
    await apiService.deleteEvidence(evidenceId);
    await loadHistory();
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[var(--ink-soft)]">Cargando historial técnico del componente...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center flex flex-col items-center justify-center gap-2 border-[var(--warn)] bg-[var(--warn-soft)]">
        <AlertTriangle className="w-8 h-8 text-[var(--warn)]" />
        <p className="text-sm font-semibold text-[var(--ink)]">{error}</p>
        <Button title="Reintentar" variant="outline" size="sm" onClick={loadHistory} />
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-[var(--surface)] border border-[var(--border)]">
        <FileCheck2 className="w-10 h-10 text-[var(--ink-faint)]" />
        <h3 className="text-base font-bold text-[var(--ink)]">Sin historial de inspecciones</h3>
        <p className="text-xs sm:text-sm text-[var(--ink-soft)] max-w-sm">
          Este activo aún no tiene listas de verificación registradas en el sistema centralizado.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header del Historial */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">
            Historial de Inspecciones {assetTag ? `(${assetTag})` : ''}
          </h3>
          <p className="text-xs text-[var(--ink-soft)]">
            {assetName || 'Activo Clínico'} • {history.length}{' '}
            {history.length === 1 ? 'inspección registrada' : 'inspecciones registradas'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          className="p-2 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-lg transition-colors cursor-pointer"
          title="Refrescar historial"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alertas vigentes del activo (OE-5) */}
      {assetAlerts.length > 0 && (
        <div className="p-3.5 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)]/20 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--danger)]">
            <ShieldAlert className="w-4 h-4" />
            <span>Alertas y Desvíos Vigentes del Activo ({assetAlerts.length})</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {assetAlerts.map((alt) => (
              <div
                key={alt.id}
                className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertSeverityBadge severity={alt.severity} size="sm" />
                  <span className="font-bold text-[var(--ink)]">{alt.title}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--accent)] font-semibold">
                  {alt.rule_code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Línea de Tiempo */}
      <div className="flex flex-col gap-6 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--border)]">
        {history.map((item) => {
          const isCompleted = item.status === 'COMPLETED';
          const hasDeviations = item.non_compliant_count > 0;

          return (
            <div key={item.id} className="flex gap-4 relative">
              {/* Nodo indicador */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-white shadow-xs ${
                  isCompleted
                    ? hasDeviations
                      ? 'bg-[var(--warn)]'
                      : 'bg-[var(--ok)]'
                    : 'bg-[var(--accent)]'
                }`}
              >
                {isCompleted ? (
                  hasDeviations ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Tarjeta de Inspección */}
              <div className="flex-1">
                <Card className="flex flex-col gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge label={`#${item.id}`} variant="slate" size="sm" />
                      <span className="text-sm font-bold text-[var(--ink)]">{item.template_title}</span>
                    </div>

                    <Badge
                      label={
                        item.status === 'COMPLETED'
                          ? 'Cerrada'
                          : item.status === 'IN_PROGRESS'
                          ? 'En Curso'
                          : 'Borrador'
                      }
                      variant={
                        item.status === 'COMPLETED'
                          ? 'emerald'
                          : item.status === 'IN_PROGRESS'
                          ? 'amber'
                          : 'slate'
                      }
                      size="sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-soft)]">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[var(--ink-faint)]" />
                      <span>{new Date(item.started_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-[var(--ink-faint)]" />
                      <span>{item.inspector_name}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasDeviations ? (
                      <>
                        <Badge
                          label={`${item.non_compliant_count} desvío(s) detectado(s)`}
                          variant="rose"
                          size="sm"
                        />
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[var(--danger)] bg-[var(--danger-soft)] px-2 py-0.5 rounded border border-[var(--danger)]/30">
                            <AlertTriangle className="w-3 h-3" />
                            Dictamen No Conforme (INS-CLOSED-NC)
                          </span>
                        )}
                      </>
                    ) : isCompleted ? (
                      <Badge label="Cumple Norma 100%" variant="emerald" size="sm" />
                    ) : (
                      <Badge
                        label={`${item.evaluated_items}/${item.total_items} evaluados`}
                        variant="blue"
                        size="sm"
                      />
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-[var(--ink-soft)] bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border)] italic">
                      «{item.notes}»
                    </p>
                  )}

                  {item.evidences && item.evidences.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] font-semibold">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>
                          {item.evidences.length}{' '}
                          {item.evidences.length === 1 ? 'evidencia adjunta' : 'evidencias adjuntas'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.evidences.map((ev) => (
                          <EvidenceThumbnail
                            key={ev.id}
                            evidence={ev}
                            onDelete={handleEvidenceDeleted}
                            disabled={isCompleted}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {onSelectInspection && (
                    <div className="flex justify-end pt-2">
                      <Button
                        title="Ver Detalle de Inspección"
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectInspection(item.id)}
                      />
                    </div>
                  )}
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
