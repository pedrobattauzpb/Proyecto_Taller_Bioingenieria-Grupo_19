import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
  Hospital,
  Asset,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ComponentHistoryTimeline } from '../components/history/ComponentHistoryTimeline';
import { HierarchySelector } from '../components/hierarchy/HierarchySelector';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paramAssetId = searchParams.get('assetId');

  const isInspectionsRoute = location.pathname.startsWith('/inspections');

  const [activeTab, setActiveTab] = useState<'ALL_INSPECTIONS' | 'ASSET_TIMELINE'>(
    paramAssetId ? 'ASSET_TIMELINE' : (isInspectionsRoute ? 'ALL_INSPECTIONS' : 'ALL_INSPECTIONS')
  );

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [inspections, setInspections] = useState<InspectionDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | InspectionStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadHierarchyAndData();
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/inspections')) {
      setActiveTab('ALL_INSPECTIONS');
    } else if (location.pathname.startsWith('/history') && !paramAssetId) {
      setActiveTab('ASSET_TIMELINE');
    }
  }, [location.pathname, paramAssetId]);

  useEffect(() => {
    if (activeTab === 'ALL_INSPECTIONS') {
      loadInspections();
    }
  }, [statusFilter, activeTab]);

  const loadHierarchyAndData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [hierData, inspData] = await Promise.all([
        apiService.getHierarchy(),
        apiService.listInspections({ limit: 100 }),
      ]);
      setHospitals(hierData.hospitals);
      setInspections(inspData);

      if (paramAssetId) {
        const targetId = parseInt(paramAssetId, 10);
        for (const h of hierData.hospitals) {
          for (const s of h.sectors) {
            const found = s.assets.find((a) => a.id === targetId);
            if (found) {
              setSelectedAsset(found);
              break;
            }
          }
        }
      } else if (
        hierData.hospitals.length > 0 &&
        hierData.hospitals[0].sectors.length > 0 &&
        hierData.hospitals[0].sectors[0].assets.length > 0
      ) {
        setSelectedAsset(hierData.hospitals[0].sectors[0].assets[0]);
      }
    } catch (err: any) {
      console.error('Error cargando datos iniciales de historial:', err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight m-0">
            {isInspectionsRoute ? 'Protocolos e Inspecciones Registradas' : 'Registro Histórico y Trazabilidad'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            {isInspectionsRoute
              ? 'Inspecciones técnicas de gases medicinales bajo ISO 7396-1 y Res. MSAL 1130/2000'
              : 'Auditoría y línea temporal de intervenciones técnicas por componente'}
          </p>
        </div>
        <Button
          title="Actualizar"
          variant="outline"
          size="sm"
          onClick={activeTab === 'ALL_INSPECTIONS' ? loadInspections : loadHierarchyAndData}
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

      {/* Selector de Pestañas */}
      <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('ALL_INSPECTIONS')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer select-none text-center ${
            activeTab === 'ALL_INSPECTIONS'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Todas las Inspecciones ({inspections.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ASSET_TIMELINE')}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer select-none text-center ${
            activeTab === 'ASSET_TIMELINE'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Línea de Tiempo por Activo
        </button>
      </div>

      {activeTab === 'ALL_INSPECTIONS' ? (
        <div className="flex flex-col gap-4">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Todos ({inspections.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Cerradas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('IN_PROGRESS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  statusFilter === 'IN_PROGRESS'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                En Curso
              </button>
            </div>
          </div>

          {/* Lista de Inspecciones */}
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-500">Cargando registros de auditoría...</p>
            </div>
          ) : filteredInspections.length === 0 ? (
            <Card className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <FileCheck2 className="w-10 h-10 text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">No se encontraron inspecciones</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
                Intente ajustar los términos de búsqueda o el filtro de estado seleccionado.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredInspections.map((insp) => {
                const isCompleted = insp.status === 'COMPLETED';
                const evaluatedCount = insp.completed_items ?? insp.responses.length;
                const totalCount = insp.total_items ?? insp.template?.items?.length ?? 0;

                return (
                  <div
                    key={insp.id}
                    onClick={() => navigate(`/inspections/${insp.id}`)}
                    className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-2xs hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge label={`#${insp.id}`} variant="slate" size="sm" />
                        <Badge label={insp.asset?.tag_code || 'TAG'} variant="indigo" size="sm" />
                        <Badge
                          label={
                            isCompleted
                              ? 'Cerrada y Sellada'
                              : insp.status === 'IN_PROGRESS'
                              ? 'En Curso'
                              : 'Borrador'
                          }
                          variant={isCompleted ? 'emerald' : 'amber'}
                          size="sm"
                        />
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                        {insp.asset?.name || 'Activo Clínico'}
                      </h4>
                      <p className="text-xs text-slate-500 m-0">{insp.template?.title || 'Checklist'}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(insp.started_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          Auditor: <span className="font-semibold text-slate-700">{insp.inspector_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-xs font-bold text-slate-600">
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
      ) : (
        /* VISTA DE LÍNEA DE TIEMPO POR ACTIVO */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <HierarchySelector
              hospitals={hospitals}
              loading={loading}
              selectedAsset={selectedAsset}
              onSelectAsset={(a) => setSelectedAsset(a)}
              onStartInspection={(a) => {
                apiService
                  .createInspection({ asset_id: a.id, inspector_name: 'Bioing. Santiago' })
                  .then((res) => navigate(`/inspections/${res.id}`));
              }}
            />
          </div>

          <div className="lg:col-span-7">
            {selectedAsset ? (
              <ComponentHistoryTimeline
                assetId={selectedAsset.id}
                assetName={selectedAsset.name}
                assetTag={selectedAsset.tag_code}
                onSelectInspection={(inspId) => navigate(`/inspections/${inspId}`)}
              />
            ) : (
              <Card className="p-8 text-center text-slate-500">
                Seleccione un activo a la izquierda para visualizar su línea de tiempo histórica.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
