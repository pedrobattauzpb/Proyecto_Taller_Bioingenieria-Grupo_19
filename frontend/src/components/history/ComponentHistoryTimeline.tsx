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
} from 'lucide-react';
import { apiService } from '../../services/api';
import type { InspectionHistoryItem } from '../../services/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EvidenceThumbnail } from '../checklist/EvidenceThumbnail';

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
      const data = await apiService.getAssetHistory(assetId);
      setHistory(data);
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
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Cargando historial técnico del componente...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center flex flex-col items-center justify-center gap-2 border-rose-200 bg-rose-50/50">
        <AlertTriangle className="w-8 h-8 text-rose-600" />
        <p className="text-sm font-semibold text-rose-800">{error}</p>
        <Button title="Reintentar" variant="outline" size="sm" onClick={loadHistory} />
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center gap-2">
        <FileCheck2 className="w-10 h-10 text-slate-400" />
        <h3 className="text-base font-bold text-slate-800">Sin historial de inspecciones</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
          Este activo aún no tiene listas de verificación registradas en el sistema centralizado.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header del Historial */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Historial de Inspecciones {assetTag ? `(${assetTag})` : ''}
          </h3>
          <p className="text-xs text-slate-500">
            {assetName || 'Activo Clínico'} • {history.length}{' '}
            {history.length === 1 ? 'inspección registrada' : 'inspecciones registradas'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Refrescar historial"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Línea de Tiempo */}
      <div className="flex flex-col gap-6 relative before:absolute before:left-3.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
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
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                    : 'bg-blue-600'
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
                <Card className="flex flex-col gap-3 p-4 hover:border-slate-300 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge label={`#${item.id}`} variant="slate" size="sm" />
                      <span className="text-sm font-bold text-slate-900">{item.template_title}</span>
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

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(item.started_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.inspector_name}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasDeviations ? (
                      <Badge
                        label={`${item.non_compliant_count} desvío(s) detectado(s)`}
                        variant="rose"
                        size="sm"
                      />
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
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                      «{item.notes}»
                    </p>
                  )}

                  {item.evidences && item.evidences.length > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
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
