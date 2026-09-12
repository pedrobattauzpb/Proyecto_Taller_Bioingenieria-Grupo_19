import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  History as HistoryIcon,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter,
  FileCheck2,
  Calendar,
  Layers,
  Building2,
} from 'lucide-react-native';
import { apiService } from '../services/api';
import {
  InspectionDetail,
  InspectionStatus,
  Hospital,
  Asset,
} from '../services/types';
import { Card } from '../components/ui/Card';
import { Badge, BadgeVariant } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ComponentHistoryTimeline } from '../components/history/ComponentHistoryTimeline';
import { HierarchySelector } from '../components/hierarchy/HierarchySelector';

export default function HistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 840;

  // Pestaña activa: Auditoría general vs Timeline por Activo
  const [activeTab, setActiveTab] = useState<'ALL_INSPECTIONS' | 'ASSET_TIMELINE'>(
    params.assetId ? 'ASSET_TIMELINE' : 'ALL_INSPECTIONS'
  );

  // Datos de jerarquía para el selector de activos en modo Timeline
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

      // Si viene un assetId en params, seleccionarlo
      if (params.assetId) {
        const targetId = parseInt(params.assetId, 10);
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
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const assetName = insp.asset?.name?.toLowerCase() || '';
    const assetTag = insp.asset?.tag_code?.toLowerCase() || '';
    const inspector = insp.inspector_name?.toLowerCase() || '';
    const template = insp.template?.title?.toLowerCase() || '';
    return (
      assetName.includes(term) ||
      assetTag.includes(term) ||
      inspector.includes(term) ||
      template.includes(term)
    );
  });

  const handleSelectAssetForTimeline = (asset: Asset) => {
    setSelectedAsset(asset);
    setActiveTab('ASSET_TIMELINE');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Encabezado */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Historial y Auditoría Técnica</Text>
          <Text style={styles.pageSubtitle}>
            Trazabilidad cronológica de listas de verificación de gases medicinales con evidencia multimedia
          </Text>
        </View>
        <Button
          title="Actualizar"
          variant="outline"
          size="sm"
          onPress={activeTab === 'ALL_INSPECTIONS' ? loadInspections : loadHierarchyAndData}
          loading={loading}
        />
      </View>

      {/* Selector de Pestañas de Vista */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('ALL_INSPECTIONS')}
          style={[
            styles.tabButton,
            activeTab === 'ALL_INSPECTIONS' && styles.activeTabButton,
          ]}
        >
          <HistoryIcon
            size={18}
            color={activeTab === 'ALL_INSPECTIONS' ? '#2563eb' : '#64748b'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'ALL_INSPECTIONS' && styles.activeTabText,
            ]}
          >
            Auditoría General de Inspecciones
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('ASSET_TIMELINE')}
          style={[
            styles.tabButton,
            activeTab === 'ASSET_TIMELINE' && styles.activeTabButton,
          ]}
        >
          <Clock
            size={18}
            color={activeTab === 'ASSET_TIMELINE' ? '#2563eb' : '#64748b'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'ASSET_TIMELINE' && styles.activeTabText,
            ]}
          >
            Línea de Tiempo por Activo
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'ASSET_TIMELINE' ? (
        /* VISTA DE LÍNEA DE TIEMPO POR ACTIVO (OBJETIVO 3) */
        <View style={styles.timelineSection}>
          <Card style={styles.assetSelectorCard}>
            <View style={styles.selectorHeader}>
              <Building2 size={20} color="#2563eb" />
              <Text style={styles.selectorTitle}>
                Seleccione el Activo Clínico para ver su Historial y Evidencias
              </Text>
            </View>

            <HierarchySelector
              hospitals={hospitals}
              selectedAsset={selectedAsset}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onStartInspection={(asset) => setSelectedAsset(asset)}
            />
          </Card>

          {selectedAsset && (
            <ComponentHistoryTimeline
              assetId={selectedAsset.id}
              assetName={selectedAsset.name}
              assetTag={selectedAsset.tag_code}
              onSelectInspection={(inspId) => router.push(`/inspections/${inspId}` as any)}
            />
          )}
        </View>
      ) : (
        /* VISTA TABULAR DE AUDITORÍA GENERAL */
        <>
          {/* Barra de Filtros y Búsqueda */}
          <Card style={styles.filterCard}>
            <View style={styles.filterControls}>
              {/* Búsqueda rápida */}
              <View style={styles.searchBox}>
                <Input
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Buscar por código de activo, sector, auditor o plantilla..."
                  containerStyle={{ marginVertical: 0 }}
                />
              </View>

              {/* Filtros de Estado */}
              <View style={styles.filterButtonGroup}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setStatusFilter('ALL')}
                  style={[
                    styles.filterBtn,
                    statusFilter === 'ALL' && styles.activeFilterBtn,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBtnText,
                      statusFilter === 'ALL' && styles.activeFilterBtnText,
                    ]}
                  >
                    Todas ({inspections.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setStatusFilter('COMPLETED')}
                  style={[
                    styles.filterBtn,
                    statusFilter === 'COMPLETED' && styles.activeFilterBtnEmerald,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBtnText,
                      statusFilter === 'COMPLETED' && styles.activeFilterBtnTextWhite,
                    ]}
                  >
                    Completadas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setStatusFilter('IN_PROGRESS')}
                  style={[
                    styles.filterBtn,
                    statusFilter === 'IN_PROGRESS' && styles.activeFilterBtnAmber,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBtnText,
                      statusFilter === 'IN_PROGRESS' && styles.activeFilterBtnTextWhite,
                    ]}
                  >
                    En Curso
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Contenido: Tabla Desktop o Cards Mobile */}
          {loading ? (
            <Card style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.centerText}>Cargando registros de auditoría...</Text>
            </Card>
          ) : error ? (
            <Card style={styles.centerBox}>
              <AlertTriangle size={32} color="#e11d48" />
              <Text style={styles.errorText}>{error}</Text>
              <Button title="Reintentar" variant="outline" onPress={loadInspections} />
            </Card>
          ) : filteredInspections.length === 0 ? (
            <Card style={styles.centerBox}>
              <HistoryIcon size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No se encontraron inspecciones</Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm
                  ? 'No hay registros que coincidan con los criterios de búsqueda.'
                  : 'Aún no se han generado inspecciones en este estado.'}
              </Text>
              <Button
                title="Ir al Panel para Iniciar Auditoría"
                variant="primary"
                onPress={() => router.push('/dashboard')}
              />
            </Card>
          ) : isDesktop ? (
            /* Vista Tabla de Escritorio */
            <Card style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 0.8 }]}>CÓDIGO / ID</Text>
                <Text style={[styles.th, { flex: 1.6 }]}>ACTIVO CLÍNICO</Text>
                <Text style={[styles.th, { flex: 2.0 }]}>PLANTILLA NORMATIVA</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>AUDITOR</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>ESTADO</Text>
                <Text style={[styles.th, { flex: 1.1 }]}>PROGRESO</Text>
                <Text style={[styles.th, { flex: 1.4, textAlign: 'right' }]}>ACCIONES</Text>
              </View>

              {filteredInspections.map((insp) => {
                const isCompleted = insp.status === 'COMPLETED';
                return (
                  <View key={insp.id} style={styles.tableRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => router.push(`/inspections/${insp.id}` as any)}
                      style={[styles.td, { flex: 0.8 }]}
                    >
                      <Text style={styles.idText}>#{insp.id}</Text>
                      <Text style={styles.dateSubtext}>
                        {new Date(insp.started_at).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        if (insp.asset) {
                          handleSelectAssetForTimeline(insp.asset);
                        }
                      }}
                      style={[styles.td, { flex: 1.6 }]}
                    >
                      <Text style={styles.assetNameText} numberOfLines={1}>
                        {insp.asset?.name}
                      </Text>
                      <Badge label={insp.asset?.tag_code || 'TAG'} variant="indigo" size="sm" />
                    </TouchableOpacity>

                    <View style={[styles.td, { flex: 2.0 }]}>
                      <Text style={styles.templateText} numberOfLines={2}>
                        {insp.template?.title}
                      </Text>
                    </View>

                    <View style={[styles.td, { flex: 1.2 }]}>
                      <Text style={styles.inspectorText}>{insp.inspector_name}</Text>
                    </View>

                    <View style={[styles.td, { flex: 0.9 }]}>
                      <Badge
                        label={isCompleted ? 'Completada' : 'En Curso'}
                        variant={isCompleted ? 'emerald' : 'amber'}
                        size="sm"
                      />
                    </View>

                    <View style={[styles.td, { flex: 1.1 }]}>
                      <Text style={styles.progressText}>
                        {insp.completed_items} / {insp.total_items} ({Math.round(insp.progress_percentage)}%)
                      </Text>
                    </View>

                    <View style={[styles.td, { flex: 1.4, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }]}>
                      <Button
                        title="Timeline"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          if (insp.asset) {
                            handleSelectAssetForTimeline(insp.asset);
                          }
                        }}
                      />
                      <Button
                        title={isCompleted ? 'Ver' : 'Continuar'}
                        variant={isCompleted ? 'outline' : 'primary'}
                        size="sm"
                        onPress={() => router.push(`/inspections/${insp.id}` as any)}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : (
            /* Vista de Tarjetas Apiladas (Móvil) */
            <View style={styles.cardListMobile}>
              {filteredInspections.map((insp) => {
                const isCompleted = insp.status === 'COMPLETED';
                return (
                  <Card key={insp.id} style={styles.mobileCard}>
                    <View style={styles.mobileCardTop}>
                      <View style={styles.mobileTags}>
                        <Badge label={`#${insp.id}`} variant="slate" size="sm" />
                        <Badge label={insp.asset?.tag_code || 'TAG'} variant="indigo" size="sm" />
                      </View>
                      <Badge
                        label={isCompleted ? 'Completada' : 'En Curso'}
                        variant={isCompleted ? 'emerald' : 'amber'}
                        size="sm"
                      />
                    </View>

                    <Text style={styles.mobileAssetName}>{insp.asset?.name}</Text>
                    <Text style={styles.mobileTemplate}>{insp.template?.title}</Text>

                    <View style={styles.mobileFooter}>
                      <View>
                        <Text style={styles.mobileDate}>
                          {new Date(insp.started_at).toLocaleString()}
                        </Text>
                        <Text style={styles.mobileInspector}>Auditor: {insp.inspector_name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Button
                          title="Timeline"
                          variant="outline"
                          size="sm"
                          onPress={() => {
                            if (insp.asset) {
                              handleSelectAssetForTimeline(insp.asset);
                            }
                          }}
                        />
                        <Button
                          title={isCompleted ? 'Ver' : 'Abrir'}
                          variant="primary"
                          size="sm"
                          onPress={() => router.push(`/inspections/${insp.id}` as any)}
                        />
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  timelineSection: {
    gap: 16,
  },
  assetSelectorCard: {
    padding: 16,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  filterCard: {
    padding: 12,
  },
  filterControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
  },
  filterButtonGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  activeFilterBtn: {
    backgroundColor: '#2563eb',
  },
  activeFilterBtnEmerald: {
    backgroundColor: '#059669',
  },
  activeFilterBtnAmber: {
    backgroundColor: '#d97706',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeFilterBtnText: {
    color: '#ffffff',
  },
  activeFilterBtnTextWhite: {
    color: '#ffffff',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centerText: {
    fontSize: 14,
    color: '#64748b',
  },
  errorText: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 400,
  },
  tableCard: {
    padding: 0,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  td: {
    justifyContent: 'center',
  },
  idText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  dateSubtext: {
    fontSize: 11,
    color: '#64748b',
  },
  assetNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  templateText: {
    fontSize: 12,
    color: '#334155',
  },
  inspectorText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardListMobile: {
    gap: 12,
  },
  mobileCard: {
    padding: 16,
    gap: 8,
  },
  mobileCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileTags: {
    flexDirection: 'row',
    gap: 6,
  },
  mobileAssetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  mobileTemplate: {
    fontSize: 12,
    color: '#475569',
  },
  mobileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mobileDate: {
    fontSize: 11,
    color: '#64748b',
  },
  mobileInspector: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
