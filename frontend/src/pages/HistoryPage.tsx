import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  FileCheck2,
  Calendar,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import { apiService } from '../services/api';
import type {
  InspectionDetail,
  InspectionStatus,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [inspections, setInspections] = useState<InspectionDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | InspectionStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadInspections();
  }, [statusFilter]);

  const loadInspections = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listInspections({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 100,
      });
      setInspections(data);
    } catch (err: any) {
      console.error('Error cargando historial:', err);
      setError('No se pudo cargar el historial de auditoría.');
    } finally {
      setLoading(false);
    }
  };

  const filteredInspections = inspections.filter((insp) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const assetName = (insp.asset?.name || '').toLowerCase();
    const assetTag = (insp.asset?.tag_code || '').toLowerCase();
    const templateTitle = (insp.template?.title || '').toLowerCase();
    const inspector = (insp.inspector_name || '').toLowerCase();
    const notes = (insp.notes || '').toLowerCase();

    return (
      assetName.includes(term) ||
      assetTag.includes(term) ||
      templateTitle.includes(term) ||
      inspector.includes(term) ||
      notes.includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight m-0">
            Registro de Inspecciones
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mt-0.5">
            Registro y trazabilidad técnica de auditorías bajo ISO 7396-1 y Res. MSAL 1130/2000
          </p>
        </div>
        <Button
          title="Actualizar"
          variant="outline"
          size="sm"
          onClick={loadInspections}
          loading={loading}
          icon={<RotateCw className="w-3.5 h-3.5" />}
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold m-0">{error}</p>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-md relative">
          <Input
            placeholder="Buscar por activo, tag, plantilla o inspector..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="my-0"
          />
        </div>

        {/* Filtros por estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer',
              statusFilter === 'ALL'
                ? 'bg-[var(--accent)] text-white border-transparent'
                : 'bg-[var(--surface)] text-[var(--ink-soft)] border-[var(--border)] hover:bg-[var(--surface-2)]'
            )}
          >
            Todos ({inspections.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer',
              statusFilter === 'COMPLETED'
                ? 'bg-[var(--ok)] text-white border-transparent'
                : 'bg-[var(--surface)] text-[var(--ink-soft)] border-[var(--border)] hover:bg-[var(--surface-2)]'
            )}
          >
            Cerradas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer',
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-500 text-white border-transparent'
                : 'bg-[var(--surface)] text-[var(--ink-soft)] border-[var(--border)] hover:bg-[var(--surface-2)]'
            )}
          >
            En Curso
          </button>
        </div>
      </div>

      {/* Lista de Inspecciones */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--ink-soft)]">
            Cargando registros de auditoría...
          </p>
        </div>
      ) : filteredInspections.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-2">
          <FileCheck2 className="w-10 h-10 text-[var(--ink-faint)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">No se encontraron inspecciones</h3>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] max-w-sm">
            Intente ajustar los términos de búsqueda o el filtro de estado seleccionado.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredInspections.map((insp) => {
            const isCompleted = insp.status === 'COMPLETED';
            const evaluatedCount = insp.completed_items ?? insp.responses?.length ?? 0;
            const totalCount = insp.total_items ?? insp.template?.items?.length ?? 0;

            return (
              <div
                key={insp.id}
                onClick={() => navigate(`/inspections/${insp.id}`)}
                className="p-4 bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-[var(--shadow)]"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
                      #{insp.id}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                      {insp.asset?.tag_code || 'TAG'}
                    </span>
                    <span
                      className={`text-[10.5px] font-bold py-0.5 px-2 rounded-full ${
                        isCompleted
                          ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                          : 'bg-[var(--warn-soft)] text-[var(--warn)]'
                      }`}
                    >
                      {isCompleted
                        ? 'Cerrada y Sellada'
                        : insp.status === 'IN_PROGRESS'
                        ? 'En Curso'
                        : 'Borrador'}
                    </span>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-[var(--ink)] m-0">
                    {insp.asset?.name || 'Activo Clínico'}
                  </h4>
                  <p className="text-xs text-[var(--ink-soft)] m-0">
                    {insp.template?.title || 'Checklist de Inspección'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-[var(--ink-soft)] pt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[var(--ink-faint)]" />
                      <span>{new Date(insp.started_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      Auditor: <span className="font-semibold text-[var(--ink)]">{insp.inspector_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
                  <div className="text-xs font-bold text-[var(--ink-soft)]">
                    {evaluatedCount} / {totalCount} evaluados ({insp.progress_percentage || 0}%)
                  </div>
                  <Button
                    title="Abrir Auditoría"
                    size="sm"
                    variant="outline"
                    icon={<ChevronRight className="w-3.5 h-3.5" />}
                    iconPosition="right"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/inspections/${insp.id}`);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
