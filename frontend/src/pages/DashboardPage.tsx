import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Radio,
  CircleDot,
  Gauge,
  Layers,
  ShieldCheck,
  RotateCw,
  ChevronDown,
  X,
  Play,
  AlertCircle,
  FileSpreadsheet,
  Clock,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiService } from '../services/api';
import type {
  Hospital,
  Asset,
  AssetType,
  StatsOverviewResponse,
} from '../services/types';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ComponentHistoryTimeline } from '../components/history/ComponentHistoryTimeline';
import { cn } from '../lib/utils';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Jerarquía seleccionada
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);

  // Modal para iniciar inspección
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [inspectorName, setInspectorName] = useState<string>('Bioing. Santiago');
  const [inspectionNotes, setInspectionNotes] = useState<string>('');
  const [startingInspection, setStartingInspection] = useState<boolean>(false);

  // Modal para ver historial técnico del activo
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<Asset | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [hierResult, statsResult] = await Promise.allSettled([
        apiService.getHierarchy(),
        apiService.getStats(),
      ]);

      if (hierResult.status === 'fulfilled') {
        const loadedHospitals = hierResult.value.hospitals;
        setHospitals(loadedHospitals);

        if (loadedHospitals.length > 0) {
          const firstHospital = loadedHospitals[0];
          setSelectedHospitalId((prev) =>
            prev && loadedHospitals.some((h) => h.id === prev) ? prev : firstHospital.id
          );

          if (firstHospital.sectors.length > 0) {
            setSelectedSectorId((prev) => {
              const allSectors = loadedHospitals.flatMap((h) => h.sectors);
              return prev && allSectors.some((s) => s.id === prev)
                ? prev
                : firstHospital.sectors[0].id;
            });
          }
        }
      } else {
        console.error('Error cargando jerarquía:', hierResult.reason);
        setError('No se pudo cargar la jerarquía de activos clínicos.');
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        console.warn('Estadísticas no disponibles temporalmente:', statsResult.reason);
      }
    } catch (err: any) {
      console.error('Error inesperado en dashboard:', err);
      setError('Error inesperado al comunicarse con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const activeHospital =
    hospitals.find((h) => h.id === selectedHospitalId) || hospitals[0] || null;

  const activeSector =
    activeHospital?.sectors.find((s) => s.id === selectedSectorId) ||
    activeHospital?.sectors[0] ||
    null;

  const handleStartInspectionModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setModalOpen(true);
  };

  const handleOpenHistoryModal = (asset: Asset) => {
    setSelectedHistoryAsset(asset);
    setHistoryModalOpen(true);
  };

  const handleConfirmStartInspection = async () => {
    if (!selectedAsset) return;
    try {
      setStartingInspection(true);
      const newInsp = await apiService.createInspection({
        asset_id: selectedAsset.id,
        inspector_name: inspectorName.trim() || 'Inspector Técnico',
        notes: inspectionNotes.trim() || undefined,
      });
      setModalOpen(false);
      navigate(`/inspections/${newInsp.id}`);
    } catch (err: any) {
      console.error('Error iniciando inspección:', err);
      alert('Error al iniciar la inspección. Verifique la conexión con el servidor.');
    } finally {
      setStartingInspection(false);
    }
  };

  const getAssetTypeName = (type: AssetType): string => {
    switch (type) {
      case 'MANIFOLD':
        return 'Manifold Central';
      case 'AVSU_VALVE':
        return 'Válvula AVSU';
      case 'TERMINAL_UNIT':
        return 'Boca Terminal';
      case 'PRESSURE_REGULATOR':
        return 'Regulador Presión';
      case 'GAS_CYLINDER':
        return 'Cilindro / Envase';
      default:
        return type;
    }
  };

  const getAssetIcon = (type: AssetType) => {
    switch (type) {
      case 'MANIFOLD':
        return <Activity className="w-3 h-3 shrink-0" />;
      case 'AVSU_VALVE':
        return <Radio className="w-3 h-3 shrink-0" />;
      case 'TERMINAL_UNIT':
        return <CircleDot className="w-3 h-3 shrink-0" />;
      case 'PRESSURE_REGULATOR':
        return <Gauge className="w-3 h-3 shrink-0" />;
      case 'GAS_CYLINDER':
        return <Layers className="w-3 h-3 shrink-0" />;
      default:
        return <Activity className="w-3 h-3 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Topbar: Título y Badges Normativos */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] m-0">
            Módulo de Inspección Digital de Gases
          </h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">
            Auditoría clínica y verificación normativa
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] font-semibold py-1 px-2.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
            Res. MSAL 1130/2000
          </span>
          <span className="text-[11.5px] font-semibold py-1 px-2.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-soft)] border border-[var(--border)]">
            ISO 7396-1:2016
          </span>
          <span className="inline-flex items-center gap-1.5 bg-[var(--ok-soft)] text-[var(--ok)] py-1 px-2.5 rounded-full text-[11.5px] font-bold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] animate-pulse" />
            <span>Red operativa</span>
          </span>
          <button
            type="button"
            onClick={loadDashboardData}
            title="Actualizar datos"
            disabled={loading}
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer transition-all"
          >
            <RotateCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold m-0">{error}</p>
        </div>
      )}

      {/* Stat Strip: KPIs consolidados en una sola barra horizontal */}
      <div className="stat-strip">
        <div className="stat">
          <div className="stat-value">
            {stats?.active_assets ?? '-'}
          </div>
          <div className="stat-label">
            Activos operativos de {stats?.total_assets ?? '-'}
          </div>
        </div>

        <div className="stat">
          <div className="stat-value warn">
            {stats?.in_progress_inspections ?? 0}
          </div>
          <div className="stat-label">Auditorías en proceso</div>
        </div>

        <div className="stat">
          <div className="stat-value">
            {stats?.completed_inspections ?? 0}
          </div>
          <div className="stat-label">Auditorías completas</div>
        </div>

        <div className="stat">
          <div className="stat-value ok">
            {stats?.global_compliance_percentage !== undefined
              ? `${stats.global_compliance_percentage}%`
              : '100%'}
          </div>
          <div className="stat-label">Cumplimiento legal</div>
        </div>
      </div>

      {/* Breadcrumb Selector de Sectores */}
      <div className="crumb">
        {hospitals.length > 1 ? (
          <select
            value={activeHospital?.id || ''}
            onChange={(e) => {
              const hId = Number(e.target.value);
              setSelectedHospitalId(hId);
              const hosp = hospitals.find((h) => h.id === hId);
              if (hosp && hosp.sectors.length > 0) {
                setSelectedSectorId(hosp.sectors[0].id);
              }
            }}
            className="crumb-item font-semibold text-[var(--ink)] bg-[var(--surface)] border-[var(--border)] outline-none py-1.5 px-3 rounded-full cursor-pointer"
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="crumb-item">
            {activeHospital?.name || 'Hospital Dr. Arturo Oñativia'}
          </div>
        )}

        <span className="crumb-sep">›</span>

        {activeHospital?.sectors.map((sector) => {
          const isCurrent = sector.id === activeSector?.id;
          return (
            <button
              key={sector.id}
              type="button"
              onClick={() => setSelectedSectorId(sector.id)}
              className={cn('crumb-item', isCurrent && 'current')}
            >
              <span>{sector.name}</span>
              <span className="count">{sector.assets.length}</span>
            </button>
          );
        })}
      </div>

      {/* Layout Principal: 2 columnas (Grid de Activos + Sidebar consolidado) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* Columna Izquierda: Grilla de Activos del Sector */}
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <div>
              <span className="text-[14.5px] font-bold text-[var(--ink)]">
                Activos en {activeSector?.name || 'Sector'}
              </span>
              <span className="text-[12.5px] font-medium text-[var(--ink-faint)] ml-2">
                {activeSector?.assets.length || 0} activos
              </span>
            </div>
          </div>

          {!activeSector || activeSector.assets.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-center flex flex-col items-center justify-center gap-2">
              <FileSpreadsheet className="w-7 h-7 text-[var(--ink-faint)]" />
              <p className="text-sm font-semibold text-[var(--ink)] m-0">
                No hay activos registrados en este sector
              </p>
              <p className="text-xs text-[var(--ink-soft)] m-0">
                Seleccione otro sector en la barra superior.
              </p>
            </div>
          ) : (
            <div className="asset-grid">
              {activeSector.assets.map((asset) => (
                <div key={asset.id} className="asset-card">
                  <div className="flex justify-between items-start gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--info)]">
                      {getAssetIcon(asset.asset_type)}
                      <span>{getAssetTypeName(asset.asset_type)}</span>
                    </span>
                    <span className="text-[10.5px] text-[var(--ink-faint)] font-semibold">
                      {asset.tag_code}
                    </span>
                  </div>

                  <div className="font-bold text-[13.5px] text-[var(--ink)] leading-snug line-clamp-2">
                    {asset.name}
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-[var(--border)]">
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium',
                        asset.is_active ? 'text-[var(--ok)]' : 'text-[var(--ink-faint)]'
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          asset.is_active ? 'bg-[var(--ok)]' : 'bg-[var(--ink-faint)]'
                        )}
                      />
                      <span>{asset.is_active ? 'Operativo' : 'Inactivo'}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenHistoryModal(asset)}
                        className="text-[11.5px] font-semibold py-1.5 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--surface-3)] cursor-pointer transition-colors flex items-center gap-1"
                        title="Ver historial técnico"
                      >
                        <Clock className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                        <span>Historial</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartInspectionModal(asset)}
                        className="text-[11.5px] font-semibold py-1.5 px-3 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer transition-opacity"
                      >
                        Auditar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna Derecha: Sidebar de Inspecciones Recientes y Marco Normativo */}
        <div className="flex flex-col gap-3.5">
          {/* Tarjeta de Últimas Inspecciones */}
          <div className="side-card">
            <div className="side-head">
              <span className="font-bold text-[13px] text-[var(--ink)]">
                Últimas inspecciones
              </span>
              <button
                type="button"
                onClick={() => navigate('/inspections')}
                className="text-[12px] font-semibold text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                Ver todas
              </button>
            </div>

            {!stats?.recent_inspections || stats.recent_inspections.length === 0 ? (
              <div className="p-5 text-center text-xs text-[var(--ink-soft)]">
                No hay inspecciones recientes registradas.
              </div>
            ) : (
              <div>
                {stats.recent_inspections.slice(0, 5).map((insp) => (
                  <div
                    key={insp.id}
                    onClick={() => navigate(`/inspections/${insp.id}`)}
                    className="insp-item cursor-pointer"
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-[var(--ink-faint)]">
                        {insp.asset_tag} ·{' '}
                        {new Date(insp.started_at).toLocaleDateString()}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold py-0.5 px-2 rounded-full',
                          insp.status === 'COMPLETED'
                            ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                            : 'bg-[var(--warn-soft)] text-[var(--warn)]'
                        )}
                      >
                        {insp.status === 'COMPLETED' ? 'Completado' : 'En curso'}
                      </span>
                    </div>

                    <div className="text-[12.5px] font-semibold text-[var(--ink)] line-clamp-1">
                      {insp.asset_name}
                    </div>

                    <div className="text-[11.5px] text-[var(--ink-faint)]">
                      Auditor: {insp.inspector_name}
                    </div>

                    <div
                      className={cn(
                        'text-[11px] font-semibold',
                        insp.non_compliant_count > 0 ? 'text-[var(--warn)]' : 'text-[var(--ok)]'
                      )}
                    >
                      {insp.non_compliant_count > 0
                        ? `${insp.non_compliant_count} No Conforme(s)`
                        : '100% conforme'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarjeta de Marco Normativo Desplegable */}
          <div className="side-card">
            <details className="group">
              <summary className="p-3.5 flex items-center gap-2 text-[var(--ink-soft)] text-[12.5px] font-semibold cursor-pointer select-none list-none hover:bg-[var(--surface-2)] transition-colors">
                <ShieldCheck className="w-4 h-4 text-[var(--ink-faint)] shrink-0" />
                <span>Marco normativo y protocolos</span>
                <ChevronDown className="w-3.5 h-3.5 ml-auto transition-transform group-open:rotate-180 text-[var(--ink-faint)]" />
              </summary>
              <div className="px-3.5 pb-3.5 text-xs text-[var(--ink-soft)] leading-relaxed border-t border-[var(--border)] pt-2.5">
                Auditoría de gases según{' '}
                <b className="text-[var(--ink)]">Res. MSAL 1130/2000</b> (control de envases) y{' '}
                <b className="text-[var(--ink)]">ISO 7396-1</b> (redes fijas). Verificación de cruz
                griega, prueba hidráulica y rotulado en envases; presión de 4.0–5.5 bar y válvulas
                AVSU en redes centrales.
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Modal para Iniciar Inspección */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                Iniciar Nueva Inspección
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

            {selectedAsset && (
              <div className="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    {selectedAsset.tag_code}
                  </span>
                  <span className="text-[11px] text-[var(--ink-faint)] font-semibold uppercase tracking-wider">
                    {getAssetTypeName(selectedAsset.asset_type)}
                  </span>
                </div>
                <div className="text-sm font-bold text-[var(--ink)]">{selectedAsset.name}</div>
              </div>
            )}

            <Input
              label="Nombre del Bioingeniero / Inspector Técnico"
              value={inspectorName}
              onChangeText={setInspectorName}
              placeholder="Ej: Bioing. Santiago"
            />

            <Input
              label="Notas Preliminares (Opcional)"
              value={inspectionNotes}
              onChangeText={setInspectionNotes}
              placeholder="Ej: Inspección semanal / Turno mañana"
              multiline
              numberOfLines={2}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)] mt-2">
              <Button
                title="Cancelar"
                variant="secondary"
                onClick={() => setModalOpen(false)}
                disabled={startingInspection}
              />
              <Button
                title="Comenzar Checklist"
                variant="primary"
                icon={<Play className="w-4 h-4" />}
                onClick={handleConfirmStartInspection}
                loading={startingInspection}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal para Historial Técnico del Activo */}
      <Dialog.Root open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--surface)] text-[var(--ink)] rounded-2xl shadow-2xl border border-[var(--border)] p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
              <Dialog.Title className="text-base font-bold text-[var(--ink)] m-0">
                Historial Técnico del Activo
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

            {selectedHistoryAsset && (
              <ComponentHistoryTimeline
                assetId={selectedHistoryAsset.id}
                assetName={selectedHistoryAsset.name}
                assetTag={selectedHistoryAsset.tag_code}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
