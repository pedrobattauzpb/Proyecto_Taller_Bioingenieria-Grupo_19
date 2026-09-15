import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Lock,
  X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiService } from '../services/api';
import type {
  InspectionDetail,
  InspectionResponse,
  InspectionEvidence,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ChecklistCard } from '../components/checklist/ChecklistCard';
import { AutoSaveIndicator, type SaveStatus } from '../components/checklist/AutoSaveIndicator';
import { useComplianceValidation } from '../hooks/useComplianceValidation';
import { ComplianceAlertBanner } from '../components/checklist/ComplianceAlertBanner';
import { ComplianceSummaryCard } from '../components/checklist/ComplianceSummaryCard';
import { NormativeStatusIndicator } from '../components/checklist/NormativeStatusIndicator';
import { EvidenceThumbnail } from '../components/checklist/EvidenceThumbnail';
import { MediaUploader } from '../components/checklist/MediaUploader';

export const InspectionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inspectionId = parseInt(id || '0', 10);

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [responsesMap, setResponsesMap] = useState<Record<number, Partial<InspectionResponse>>>({});
  const [evidences, setEvidences] = useState<InspectionEvidence[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-save state (debounce)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal de cierre
  const [completeModalOpen, setCompleteModalOpen] = useState<boolean>(false);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [completing, setCompleting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (inspectionId > 0) {
      loadInspection();
    }
  }, [inspectionId]);

  const loadInspection = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getInspection(inspectionId);
      setInspection(data);
      setEvidences(data.evidences || []);

      const map: Record<number, Partial<InspectionResponse>> = {};
      data.responses.forEach((r) => {
        map[r.item_id] = { ...r };
      });
      setResponsesMap(map);
    } catch (err: any) {
      console.error('Error cargando inspección:', err);
      setError('No se pudo cargar el detalle de la inspección. Verifique la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadEvidence = (newEvidence: InspectionEvidence) => {
    setEvidences((prev) => [newEvidence, ...prev]);
    if (inspection) {
      setInspection({
        ...inspection,
        evidences: [newEvidence, ...(inspection.evidences || [])],
      });
    }
  };

  const handleDeleteEvidence = async (evidenceId: number) => {
    try {
      await apiService.deleteEvidence(evidenceId);
      setEvidences((prev) => prev.filter((e) => e.id !== evidenceId));
      if (inspection) {
        setInspection({
          ...inspection,
          evidences: (inspection.evidences || []).filter((e) => e.id !== evidenceId),
        });
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'No se pudo eliminar la evidencia.';
      window.alert(`Error: ${detail}`);
      throw err;
    }
  };

  const triggerAutoSave = useCallback(
    (currentMap: Record<number, Partial<InspectionResponse>>) => {
      if (inspection?.status === 'COMPLETED') return;

      setSaveStatus('saving');
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const payloadList = Object.entries(currentMap).map(([itemIdStr, resp]) => ({
            item_id: parseInt(itemIdStr, 10),
            val_boolean: resp.val_boolean,
            val_numeric: resp.val_numeric,
            val_text: resp.val_text,
            observations: resp.observations,
          }));

          const updated = await apiService.saveBatchResponses(inspectionId, {
            responses: payloadList,
          });

          setInspection(updated);
          setSaveStatus('saved');
          setLastSavedAt(new Date());
        } catch (err) {
          console.error('Error en auto-guardado:', err);
          setSaveStatus('error');
        }
      }, 700);
    },
    [inspectionId, inspection?.status]
  );

  const handleUpdateResponse = (itemId: number, updates: Partial<InspectionResponse>) => {
    if (inspection?.status === 'COMPLETED') return;

    setResponsesMap((prev) => {
      const next = {
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { item_id: itemId }),
          ...updates,
        },
      };
      triggerAutoSave(next);
      return next;
    });
  };

  const validateMandatoryFields = (): string[] => {
    if (!inspection || !inspection.template) return [];
    const missing: string[] = [];

    inspection.template.items.forEach((item) => {
      if (item.is_mandatory) {
        const resp = responsesMap[item.id];
        const isFilled =
          resp &&
          ((resp.val_boolean !== undefined && resp.val_boolean !== null) ||
            (resp.val_numeric !== undefined && resp.val_numeric !== null) ||
            (resp.val_text !== undefined && resp.val_text !== null && resp.val_text.trim() !== ''));

        if (!isFilled) {
          missing.push(`[${item.code}] ${item.title}`);
        }
      }
    });

    return missing;
  };

  const handleOpenCompleteModal = () => {
    const missing = validateMandatoryFields();
    setValidationErrors(missing);
    setCompleteModalOpen(true);
  };

  const handleConfirmCompleteInspection = async () => {
    const missing = validateMandatoryFields();
    if (missing.length > 0) {
      setValidationErrors(missing);
      return;
    }

    try {
      setCompleting(true);
      const payloadList = Object.entries(responsesMap).map(([itemIdStr, resp]) => ({
        item_id: parseInt(itemIdStr, 10),
        val_boolean: resp.val_boolean,
        val_numeric: resp.val_numeric,
        val_text: resp.val_text,
        observations: resp.observations,
      }));
      await apiService.saveBatchResponses(inspectionId, { responses: payloadList });

      const completed = await apiService.completeInspection(inspectionId, {
        notes: closingNotes.trim() || undefined,
      });

      setInspection(completed);
      setCompleteModalOpen(false);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error cerrando inspección:', err);
      const detailMsg = err.response?.data?.detail?.message || 'Error al completar la inspección.';
      window.alert(detailMsg);
    } finally {
      setCompleting(false);
    }
  };

  const complianceEvaluation = useComplianceValidation(
    inspection?.template?.items || [],
    responsesMap
  );

  if (loading) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Cargando protocolo de inspección digital...</p>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <Card className="p-12 text-center flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-600" />
        <h3 className="text-base font-bold text-slate-900">Error al cargar inspección</h3>
        <p className="text-xs text-slate-500">{error || 'Inspección no encontrada'}</p>
        <Button title="Volver al Panel" variant="outline" onClick={() => navigate('/dashboard')} />
      </Card>
    );
  }

  const isCompleted = inspection.status === 'COMPLETED';
  const totalItems = inspection.template?.items.length || 0;
  const answeredCount = Object.values(responsesMap).filter(
    (r) =>
      (r.val_boolean !== undefined && r.val_boolean !== null) ||
      (r.val_numeric !== undefined && r.val_numeric !== null) ||
      (r.val_text && r.val_text.trim() !== '')
  ).length;
  const currentProgress = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky Header de la Inspección con Progreso y Auto-Save */}
      <div className="sticky top-16 bg-white/95 backdrop-blur-xs z-20 border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              title="Panel"
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/dashboard')}
            />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 m-0">
                  {inspection.asset?.name || 'Activo Clínico'}
                </h3>
                <Badge label={inspection.asset?.tag_code || 'TAG'} variant="slate" size="sm" />
                <Badge
                  label={isCompleted ? 'Finalizada' : 'En Curso'}
                  variant={isCompleted ? 'emerald' : 'amber'}
                  size="sm"
                />
                <NormativeStatusIndicator templateId={inspection.template_id} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <AutoSaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
            {!isCompleted && (
              <Button
                title="Cerrar y Firmar"
                variant="success"
                size="sm"
                icon={<FileCheck2 className="w-4 h-4" />}
                onClick={handleOpenCompleteModal}
              />
            )}
          </div>
        </div>

        {/* Barra de Progreso */}
        <div className="flex flex-col gap-1.5">
          <ProgressBar progress={currentProgress} showLabel={false} height={6} />
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
            <span>
              {answeredCount} de {totalItems} ítems evaluados
            </span>
            <span>{Math.round(currentProgress)}%</span>
          </div>
        </div>
      </div>

      {/* Banner de Inspección Cerrada */}
      {isCompleted && (
        <Card className="p-4 bg-emerald-50 border-emerald-200 text-emerald-950 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Inspección Finalizada y Auditada</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed m-0">
            Esta auditoría técnica se encuentra cerrada y sellada por{' '}
            <strong className="text-slate-800">{inspection.inspector_name}</strong> el{' '}
            {inspection.completed_at
              ? new Date(inspection.completed_at).toLocaleString()
              : 'Recientemente'}
            . Los registros son inmutables para garantizar trazabilidad legal.
          </p>
        </Card>
      )}

      {/* Datos Técnicos de Cabecera */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              PLANTILLA NORMATIVA
            </span>
            <span className="font-bold text-slate-800 text-sm">{inspection.template?.title}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              AUDITOR / BIOINGENIERO
            </span>
            <span className="font-bold text-slate-800 text-sm">{inspection.inspector_name}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              FECHA DE INICIO
            </span>
            <span className="font-bold text-slate-800 text-sm">
              {new Date(inspection.started_at).toLocaleString()}
            </span>
          </div>
        </div>

        {inspection.notes && (
          <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-600">Notas de inicio: </span>
            <span className="text-slate-700">{inspection.notes}</span>
          </div>
        )}
      </Card>

      {/* Banner de Alerta de Compliance en Tiempo Real */}
      <ComplianceAlertBanner
        nonCompliantCount={complianceEvaluation.nonCompliantCount}
        criticalCount={complianceEvaluation.criticalCount}
        warningCount={complianceEvaluation.warningCount}
      />

      {/* Lista de Ítems del Checklist */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          PUNTOS DE VERIFICACIÓN TÉCNICA
        </span>

        {inspection.template?.items.map((item) => (
          <ChecklistCard
            key={item.id}
            item={item}
            response={responsesMap[item.id] as InspectionResponse}
            evidences={evidences.filter((e) => e.item_id === item.id)}
            inspectionId={inspection.id}
            inspectorName={inspection.inspector_name}
            onUpdateResponse={handleUpdateResponse}
            onUploadEvidence={handleUploadEvidence}
            onDeleteEvidence={handleDeleteEvidence}
            disabled={isCompleted}
          />
        ))}
      </div>

      {/* Sección de Evidencia Multimedia General */}
      <Card className="p-5 flex flex-col gap-3">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-slate-900 m-0">
            Evidencia Multimedia General
          </h4>
          <p className="text-xs text-slate-500 m-0">
            Fotografías o videos panorámicos del área, estado físico o entorno del activo
          </p>
        </div>

        {evidences.filter((e) => !e.item_id).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {evidences
              .filter((e) => !e.item_id)
              .map((ev) => (
                <EvidenceThumbnail
                  key={ev.id}
                  evidence={ev}
                  onDelete={handleDeleteEvidence}
                  disabled={isCompleted}
                />
              ))}
          </div>
        )}

        {!isCompleted && (
          <div className="pt-1">
            <MediaUploader
              inspectionId={inspection.id}
              inspectorName={inspection.inspector_name}
              disabled={isCompleted}
              onEvidenceUploaded={handleUploadEvidence}
            />
          </div>
        )}
      </Card>

      {/* Resumen Ejecutivo de Compliance */}
      <ComplianceSummaryCard summary={complianceEvaluation} />

      {/* Modal de Cierre y Firma */}
      <Dialog.Root open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 animate-in fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-50 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <Dialog.Title className="text-base font-bold text-slate-900">
                  Completar y Sellar Inspección
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            {validationErrors.length > 0 ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Ítems Obligatorios Faltantes</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  No se puede cerrar la inspección. Los siguientes puntos normativos obligatorios requieren respuesta:
                </p>
                <ul className="list-disc pl-5 text-xs text-rose-800 space-y-1 mt-1">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Todos los ítems obligatorios han sido respondidos. Al confirmar, la inspección cambiará a estado{' '}
                  <strong className="text-emerald-700">COMPLETADA</strong> y quedará sellada para auditoría inmutable.
                </p>

                <Input
                  label="Observaciones Finales / Notas de Cierre"
                  value={closingNotes}
                  onChangeText={setClosingNotes}
                  placeholder="Ej: Todo en regla. Cilindros con prueba hidráulica vigente. Red presurizada conforme a norma."
                  multiline
                  numberOfLines={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-1">
              <Button
                title="Cancelar"
                variant="secondary"
                onClick={() => setCompleteModalOpen(false)}
                disabled={completing}
              />
              <Button
                title="Confirmar y Sellar"
                variant="success"
                icon={<FileCheck2 className="w-4 h-4" />}
                onClick={handleConfirmCompleteInspection}
                disabled={validationErrors.length > 0 || completing}
                loading={completing}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};
