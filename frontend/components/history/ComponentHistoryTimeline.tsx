import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Calendar,
  User,
  Image as ImageIcon,
  ChevronRight,
  RotateCw,
} from 'lucide-react-native';
import { apiService } from '../../services/api';
import { InspectionHistoryItem } from '../../services/types';
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
    // Intentar borrar en backend y refrescar historial
    await apiService.deleteEvidence(evidenceId);
    await loadHistory();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Cargando historial técnico del componente...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <Card style={styles.centerContainer}>
        <AlertTriangle size={32} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Reintentar" variant="outline" size="sm" onPress={loadHistory} />
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card style={styles.centerContainer}>
        <FileCheck2 size={36} color="#94a3b8" />
        <Text style={styles.emptyTitle}>Sin historial de inspecciones</Text>
        <Text style={styles.emptySubtitle}>
          Este activo aún no tiene listas de verificación registradas en el sistema centralizado.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header del Historial */}
      <View style={styles.timelineHeader}>
        <View>
          <Text style={styles.headerTitle}>
            Historial de Inspecciones {assetTag ? `(${assetTag})` : ''}
          </Text>
          <Text style={styles.headerSubtitle}>
            {assetName || 'Activo Clínico'} • {history.length}{' '}
            {history.length === 1 ? 'inspección registrada' : 'inspecciones registradas'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={loadHistory}
          style={styles.refreshBtn}
          accessibilityLabel="Refrescar historial"
        >
          <RotateCw size={16} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* Lista Cronológica tipo Línea de Tiempo */}
      <View style={styles.timelineList}>
        {history.map((item, index) => {
          const isCompleted = item.status === 'COMPLETED';
          const hasDeviations = item.non_compliant_count > 0;
          const isLast = index === history.length - 1;

          return (
            <View key={item.id} style={styles.timelineNode}>
              {/* Columna Izquierda: Punto e Hilo conductor */}
              <View style={styles.nodeLeft}>
                <View
                  style={[
                    styles.nodeDot,
                    isCompleted
                      ? hasDeviations
                        ? styles.dotWarning
                        : styles.dotSuccess
                      : styles.dotInProgress,
                  ]}
                >
                  {isCompleted ? (
                    hasDeviations ? (
                      <AlertTriangle size={12} color="#ffffff" />
                    ) : (
                      <CheckCircle2 size={12} color="#ffffff" />
                    )
                  ) : (
                    <Clock size={12} color="#ffffff" />
                  )}
                </View>
                {!isLast && <View style={styles.nodeLine} />}
              </View>

              {/* Columna Derecha: Tarjeta de Inspección */}
              <View style={styles.nodeCardWrapper}>
                <Card style={styles.nodeCard}>
                  {/* Encabezado del nodo */}
                  <View style={styles.nodeCardHeader}>
                    <View style={styles.nodeCardMeta}>
                      <Badge label={`#${item.id}`} variant="slate" size="sm" />
                      <Text style={styles.nodeTemplateTitle} numberOfLines={1}>
                        {item.template_title}
                      </Text>
                    </View>
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
                  </View>

                  {/* Datos del auditor y fecha */}
                  <View style={styles.nodeInfoRow}>
                    <View style={styles.nodeInfoItem}>
                      <Calendar size={13} color="#64748b" />
                      <Text style={styles.nodeInfoText}>
                        {new Date(item.started_at).toLocaleDateString()}
                      </Text>
                    </View>

                    <View style={styles.nodeInfoItem}>
                      <User size={13} color="#64748b" />
                      <Text style={styles.nodeInfoText}>{item.inspector_name}</Text>
                    </View>
                  </View>

                  {/* Estado Normativo y Desvíos */}
                  <View style={styles.complianceRow}>
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
                  </View>

                  {/* Notas de Cierre */}
                  {item.notes && (
                    <Text style={styles.nodeNotes} numberOfLines={2}>
                      «{item.notes}»
                    </Text>
                  )}

                  {/* Evidencias Multimedia Asociadas */}
                  {item.evidences && item.evidences.length > 0 && (
                    <View style={styles.evidencesSection}>
                      <View style={styles.evidencesHeader}>
                        <ImageIcon size={13} color="#475569" />
                        <Text style={styles.evidencesCountText}>
                          {item.evidences.length}{' '}
                          {item.evidences.length === 1
                            ? 'evidencia adjunta'
                            : 'evidencias adjuntas'}
                        </Text>
                      </View>
                      <View style={styles.evidencesList}>
                        {item.evidences.map((ev) => (
                          <EvidenceThumbnail
                            key={ev.id}
                            evidence={ev}
                            onDelete={handleEvidenceDeleted}
                            disabled={isCompleted}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Botón de inspección detallada */}
                  {onSelectInspection && (
                    <TouchableOpacity
                      style={styles.viewDetailBtn}
                      onPress={() => onSelectInspection(item.id)}
                    >
                      <Text style={styles.viewDetailBtnText}>Ver Inspección Completa</Text>
                      <ChevronRight size={14} color="#2563eb" />
                    </TouchableOpacity>
                  )}
                </Card>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineNode: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  nodeLeft: {
    alignItems: 'center',
    width: 28,
    marginRight: 10,
  },
  nodeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  dotSuccess: {
    backgroundColor: '#10b981',
  },
  dotWarning: {
    backgroundColor: '#ef4444',
  },
  dotInProgress: {
    backgroundColor: '#f59e0b',
  },
  nodeLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#cbd5e1',
    marginVertical: 4,
  },
  nodeCardWrapper: {
    flex: 1,
  },
  nodeCard: {
    padding: 14,
    gap: 8,
  },
  nodeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  nodeTemplateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  nodeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  nodeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nodeInfoText: {
    fontSize: 11,
    color: '#64748b',
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodeNotes: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
  },
  evidencesSection: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  evidencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  evidencesCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  evidencesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingTop: 6,
  },
  viewDetailBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 300,
  },
});
