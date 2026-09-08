import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  ShieldCheck,
  PlusCircle,
  Layers,
  Building2,
  FileSpreadsheet,
  FileCheck,
  X,
} from 'lucide-react-native';
import { apiService } from '../services/api';
import {
  Hospital,
  Asset,
  StatsOverviewResponse,
  InspectionHistoryItem,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { HierarchySelector } from '../components/hierarchy/HierarchySelector';

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 992;

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<StatsOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
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
      const [hierData, statsData] = await Promise.all([
        apiService.getHierarchy(),
        apiService.getStats(),
      ]);
      setHospitals(hierData.hospitals);
      setStats(statsData);
      if (hierData.hospitals.length > 0 && hierData.hospitals[0].sectors.length > 0) {
        const firstAsset = hierData.hospitals[0].sectors[0].assets[0];
        if (firstAsset) setSelectedAsset(firstAsset);
      }
    } catch (err: any) {
      console.error('Error cargando datos del dashboard:', err);
      setError('No se pudo conectar con el servidor backend. Verifique que la API esté activa.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInspectionModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setModalVisible(true);
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
      setModalVisible(false);
      router.push(`/inspections/${newInsp.id}` as any);
    } catch (err: any) {
      console.error('Error iniciando inspección:', err);
      alert('Error al iniciar la inspección. Verifique la conexión con el servidor.');
    } finally {
      setStartingInspection(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Encabezado del Dashboard */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Módulo de Inspección Digital de Gases</Text>
          <Text style={styles.pageSubtitle}>
            Auditoría clínica y verificación normativa bajo Res. MSAL 1130/2000 e ISO 7396-1
          </Text>
        </View>
        <Button
          title="Actualizar Datos"
          variant="outline"
          size="sm"
          onPress={loadDashboardData}
          loading={loading}
        />
      </View>

      {error && (
        <Card style={styles.errorCard}>
          <AlertCircle size={20} color="#e11d48" />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      {/* Tarjetas KPI de Actividad */}
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>TOTAL ACTIVOS</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#eff6ff' }]}>
              <Layers size={18} color="#2563eb" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{stats?.total_assets ?? '-'}</Text>
          <Text style={styles.kpiSub}>En 4 sectores clínicos</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>ACTIVOS OPERATIVOS</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#ecfdf5' }]}>
              <Activity size={18} color="#059669" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>
            {stats?.active_assets ?? '-'}
          </Text>
          <Text style={styles.kpiSub}>100% de disponibilidad</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>AUDITORÍAS COMPLETAS</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#f0fdf4' }]}>
              <CheckCircle2 size={18} color="#16a34a" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
            {stats?.completed_inspections ?? 0}
          </Text>
          <Text style={styles.kpiSub}>Conforme a normativas</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>EN PROCESO / CURSO</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#fffbeb' }]}>
              <Clock size={18} color="#d97706" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: '#d97706' }]}>
            {stats?.in_progress_inspections ?? 0}
          </Text>
          <Text style={styles.kpiSub}>Pendientes de cierre</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>CUMPLIMIENTO LEGAL</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#f0fdf4' }]}>
              <ShieldCheck size={18} color="#059669" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>
            {stats?.global_compliance_percentage !== undefined ? `${stats.global_compliance_percentage}%` : '100%'}
          </Text>
          <Text style={styles.kpiSub}>Auditoría algorítmica</Text>
        </Card>
      </View>


      {/* Disposición Principal en 2 Columnas (Desktop) */}
      <View style={[styles.layoutRow, isDesktop ? styles.desktopRow : styles.mobileCol]}>
        {/* Columna Izquierda: Cascada de Selección de Activos */}
        <View style={isDesktop ? styles.colLeft : styles.colFull}>
          <HierarchySelector
            hospitals={hospitals}
            loading={loading}
            selectedAsset={selectedAsset}
            onSelectAsset={(a) => setSelectedAsset(a)}
            onStartInspection={handleStartInspectionModal}
          />
        </View>

        {/* Columna Derecha: Accesos Rápidos Normativos e Historial Reciente */}
        <View style={isDesktop ? styles.colRight : styles.colFull}>
          {/* Banner de Protocolos Normativos Directos */}
          <Card style={styles.protocolsBanner}>
            <View style={styles.bannerHeader}>
              <ShieldCheck size={22} color="#2563eb" />
              <Text style={styles.bannerTitle}>Protocolos de Verificación Normativa</Text>
            </View>
            <Text style={styles.bannerText}>
              Seleccione un activo a la izquierda o ejecute una auditoría inmediata bajo los estándares de bioingeniería:
            </Text>

            <View style={styles.protocolList}>
              <View style={styles.protocolItem}>
                <Badge label="Res. 1130/2000" variant="indigo" size="sm" />
                <Text style={styles.protocolItemText}>
                  Control de Envases/Cilindros de O2 y N2O (Cruz griega verde, prueba hidráulica, rotulado y conexiones).
                </Text>
              </View>

              <View style={styles.protocolItem}>
                <Badge label="ISO 7396-1:2016" variant="emerald" size="sm" />
                <Text style={styles.protocolItemText}>
                  Inspección de Redes Centrales, Manifolds (4.0-5.5 bar), Válvulas AVSU y Tomas Rápidas.
                </Text>
              </View>
            </View>
          </Card>

          {/* Lista de Últimas Inspecciones Realizadas */}
          <Card style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Últimas Inspecciones Registradas</Text>
              <Button
                title="Ver Historial Completo"
                variant="ghost"
                size="sm"
                onPress={() => router.push('/history')}
              />
            </View>

            {(!stats?.recent_inspections || stats.recent_inspections.length === 0) ? (
              <View style={styles.emptyRecent}>
                <FileSpreadsheet size={32} color="#94a3b8" />
                <Text style={styles.emptyRecentTitle}>No hay inspecciones previas</Text>
                <Text style={styles.emptyRecentSub}>
                  Comience seleccionando un activo del panel izquierdo para crear el primer registro digital.
                </Text>
              </View>
            ) : (
              <View style={styles.recentList}>
                {stats.recent_inspections.map((insp) => (
                  <TouchableOpacity
                    key={insp.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/inspections/${insp.id}` as any)}
                    style={styles.recentItem}
                  >
                    <View style={styles.recentItemTop}>
                      <View style={styles.recentTagRow}>
                        <Badge label={insp.asset_tag} variant="slate" size="sm" />
                        <Badge
                          label={insp.status === 'COMPLETED' ? 'Completado' : 'En Curso'}
                          variant={insp.status === 'COMPLETED' ? 'emerald' : 'amber'}
                          size="sm"
                        />
                      </View>
                      <Text style={styles.recentDate}>
                        {new Date(insp.started_at).toLocaleDateString()}
                      </Text>
                    </View>

                    <Text style={styles.recentAssetName}>{insp.asset_name}</Text>
                    <Text style={styles.recentTemplateTitle}>{insp.template_title}</Text>

                    <View style={styles.recentFooter}>
                      <Text style={styles.recentInspector}>
                        Auditor: {insp.inspector_name}
                      </Text>
                      {insp.non_compliant_count > 0 ? (
                        <Badge
                          label={`${insp.non_compliant_count} No Conforme(s)`}
                          variant="rose"
                          size="sm"
                        />
                      ) : (
                        <Badge label="100% Conforme" variant="emerald" size="sm" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        </View>
      </View>

      {/* Modal para Iniciar Inspección */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Iniciar Nueva Inspección</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedAsset && (
              <View style={styles.modalAssetInfo}>
                <Badge label={selectedAsset.tag_code} variant="indigo" size="md" />
                <Text style={styles.modalAssetName}>{selectedAsset.name}</Text>
                <Text style={styles.modalAssetType}>Tipo: {selectedAsset.asset_type}</Text>
              </View>
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
              placeholder="Ej: Inspección rutinaria semanal / Turno mañana"
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setModalVisible(false)}
                disabled={startingInspection}
              />
              <Button
                title="Comenzar Checklist"
                variant="primary"
                icon={<Play size={16} color="#ffffff" />}
                onPress={handleConfirmStartInspection}
                loading={startingInspection}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  errorCard: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#be123c',
    fontWeight: '600',
    flex: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    padding: 16,
    gap: 6,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  layoutRow: {
    gap: 20,
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mobileCol: {
    flexDirection: 'column',
  },
  colLeft: {
    flex: 1.1,
  },
  colRight: {
    flex: 0.9,
    gap: 16,
  },
  colFull: {
    width: '100%',
    gap: 16,
  },
  protocolsBanner: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    gap: 10,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  bannerText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  protocolList: {
    gap: 8,
    marginTop: 4,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  protocolItemText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 16,
  },
  recentCard: {
    padding: 16,
    gap: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyRecent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyRecentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  emptyRecentSub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  recentList: {
    gap: 10,
  },
  recentItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  recentItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentDate: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  recentAssetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  recentTemplateTitle: {
    fontSize: 12,
    color: '#475569',
  },
  recentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  recentInspector: {
    fontSize: 11,
    color: '#64748b',
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
    maxWidth: 480,
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
  modalAssetInfo: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  modalAssetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalAssetType: {
    fontSize: 12,
    color: '#64748b',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
});
