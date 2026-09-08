import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Lock,
  X,
  Send,
} from 'lucide-react-native';
import { apiService } from '../../services/api';
import {
  InspectionDetail,
  InspectionResponse,
  ChecklistItem,
} from '../../services/types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ChecklistCard } from '../../components/checklist/ChecklistCard';
import { AutoSaveIndicator, SaveStatus } from '../../components/checklist/AutoSaveIndicator';
import { useComplianceValidation } from '../../hooks/useComplianceValidation';
import { ComplianceAlertBanner } from '../../components/checklist/ComplianceAlertBanner';
import { ComplianceSummaryCard } from '../../components/checklist/ComplianceSummaryCard';
import { NormativeStatusIndicator } from '../../components/checklist/NormativeStatusIndicator';


export default function InspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const inspectionId = parseInt(id || '0', 10);

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [responsesMap, setResponsesMap] = useState<Record<number, Partial<InspectionResponse>>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de auto-guardado en segundo plano (debounce)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Estados del modal de cierre y firma
  const [completeModalVisible, setCompleteModalVisible] = useState<boolean>(false);
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

      // Inicializar mapa de respuestas locales
      const map: Record<number, Partial<InspectionResponse>> = {};
      data.responses.forEach((r) => {
        map[r.item_id] = { ...r };
      });
      setResponsesMap(map);
    } catch (err: any) {
      console.error('Error cargando inspección:', err);
      setError('No se pudo cargar el detalle de la inspección. Verifique que el servidor esté activo.');
    } finally {
      setLoading(false);
    }
  };

  // Función de sincronización en segundo plano con debounce
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
      }, 700); // 700ms debounce
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

  // Validar si todos los ítems obligatorios están completos
  const validateMandatoryFields = (): string[] => {
    if (!inspection || !inspection.template) return [];
    const missing: string[] = [];

    inspection.template.items.forEach((item) => {
      if (item.is_mandatory) {
        const resp = responsesMap[item.id];
        const isFilled =
          resp &&
          (resp.val_boolean !== undefined && resp.val_boolean !== null ||
            resp.val_numeric !== undefined && resp.val_numeric !== null ||
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
    setCompleteModalVisible(true);
  };

  const handleConfirmCompleteInspection = async () => {
    const missing = validateMandatoryFields();
    if (missing.length > 0) {
      setValidationErrors(missing);
      return;
    }

    try {
      setCompleting(true);
      // Guardar cualquier cambio pendiente antes de completar
      const payloadList = Object.entries(responsesMap).map(([itemIdStr, resp]) => ({
        item_id: parseInt(itemIdStr, 10),
        val_boolean: resp.val_boolean,
        val_numeric: resp.val_numeric,
        val_text: resp.val_text,
        observations: resp.observations,
      }));
      await apiService.saveBatchResponses(inspectionId, { responses: payloadList });

      // Completar inspección
      const completed = await apiService.completeInspection(inspectionId, {
        notes: closingNotes.trim() || undefined,
      });

      setInspection(completed);
      setCompleteModalVisible(false);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error cerrando inspección:', err);
      const detailMsg = err.response?.data?.detail?.message || 'Error al completar la inspección.';
      alert(detailMsg);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Cargando protocolo de inspección digital...</Text>
      </View>
    );
  }

  if (error || !inspection) {
    return (
      <View style={styles.centerContainer}>
        <AlertTriangle size={36} color="#e11d48" />
        <Text style={styles.errorTitle}>Error al cargar</Text>
        <Text style={styles.errorSub}>{error || 'Inspección no encontrada'}</Text>
        <Button title="Volver al Panel" variant="outline" onPress={() => router.push('/dashboard')} />
      </View>
    );
  }

  const isCompleted = inspection.status === 'COMPLETED';
  const totalItems = inspection.template?.items.length || 0;
  const answeredCount = Object.values(responsesMap).filter(
    (r) =>
      r.val_boolean !== undefined && r.val_boolean !== null ||
      r.val_numeric !== undefined && r.val_numeric !== null ||
      (r.val_text && r.val_text.trim() !== '')
  ).length;
  const currentProgress = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;

  // Validación de cumplimiento normativo algorítmica en tiempo real
  const complianceEvaluation = useComplianceValidation(
    inspection.template?.items || [],
    responsesMap
  );

  return (

    <View style={styles.screenWrapper}>
      {/* Sticky Header de la Inspección con Progreso y Auto-Save */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/dashboard')}
            style={styles.backButton}
          >
            <ArrowLeft size={18} color="#2563eb" />
            <Text style={styles.backButtonText}>Panel</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {inspection.asset?.name || 'Activo Clínico'}
            </Text>
            <View style={styles.headerTags}>
              <Badge label={inspection.asset?.tag_code || 'TAG'} variant="slate" size="sm" />
              <Badge
                label={isCompleted ? 'Finalizada' : 'En Curso'}
                variant={isCompleted ? 'emerald' : 'amber'}
                size="sm"
              />
              <NormativeStatusIndicator templateId={inspection.template_id} />
            </View>

          </View>

          <View style={styles.headerRightActions}>
            <AutoSaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
            {!isCompleted && (
              <Button
                title="Cerrar y Firmar"
                variant="success"
                size="sm"
                icon={<FileCheck2 size={16} color="#ffffff" />}
                onPress={handleOpenCompleteModal}
              />
            )}
          </View>
        </View>

        {/* Barra de Progreso */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={currentProgress} showLabel={false} height={6} />
          <View style={styles.progressTextRow}>
            <Text style={styles.progressCount}>
              {answeredCount} de {totalItems} ítems evaluados
            </Text>
            <Text style={styles.progressPercent}>{Math.round(currentProgress)}%</Text>
          </View>
        </View>
      </View>

      {/* Contenido Principal de Checklist */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {/* Banner de Inspección Cerrada */}
        {isCompleted && (
          <Card style={styles.completedBanner}>
            <View style={styles.completedBannerHeader}>
              <Lock size={20} color="#059669" />
              <Text style={styles.completedBannerTitle}>
                Inspección Finalizada y Auditada
              </Text>
            </View>
            <Text style={styles.completedBannerBody}>
              Esta auditoría técnica se encuentra cerrada y firmada por{' '}
              <Text style={{ fontWeight: '700' }}>{inspection.inspector_name}</Text> el{' '}
              {inspection.completed_at
                ? new Date(inspection.completed_at).toLocaleString()
                : 'Recientemente'}
              . Los registros se encuentran preservados para fines de trazabilidad normativa.
            </Text>
          </Card>
        )}

        {/* Datos Técnicos de Cabecera */}
        <Card style={styles.metaCard}>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>PLANTILLA NORMATIVA</Text>
              <Text style={styles.metaValue}>{inspection.template?.title}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>AUDITOR / BIOINGENIERO</Text>
              <Text style={styles.metaValue}>{inspection.inspector_name}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>FECHA DE INICIO</Text>
              <Text style={styles.metaValue}>
                {new Date(inspection.started_at).toLocaleString()}
              </Text>
            </View>
          </View>
          {inspection.notes && (
            <View style={styles.metaNotesBox}>
              <Text style={styles.metaNotesLabel}>Notas de inicio:</Text>
              <Text style={styles.metaNotesText}>{inspection.notes}</Text>
            </View>
          )}
        </Card>

        {/* Banner de Alerta de Compliance en Tiempo Real */}
        <ComplianceAlertBanner
          nonCompliantCount={complianceEvaluation.nonCompliantCount}
          criticalCount={complianceEvaluation.criticalCount}
          warningCount={complianceEvaluation.warningCount}
        />

        {/* Lista de Ítems del Checklist */}
        <View style={styles.checklistSection}>
          <Text style={styles.sectionHeading}>PUNTOS DE VERIFICACIÓN TÉCNICA</Text>

          {inspection.template?.items.map((item) => (
            <ChecklistCard
              key={item.id}
              item={item}
              response={responsesMap[item.id] as InspectionResponse}
              onUpdateResponse={handleUpdateResponse}
              disabled={isCompleted}
            />
          ))}
        </View>

        {/* Tarjeta Resumen de Cumplimiento Legal y Auditoría */}
        <ComplianceSummaryCard summary={complianceEvaluation} />

        {/* Botón de Cierre al Pie */}
        {!isCompleted && (
          <View style={styles.bottomCtaContainer}>
            <Button
              title="Finalizar y Firmar Inspección Digital"
              variant="success"
              size="lg"
              icon={<FileCheck2 size={20} color="#ffffff" />}
              onPress={handleOpenCompleteModal}
            />
          </View>
        )}

      </ScrollView>

      {/* Modal de Finalización y Firma de Auditoría */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={completeModalVisible}
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cierre y Firma de Inspección</Text>
              <TouchableOpacity onPress={() => setCompleteModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {validationErrors.length > 0 ? (
              <View style={styles.validationErrorBox}>
                <View style={styles.validationErrorHeader}>
                  <AlertTriangle size={18} color="#e11d48" />
                  <Text style={styles.validationErrorTitle}>
                    Faltan responder {validationErrors.length} ítem(s) obligatorio(s):
                  </Text>
                </View>
                <ScrollView style={styles.validationList}>
                  {validationErrors.map((err, idx) => (
                    <Text key={idx} style={styles.validationItemText}>
                      • {err}
                    </Text>
                  ))}
                </ScrollView>
                <Text style={styles.validationHelp}>
                  Por favor complete todos los puntos marcados como obligatorios antes de cerrar el protocolo.
                </Text>
              </View>
            ) : (
              <View style={styles.confirmBox}>
                <CheckCircle size={24} color="#10b981" />
                <Text style={styles.confirmTitle}>
                  Todos los puntos obligatorios han sido verificados.
                </Text>
                <Text style={styles.confirmText}>
                  Al completar, la inspección quedará bloqueada en estado Conforme/Auditada.
                </Text>
              </View>
            )}

            <Input
              label="Observaciones Generales de Cierre (Opcional)"
              value={closingNotes}
              onChangeText={setClosingNotes}
              placeholder="Ej: Todo el sistema operativo conforme a normativa. Se programó mantenimiento preventivo de racor."
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Volver"
                variant="secondary"
                onPress={() => setCompleteModalVisible(false)}
                disabled={completing}
              />
              <Button
                title="Confirmar y Firmar"
                variant="success"
                icon={<FileCheck2 size={16} color="#ffffff" />}
                onPress={handleConfirmCompleteInspection}
                disabled={validationErrors.length > 0}
                loading={completing}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e11d48',
  },
  errorSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  stickyHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 200,
    gap: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerTags: {
    flexDirection: 'row',
    gap: 6,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressContainer: {
    gap: 4,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  completedBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    gap: 6,
  },
  completedBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
  },
  completedBannerBody: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
  metaCard: {
    padding: 16,
    gap: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaNotesBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 2,
  },
  metaNotesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  metaNotesText: {
    fontSize: 12,
    color: '#334155',
  },
  checklistSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bottomCtaContainer: {
    marginVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  validationErrorBox: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  validationErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validationErrorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#be123c',
  },
  validationList: {
    maxHeight: 120,
  },
  validationItemText: {
    fontSize: 12,
    color: '#9f1239',
    lineHeight: 18,
  },
  validationHelp: {
    fontSize: 11,
    color: '#be123c',
    fontStyle: 'italic',
  },
  confirmBox: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
});
