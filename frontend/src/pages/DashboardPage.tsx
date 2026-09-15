import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  ShieldCheck,
  Layers,
  FileSpreadsheet,
  X,
  RotateCw,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiService } from '../services/api';
import type {
  Hospital,
  Asset,
  StatsOverviewResponse,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { HierarchySelector } from '../components/hierarchy/HierarchySelector';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [inspectorName, setInspectorName] = useState<string>('Bioing. Santiago');
  const [inspectionNotes, setInspectionNotes] = useState<string>('');
  const [startingInspection, setStartingInspection] = useState<boolean>(false);

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

        setSelectedAsset((prev) => {
          if (prev) {
            for (const h of loadedHospitals) {
              for (const s of h.sectors) {
                const match = s.assets.find((a) => a.id === prev.id);
                if (match) return match;
              }
            }
          }
          return loadedHospitals[0]?.sectors[0]?.assets[0] || null;
        });
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

  const handleStartInspectionModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setModalOpen(true);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado del Dashboard */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
            Módulo de Inspección Digital de Gases
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Auditoría clínica y verificación normativa bajo Res. MSAL 1130/2000 e ISO 7396-1
          </p>
        </div>
        <Button
          title="Actualizar Datos"
          variant="outline"
          size="sm"
          onClick={loadDashboardData}
          loading={loading}
          icon={<RotateCw className="w-3.5 h-3.5" />}
        />
      </div>

      {error && (
        <Card className="flex items-center gap-3 p-4 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="text-sm font-semibold">{error}</p>
        </Card>
      )}

      {/* Tarjetas KPI de Actividad */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="flex flex-col justify-between gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">TOTAL ACTIVOS</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900">{stats?.total_assets ?? '-'}</span>
          <span className="text-[11px] text-slate-500 font-medium">En sectores clínicos</span>
        </Card>

        <Card className="flex flex-col justify-between gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">OPERATIVOS</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-600">{stats?.active_assets ?? '-'}</span>
          <span className="text-[11px] text-slate-500 font-medium">100% de disponibilidad</span>
        </Card>

        <Card className="flex flex-col justify-between gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">AUDITORÍAS COMPLETAS</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-700">{stats?.completed_inspections ?? 0}</span>
          <span className="text-[11px] text-slate-500 font-medium">Conforme a norma</span>
        </Card>

        <Card className="flex flex-col justify-between gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">EN PROCESO</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-amber-600">{stats?.in_progress_inspections ?? 0}</span>
          <span className="text-[11px] text-slate-500 font-medium">Pendientes de cierre</span>
        </Card>

        <Card className="flex flex-col justify-between gap-2 p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">CUMPLIMIENTO LEGAL</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-600">
            {stats?.global_compliance_percentage !== undefined ? `${stats.global_compliance_percentage}%` : '100%'}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">Auditoría algorítmica</span>
        </Card>
      </div>

      {/* Disposición Principal en 2 Columnas (Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Cascada de Selección de Activos */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <HierarchySelector
            hospitals={hospitals}
            loading={loading}
            selectedAsset={selectedAsset}
            onSelectAsset={(a) => setSelectedAsset(a)}
            onStartInspection={handleStartInspectionModal}
          />
        </div>

        {/* Columna Derecha: Protocolos e Historial Reciente */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Banner de Protocolos Normativos */}
          <Card className="p-5 flex flex-col gap-3 border-blue-200 bg-blue-50/40">
            <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm sm:text-base">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <span>Protocolos de Verificación Normativa</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seleccione un activo a la izquierda o ejecute una auditoría inmediata bajo los estándares de bioingeniería:
            </p>

            <div className="flex flex-col gap-2.5 mt-1">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <Badge label="Res. 1130/2000" variant="indigo" size="sm" className="shrink-0" />
                <span>Control de Envases/Cilindros de O2 y N2O (cruz griega, prueba hidráulica, rotulado).</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <Badge label="ISO 7396-1:2016" variant="emerald" size="sm" className="shrink-0" />
                <span>Inspección de Redes Centrales, Manifolds (4.0-5.5 bar), Válvulas AVSU y Tomas Rápidas.</span>
              </div>
            </div>
          </Card>

          {/* Últimas Inspecciones Realizadas */}
          <Card className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">Últimas Inspecciones</h3>
              <Button
                title="Ver Historial"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/history')}
              />
            </div>

            {!stats?.recent_inspections || stats.recent_inspections.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">No hay inspecciones previas</p>
                <p className="text-xs text-slate-500">
                  Comience seleccionando un activo del panel izquierdo para crear el primer registro digital.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {stats.recent_inspections.map((insp) => (
                  <div
                    key={insp.id}
                    onClick={() => navigate(`/inspections/${insp.id}`)}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge label={insp.asset_tag} variant="slate" size="sm" />
                        <Badge
                          label={insp.status === 'COMPLETED' ? 'Completado' : 'En Curso'}
                          variant={insp.status === 'COMPLETED' ? 'emerald' : 'amber'}
                          size="sm"
                        />
                      </div>
                      <span className="text-slate-400 font-medium">
                        {new Date(insp.started_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900">{insp.asset_name}</div>
                    <div className="text-xs text-slate-500">{insp.template_title}</div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                      <span className="text-slate-500">Auditor: {insp.inspector_name}</span>
                      {insp.non_compliant_count > 0 ? (
                        <Badge
                          label={`${insp.non_compliant_count} No Conforme(s)`}
                          variant="rose"
                          size="sm"
                        />
                      ) : (
                        <Badge label="100% Conforme" variant="emerald" size="sm" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Modal para Iniciar Inspección */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <Dialog.Title className="text-base font-bold text-slate-900">
                Iniciar Nueva Inspección
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {selectedAsset && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge label={selectedAsset.tag_code} variant="indigo" size="sm" />
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    {selectedAsset.asset_type}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{selectedAsset.name}</div>
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

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
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
    </div>
  );
};
