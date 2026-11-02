import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCw,
  Search,
  CheckCircle,
  Clock,
  Play,
  X,
  VolumeX,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiService } from '../services/api';
import { useAlerts } from '../context/AlertsContext';
import { usePermission } from '../hooks/usePermission';
import { AlertCard } from '../components/alerts/AlertCard';
import {
  AlertActionsDialog,
  type AlertActionType,
} from '../components/alerts/AlertActionsDialog';
import { AlertTimeline } from '../components/alerts/AlertTimeline';
import { AlertSeverityBadge } from '../components/alerts/AlertSeverityBadge';
import { AlertStatusBadge } from '../components/alerts/AlertStatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type {
  Alert,
  AlertDetail,
  AlertSeverity,
} from '../services/types';

type StatusFilter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL';

export const AlertsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { summary, refresh: refreshGlobalSummary, onAlertEvent } = useAlerts();
  const { can } = usePermission();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningChecks, setRunningChecks] = useState<boolean>(false);
  const [bulkAcking, setBulkAcking] = useState<boolean>(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [selectedSeverities, setSelectedSeverities] = useState<AlertSeverity[]>([
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'INFO',
  ]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeProvisional, setIncludeProvisional] = useState<boolean>(true);

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modal de acción
  const [actionAlert, setActionAlert] = useState<Alert | null>(null);
  const [actionType, setActionType] = useState<AlertActionType>('acknowledge');
  const [actionModalOpen, setActionModalOpen] = useState<boolean>(false);

  // Modal de detalle
  const [detailAlert, setDetailAlert] = useState<AlertDetail | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const statuses =
        statusFilter === 'ALL'
          ? undefined
          : statusFilter === 'OPEN'
          ? ['OPEN', 'ACKNOWLEDGED']
          : [statusFilter];

      const res = await apiService.getAlerts({
        status: statuses,
        severity: selectedSeverities.length === 5 ? undefined : selectedSeverities,
        include_provisional: includeProvisional,
        q: searchQuery.trim() || undefined,
        limit: 100,
        sort: '-last_detected_at',
      });

      setAlerts(res.items);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedSeverities, includeProvisional, searchQuery]);

  const loadDetailById = useCallback(async (id: number) => {
    try {
      setLoadingDetail(true);
      const detail = await apiService.getAlert(id);
      setDetailAlert(detail);
      setDetailModalOpen(true);
    } catch (err) {
      console.error('Error cargando detalle de alerta:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Manejar query param id (?id=123)
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const parsedId = parseInt(idParam, 10);
      if (!isNaN(parsedId)) {
        loadDetailById(parsedId);
      }
    }
  }, [searchParams, loadDetailById]);

  // Carga inicial y reactiva
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Escuchar eventos en vivo SSE
  useEffect(() => {
    const unsub = onAlertEvent((event) => {
      if (
        event.event === 'alert.raised' ||
        event.event === 'alert.updated' ||
        event.event === 'alert.resolved' ||
        event.event === 'alert.escalated'
      ) {
        loadAlerts();
      }
    });
    return unsub;
  }, [onAlertEvent, loadAlerts]);

  // Ejecución de barrido manual
  const handleRunChecks = async () => {
    try {
      setRunningChecks(true);
      const result = await apiService.runAlertChecks();
      const raised = result.raised_count ?? 0;
      const resolved = result.resolved_count ?? 0;
      await Promise.all([loadAlerts(), refreshGlobalSummary()]);
      alert(`Barrido completado exitosamente: ${raised} desvíos detectados, ${resolved} normalizados.`);
    } catch (err) {
      console.error('Error en barrido manual:', err);
      alert('Error ejecutando el barrido programado de reglas.');
    } finally {
      setRunningChecks(false);
    }
  };

  // Reconocimiento masivo (OE-6: identidad tomada del token)
  const handleBulkAcknowledge = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBulkAcking(true);
      await apiService.bulkAcknowledgeAlerts(Array.from(selectedIds));
      setSelectedIds(new Set());
      await Promise.all([loadAlerts(), refreshGlobalSummary()]);
    } catch (err) {
      console.error('Error en reconocimiento masivo:', err);
      alert('Error al realizar el reconocimiento masivo.');
    } finally {
      setBulkAcking(false);
    }
  };

  // Ejecución de acción individual (OE-6: identidad tomada del token)
  const handleConfirmAction = async (payload: {
    alertId: number;
    action: AlertActionType;
    actor?: string;
    note?: string;
    until?: string;
  }) => {
    if (payload.action === 'acknowledge') {
      await apiService.acknowledgeAlert(payload.alertId, {
        note: payload.note,
      });
    } else if (payload.action === 'resolve') {
      await apiService.resolveAlert(payload.alertId, {
        note: payload.note || '',
      });
    } else if (payload.action === 'silence') {
      await apiService.silenceAlert(payload.alertId, {
        until: payload.until || '',
        note: payload.note,
      });
    }

    await Promise.all([loadAlerts(), refreshGlobalSummary()]);
    if (detailAlert && detailAlert.id === payload.alertId) {
      loadDetailById(payload.alertId);
    }
  };

  const toggleSeverity = (sev: AlertSeverity) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeIds = alerts
        .filter((a) => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED')
        .map((a) => a.id);
      setSelectedIds(new Set(activeIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const allActiveSelected = useMemo(() => {
    const active = alerts.filter((a) => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED');
    return active.length > 0 && active.every((a) => selectedIds.has(a.id));
  }, [alerts, selectedIds]);

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* Encabezado y Acciones Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight m-0 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[var(--accent)]" />
            Centro de Alertas y Desvíos Normativos
          </h2>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] font-medium mt-1 mb-0">
            Monitoreo en tiempo real de fallas técnicas, incumplimientos legales y barridos automáticos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can('alerts:run_checks') && (
            <Button
              title="Barrido Programado"
              variant="outline"
              size="sm"
              icon={<Play className="w-4 h-4 text-[var(--accent)]" />}
              onClick={handleRunChecks}
              loading={runningChecks}
            />
          )}
          <Button
            title="Refrescar"
            variant="secondary"
            size="sm"
            icon={<RotateCw className="w-4 h-4" />}
            onClick={() => {
              loadAlerts();
              refreshGlobalSummary();
            }}
            loading={loading}
          />
        </div>
      </div>

      {/* Strip de Indicadores Clínicos (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">
            Alertas Abiertas
          </span>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {summary?.open_total ?? '—'}
          </div>
          <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
            Requieren atención del equipo
          </span>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between border-[var(--danger)]/30 bg-[var(--danger-soft)]/20">
          <span className="text-[11px] font-bold text-[var(--danger)] uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse" />
            Críticas sin Reconocer
          </span>
          <div className="text-2xl font-black text-[var(--danger)] mt-1">
            {summary?.unacknowledged_critical ?? '—'}
          </div>
          <span className="text-[10.5px] text-[var(--danger)]/80 mt-1 font-semibold">
            Riesgo operativo inmediato
          </span>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">
            MTTA (Reconocimiento)
          </span>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {summary?.mtta_minutes !== null && summary?.mtta_minutes !== undefined
              ? `${Math.round(summary.mtta_minutes)}m`
              : '—'}
          </div>
          <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
            Tiempo medio de respuesta
          </span>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wider">
            MTTR (Resolución)
          </span>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {summary?.mttr_minutes !== null && summary?.mttr_minutes !== undefined
              ? `${Math.round(summary.mttr_minutes)}m`
              : '—'}
          </div>
          <span className="text-[10.5px] text-[var(--ink-soft)] mt-1">
            Tiempo medio de mitigación
          </span>
        </Card>
      </div>

      {/* Barra de Filtros Multifacéticos */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Tabs de Estado */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            {(
              [
                { label: 'Abiertas', value: 'OPEN' },
                { label: 'Reconocidas', value: 'ACKNOWLEDGED' },
                { label: 'Resueltas', value: 'RESOLVED' },
                { label: 'Todas', value: 'ALL' },
              ] as const
            ).map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st.value
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                    : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)] hover:bg-[var(--border)]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Búsqueda en Vivo */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-[var(--ink-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por activo, norma o título..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-hidden focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Chips de Severidad y Toggle Provisionales */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--ink-faint)] mr-1">
              Severidad:
            </span>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => {
              const active = selectedSeverities.includes(sev);
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleSeverity(sev)}
                  className={`py-0.5 px-2.5 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${
                    active
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)] hover:bg-[var(--border)]'
                  }`}
                >
                  {sev}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[var(--ink-soft)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeProvisional}
              onChange={(e) => setIncludeProvisional(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span>Incluir alertas provisionales (inspecciones en curso)</span>
          </label>
        </div>
      </div>

      {/* Barra de Acciones Masivas (solo visible si tiene permiso para reconocer) */}
      {can('alerts:acknowledge') && selectedIds.size > 0 && (
        <div className="p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-strong)]">
            <span>{selectedIds.size} alertas seleccionadas</span>
          </div>

          <Button
            title="Reconocer Seleccionadas"
            variant="primary"
            size="sm"
            icon={<Clock className="w-4 h-4" />}
            onClick={handleBulkAcknowledge}
            loading={bulkAcking}
          />
        </div>
      )}

      {/* Control Seleccionar Todas y Conteo */}
      <div className="flex items-center justify-between text-xs text-[var(--ink-soft)] px-1">
        {can('alerts:acknowledge') && (
          <label className="flex items-center gap-2 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allActiveSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span>Seleccionar todas las activas</span>
          </label>
        )}
        <span className="ml-auto font-semibold">
          Total listadas: {totalCount}
        </span>
      </div>

      {/* Lista de Alertas */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-[var(--ink-soft)]">
            Cargando desvíos normativos y notificaciones...
          </span>
        </div>
      ) : alerts.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--ok-soft)] text-[var(--ok)] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--ink)] m-0">
            Sin Alertas para los Filtros Actuales
          </h3>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] max-w-md m-0">
            La red hospitalaria opera dentro de los márgenes normativos de seguridad clínica y no presenta desvíos pendientes de corrección.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              selected={selectedIds.has(alert.id)}
              onSelect={
                can('alerts:acknowledge')
                  ? (checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(alert.id);
                        else next.delete(alert.id);
                        return next;
                      });
                    }
                  : undefined
              }
              onAcknowledge={
                can('alerts:acknowledge')
                  ? (a) => {
                      setActionAlert(a);
                      setActionType('acknowledge');
                      setActionModalOpen(true);
                    }
                  : undefined
              }
              onResolve={
                can('alerts:resolve')
                  ? (a) => {
                      setActionAlert(a);
                      setActionType('resolve');
                      setActionModalOpen(true);
                    }
                  : undefined
              }
              onSilence={
                can('alerts:silence')
                  ? (a) => {
                      setActionAlert(a);
                      setActionType('silence');
                      setActionModalOpen(true);
                    }
                  : undefined
              }
              onViewDetail={(a) => {
                loadDetailById(a.id);
                setSearchParams({ id: String(a.id) });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de Acción (Reconocer / Resolver / Silenciar) */}
      <AlertActionsDialog
        open={actionModalOpen}
        onOpenChange={setActionModalOpen}
        alert={actionAlert}
        actionType={actionType}
        onConfirm={handleConfirmAction}
      />

      {/* Modal de Detalle Completo de la Alerta */}
      <Dialog.Root
        open={detailModalOpen}
        onOpenChange={(open) => {
          setDetailModalOpen(open);
          if (!open) {
            searchParams.delete('id');
            setSearchParams(searchParams);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                Auditoría y Trazabilidad del Desvío
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--surface-2)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {loadingDetail || !detailAlert ? (
              <div className="p-12 text-center text-xs text-[var(--ink-soft)]">
                Cargando datos completos de la bitácora...
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Resumen */}
                <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--accent)]">
                      {detailAlert.rule_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <AlertSeverityBadge severity={detailAlert.severity} size="sm" />
                      <AlertStatusBadge status={detailAlert.status} size="sm" />
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-[var(--ink)] m-0">{detailAlert.title}</h4>
                  <p className="text-xs text-[var(--ink-soft)] m-0 leading-relaxed">
                    {detailAlert.message}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--border)] text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-[var(--ink-faint)] block uppercase">
                        Activo
                      </span>
                      <span className="font-semibold text-[var(--ink)]">
                        {detailAlert.asset_tag || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[var(--ink-faint)] block uppercase">
                        Sector
                      </span>
                      <span className="font-semibold text-[var(--ink)]">
                        {detailAlert.sector_name || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[var(--ink-faint)] block uppercase">
                        Norma Ref.
                      </span>
                      <span className="font-semibold text-[var(--ink)]">
                        {detailAlert.normative_ref || 'ISO 7396-1'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[var(--ink-faint)] block uppercase">
                        Detecciones
                      </span>
                      <span className="font-bold text-[var(--ink)]">
                        ×{detailAlert.occurrence_count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Línea de Vida y Entregas */}
                <AlertTimeline alert={detailAlert} />

                {/* Acciones del Detalle */}
                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  {(detailAlert.status === 'OPEN' || detailAlert.status === 'ACKNOWLEDGED') && (
                    <>
                      {detailAlert.status === 'OPEN' && can('alerts:acknowledge') && (
                        <Button
                          title="Reconocer"
                          variant="secondary"
                          size="sm"
                          icon={<Clock className="w-4 h-4 text-[var(--warn)]" />}
                          onClick={() => {
                            setActionAlert(detailAlert);
                            setActionType('acknowledge');
                            setActionModalOpen(true);
                          }}
                        />
                      )}
                      {can('alerts:silence') && (
                        <Button
                          title="Silenciar"
                          variant="secondary"
                          size="sm"
                          icon={<VolumeX className="w-4 h-4 text-[var(--ink-soft)]" />}
                          onClick={() => {
                            setActionAlert(detailAlert);
                            setActionType('silence');
                            setActionModalOpen(true);
                          }}
                        />
                      )}
                      {can('alerts:resolve') && (
                        <Button
                          title="Resolver"
                          variant="success"
                          size="sm"
                          icon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => {
                            setActionAlert(detailAlert);
                            setActionType('resolve');
                            setActionModalOpen(true);
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
