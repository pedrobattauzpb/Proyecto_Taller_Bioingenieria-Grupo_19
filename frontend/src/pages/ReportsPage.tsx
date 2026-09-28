import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FileDown,
  FileSpreadsheet,
  RotateCw,
  Building2,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { apiService } from '../services/api';
import { triggerBlobDownload } from '../utils/download';
import type {
  Hospital,
  ExecutiveReportData,
  InspectionDetail,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SectorComplianceChart } from '../components/reports/SectorComplianceChart';
import { AssetTypeComplianceChart } from '../components/reports/AssetTypeComplianceChart';
import { SeverityPieChart } from '../components/reports/SeverityPieChart';
import { cn } from '../lib/utils';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [executiveData, setExecutiveData] = useState<ExecutiveReportData | null>(null);
  const [recentCompleted, setRecentCompleted] = useState<InspectionDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de descarga
  const [downloadingExecPdf, setDownloadingExecPdf] = useState<boolean>(false);
  const [downloadingExecExcel, setDownloadingExecExcel] = useState<boolean>(false);
  const [customInspectionId, setCustomInspectionId] = useState<string>('');
  const [downloadingCustomPdf, setDownloadingCustomPdf] = useState<boolean>(false);
  const [downloadingCustomExcel, setDownloadingCustomExcel] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedHospitalId) {
      loadExecutiveData(selectedHospitalId);
    }
  }, [selectedHospitalId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [hierarchyRes, completedRes] = await Promise.allSettled([
        apiService.getHierarchy(),
        apiService.listInspections({ status: 'COMPLETED', limit: 8 }),
      ]);

      let hospId: number | null = null;
      if (hierarchyRes.status === 'fulfilled' && hierarchyRes.value.hospitals.length > 0) {
        setHospitals(hierarchyRes.value.hospitals);
        hospId = hierarchyRes.value.hospitals[0].id;
        setSelectedHospitalId(hospId);
      }

      if (completedRes.status === 'fulfilled') {
        setRecentCompleted(completedRes.value);
      }

      if (hospId) {
        await loadExecutiveData(hospId);
      }
    } catch (err: any) {
      console.error('Error cargando módulo de reportes:', err);
      setError('No se pudo inicializar el módulo de reportes y estadísticas.');
    } finally {
      setLoading(false);
    }
  };

  const loadExecutiveData = async (hospId: number) => {
    try {
      const data = await apiService.getExecutiveReportData(hospId);
      setExecutiveData(data);
    } catch (err: any) {
      console.error('Error cargando datos ejecutivos:', err);
    }
  };

  const handleDownloadExecutivePdf = async () => {
    try {
      setDownloadingExecPdf(true);
      const blob = await apiService.downloadExecutivePDF(selectedHospitalId || undefined);
      const code = executiveData?.hospital_code || 'HOSP';
      triggerBlobDownload(blob, `Informe_Ejecutivo_${code}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Error descargando informe ejecutivo PDF:', err);
      alert('Error al generar el Informe Ejecutivo en PDF.');
    } finally {
      setDownloadingExecPdf(false);
    }
  };

  const handleDownloadExecutiveExcel = async () => {
    try {
      setDownloadingExecExcel(true);
      const blob = await apiService.downloadExecutiveExcel(selectedHospitalId || undefined);
      const code = executiveData?.hospital_code || 'HOSP';
      triggerBlobDownload(blob, `Informe_Ejecutivo_${code}_${Date.now()}.xlsx`);
    } catch (err) {
      console.error('Error descargando informe ejecutivo Excel:', err);
      alert('Error al exportar los datos institucionales a Excel.');
    } finally {
      setDownloadingExecExcel(false);
    }
  };

  const handleDownloadCustomInspection = async (format: 'pdf' | 'excel') => {
    const id = parseInt(customInspectionId.trim(), 10);
    if (isNaN(id) || id <= 0) {
      alert('Por favor ingrese un número de inspección válido.');
      return;
    }

    try {
      if (format === 'pdf') {
        setDownloadingCustomPdf(true);
        const blob = await apiService.downloadInspectionPDF(id);
        triggerBlobDownload(blob, `Acta_Inspeccion_${id}.pdf`);
      } else {
        setDownloadingCustomExcel(true);
        const blob = await apiService.downloadInspectionExcel(id);
        triggerBlobDownload(blob, `Inspeccion_${id}.xlsx`);
      }
    } catch (err: any) {
      console.error('Error descargando reporte de inspección:', err);
      alert(`No se encontró la inspección #${id} o ocurrió un error al procesar el archivo.`);
    } finally {
      setDownloadingCustomPdf(false);
      setDownloadingCustomExcel(false);
    }
  };

  const handleDownloadAssetHistoryPdf = async (assetId: number, tagCode: string) => {
    try {
      const blob = await apiService.downloadAssetHistoryPDF(assetId);
      triggerBlobDownload(blob, `Historial_${tagCode}.pdf`);
    } catch (err) {
      console.error('Error descargando historial de activo:', err);
      alert('No se pudo descargar el informe histórico del activo.');
    }
  };

  if (loading && !executiveData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-[var(--ink-soft)]">
          Cargando motor de reportes y análisis normativo...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Topbar: Título y Acciones Globales de Exportación */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] m-0 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--accent)]" />
            <span>Motor de Reportes y Auditoría Normativa</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-soft)] mt-1">
            Generación automática de informes técnicos estructurados bajo Res. MSAL 1130/2000 e ISO 7396-1:2016
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            title="Informe Ejecutivo PDF"
            variant="primary"
            size="sm"
            icon={<FileDown className="w-4 h-4" />}
            onClick={handleDownloadExecutivePdf}
            loading={downloadingExecPdf}
          />
          <Button
            title="Exportar Excel"
            variant="outline"
            size="sm"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={handleDownloadExecutiveExcel}
            loading={downloadingExecExcel}
          />
          <button
            type="button"
            onClick={loadInitialData}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
            title="Refrescar datos"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-[var(--warn)] bg-[var(--warn-soft)] flex items-center gap-2 text-xs font-semibold text-[var(--ink)]">
          <AlertCircle className="w-4 h-4 text-[var(--warn)] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selector de Establecimiento si hay más de 1 */}
      {hospitals.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[var(--ink-faint)]" />
          <span className="text-xs font-bold text-[var(--ink-soft)]">Establecimiento:</span>
          <select
            value={selectedHospitalId || ''}
            onChange={(e) => setSelectedHospitalId(Number(e.target.value))}
            className="text-xs font-semibold py-1.5 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] outline-none cursor-pointer"
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Banda de KPIs Principales (Stat Strip) */}
      {executiveData && (
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Cumplimiento Global</span>
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value text-[var(--ok)]">
                {executiveData.global_compliance_percentage}%
              </span>
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">conforme</span>
            </div>
          </div>

          <div className="stat">
            <span className="stat-label">Activos Monitoreados</span>
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value">
                {executiveData.active_assets}
              </span>
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                / {executiveData.total_assets}
              </span>
            </div>
          </div>

          <div className="stat">
            <span className="stat-label">Auditorías Cerradas</span>
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value text-[var(--accent)]">
                {executiveData.completed_inspections}
              </span>
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">
                ({executiveData.in_progress_inspections} en curso)
              </span>
            </div>
          </div>

          <div className="stat">
            <span className="stat-label">Desvíos Críticos (Nivel 1)</span>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "stat-value",
                (executiveData.severity_distribution.CRITICAL || 0) > 0 ? "text-[var(--warn)]" : "text-[var(--ok)]"
              )}>
                {executiveData.severity_distribution.CRITICAL || 0}
              </span>
              <span className="text-[11px] font-semibold text-[var(--ink-faint)]">desvíos activos</span>
            </div>
          </div>
        </div>
      )}

      {/* Generadores Rápidos de Reportes (3 Tarjetas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tarjeta 1: Acta de Inspección por ID */}
        <Card className="flex flex-col justify-between gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--primary-soft,var(--accent-soft))] flex items-center justify-center text-[var(--accent)]">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[var(--ink)]">Acta de Inspección Técnica</span>
            </div>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed m-0">
              Genera el acta oficial firmada con dictamen normativo, tabla de tolerancias y desvíos para un ID específico.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
            <Input
              placeholder="N° Inspección (ej: 1)"
              value={customInspectionId}
              onChangeText={setCustomInspectionId}
            />
            <div className="flex gap-2">
              <Button
                title="Descargar PDF"
                variant="primary"
                size="sm"
                className="flex-1"
                icon={<FileDown className="w-3.5 h-3.5" />}
                onClick={() => handleDownloadCustomInspection('pdf')}
                loading={downloadingCustomPdf}
              />
              <Button
                title="Excel"
                variant="outline"
                size="sm"
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={() => handleDownloadCustomInspection('excel')}
                loading={downloadingCustomExcel}
              />
            </div>
          </div>
        </Card>

        {/* Tarjeta 2: Informe Ejecutivo Institucional */}
        <Card className="flex flex-col justify-between gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--ok-soft)] flex items-center justify-center text-[var(--ok)]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[var(--ink)]">Auditoría Global Institucional</span>
            </div>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed m-0">
              Informe gerencial consolidado para Dirección Médica: cumplimiento por sector, ranking de no conformidades y métricas globales.
            </p>
          </div>

          <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
            <Button
              title="Descargar PDF"
              variant="outline"
              size="sm"
              className="flex-1"
              icon={<FileDown className="w-3.5 h-3.5" />}
              onClick={handleDownloadExecutivePdf}
              loading={downloadingExecPdf}
            />
            <Button
              title="Exportar XLSX"
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              onClick={handleDownloadExecutiveExcel}
              loading={downloadingExecExcel}
            />
          </div>
        </Card>

        {/* Tarjeta 3: Catálogo Histórico de Inspecciones */}
        <Card className="flex flex-col justify-between gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--warn-soft)] flex items-center justify-center text-[var(--warn)]">
                <Clock className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-[var(--ink)]">Historial por Componente</span>
            </div>
            <p className="text-xs text-[var(--ink-soft)] leading-relaxed m-0">
              Consulta la línea de tiempo de auditorías pasadas, fotos de no conformidades previas y evolución técnica en el catálogo.
            </p>
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <Button
              title="Ver Registro de Inspecciones"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => navigate('/inspections')}
            />
          </div>
        </Card>
      </div>

      {/* Grilla de Gráficos Analíticos (Recharts) */}
      {executiveData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Gráfico 1: Cumplimiento por Sector */}
          <Card className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-baseline pb-2 border-b border-[var(--border)]">
              <span className="font-bold text-sm text-[var(--ink)]">
                Cumplimiento Normativo por Sector Clínico
              </span>
              <span className="text-xs text-[var(--ink-soft)]">
                {executiveData.sector_stats.length} sectores
              </span>
            </div>
            <SectorComplianceChart data={executiveData.sector_stats} />
          </Card>

          {/* Gráfico 2: Distribución de Severidades */}
          <Card className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-baseline pb-2 border-b border-[var(--border)]">
              <span className="font-bold text-sm text-[var(--ink)]">
                Distribución de Severidad de Desvíos
              </span>
              <span className="text-xs text-[var(--ink-soft)]">
                Clasificación STPA
              </span>
            </div>
            <SeverityPieChart distribution={executiveData.severity_distribution} />
          </Card>

          {/* Gráfico 3: Cumplimiento por Tipo de Activo */}
          <Card className="p-4 flex flex-col gap-2 lg:col-span-2">
            <div className="flex justify-between items-baseline pb-2 border-b border-[var(--border)]">
              <span className="font-bold text-sm text-[var(--ink)]">
                Cumplimiento por Familia de Componente
              </span>
              <span className="text-xs text-[var(--ink-soft)]">
                Manifolds, AVSU, Bocas Terminales, Reguladores, Cilindros
              </span>
            </div>
            <AssetTypeComplianceChart data={executiveData.asset_type_stats} />
          </Card>
        </div>
      )}

      {/* Tabla de Activos con Mayor Riesgo de No Conformidad */}
      {executiveData && executiveData.top_risk_assets.length > 0 && (
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <div>
              <span className="font-bold text-sm text-[var(--ink)]">
                Componentes con Mayor Índice de No Conformidad
              </span>
              <p className="text-xs text-[var(--ink-soft)] m-0">
                Prioridad de mantenimiento preventivo y adecuación normativa reglamentaria
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--ink-faint)] uppercase font-semibold">
                  <th className="py-2 px-3">TAG</th>
                  <th className="py-2 px-3">Componente</th>
                  <th className="py-2 px-3">Sector</th>
                  <th className="py-2 px-3 text-center">Desvíos Críticos</th>
                  <th className="py-2 px-3 text-center">Total No Conforme</th>
                  <th className="py-2 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {executiveData.top_risk_assets.map((item) => (
                  <tr key={item.asset_id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[var(--accent)]">
                      {item.tag_code}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[var(--ink)]">
                      {item.asset_name}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--ink-soft)]">
                      {item.sector_name}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded font-bold text-[11px]",
                        item.critical_count > 0 ? "bg-[var(--critical-soft,#fef2f2)] text-[var(--critical,#b91c1c)]" : "text-[var(--ink-faint)]"
                      )}>
                        {item.critical_count}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-[var(--warn)]">
                      {item.non_compliant_count}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        title="Historial PDF"
                        variant="ghost"
                        size="sm"
                        icon={<FileDown className="w-3.5 h-3.5" />}
                        onClick={() => handleDownloadAssetHistoryPdf(item.asset_id, item.tag_code)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Actas de Inspección Recientes Listas para Descarga */}
      {recentCompleted.length > 0 && (
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <span className="font-bold text-sm text-[var(--ink)]">
              Últimas Actas de Inspección Cerradas y Selladas
            </span>
            <span className="text-xs text-[var(--ink-soft)]">
              Listas para firma y archivo legal
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentCompleted.map((insp) => (
              <div
                key={insp.id}
                className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] flex flex-col justify-between gap-2.5 hover:border-[var(--accent)] transition-colors"
              >
                <div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-mono font-bold text-[var(--accent-strong)]">
                      {insp.asset?.tag_code}
                    </span>
                    <span className="text-[var(--ink-faint)]">
                      #{insp.id}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[var(--ink)] line-clamp-1 mt-1">
                    {insp.asset?.name}
                  </div>
                  <div className="text-[11px] text-[var(--ink-soft)]">
                    {insp.completed_at ? new Date(insp.completed_at).toLocaleDateString() : ''} · {insp.inspector_name}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border)]">
                  <Button
                    title="PDF"
                    variant="primary"
                    size="sm"
                    className="flex-1 text-[11px]"
                    icon={<FileDown className="w-3 h-3" />}
                    onClick={async () => {
                      const blob = await apiService.downloadInspectionPDF(insp.id);
                      triggerBlobDownload(blob, `Acta_${insp.id}_${insp.asset?.tag_code || 'TAG'}.pdf`);
                    }}
                  />
                  <Button
                    title="Excel"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-[11px]"
                    icon={<FileSpreadsheet className="w-3 h-3" />}
                    onClick={async () => {
                      const blob = await apiService.downloadInspectionExcel(insp.id);
                      triggerBlobDownload(blob, `Inspeccion_${insp.id}_${insp.asset?.tag_code || 'TAG'}.xlsx`);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
