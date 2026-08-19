import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  Building2,
  Layers,
  Activity,
  CheckCircle,
  PlayCircle,
  Cylinder,
  Gauge,
  CircleDot,
  Radio,
} from 'lucide-react-native';
import { Hospital, Sector, Asset, AssetType } from '../../services/types';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

interface HierarchySelectorProps {
  hospitals: Hospital[];
  loading?: boolean;
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset) => void;
  onStartInspection: (asset: Asset) => void;
}

export const HierarchySelector: React.FC<HierarchySelectorProps> = ({
  hospitals,
  loading = false,
  selectedAsset,
  onSelectAsset,
  onStartInspection,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(
    hospitals.length > 0 ? hospitals[0].id : null
  );

  // Seleccionar hospital activo
  const activeHospital = hospitals.find(
    (h) => h.id === (selectedHospitalId ?? (hospitals[0]?.id || null))
  ) || hospitals[0];

  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(
    activeHospital?.sectors[0]?.id || null
  );

  const activeSector = activeHospital?.sectors.find(
    (s) => s.id === (selectedSectorId ?? (activeHospital?.sectors[0]?.id || null))
  ) || activeHospital?.sectors[0];

  const getAssetTypeBadge = (type: AssetType): { label: string; variant: BadgeVariant; icon: React.ReactNode } => {
    switch (type) {
      case 'MANIFOLD':
        return {
          label: 'Manifold Central',
          variant: 'indigo',
          icon: <Activity size={12} color="#4f46e5" />,
        };
      case 'AVSU_VALVE':
        return {
          label: 'Válvula AVSU',
          variant: 'cyan',
          icon: <Radio size={12} color="#0891b2" />,
        };
      case 'TERMINAL_UNIT':
        return {
          label: 'Boca Terminal',
          variant: 'blue',
          icon: <CircleDot size={12} color="#2563eb" />,
        };
      case 'PRESSURE_REGULATOR':
        return {
          label: 'Regulador Presión',
          variant: 'amber',
          icon: <Gauge size={12} color="#d97706" />,
        };
      case 'GAS_CYLINDER':
        return {
          label: 'Cilindro / Envase',
          variant: 'emerald',
          icon: <Activity size={12} color="#059669" />,
        };
      default:
        return {
          label: type,
          variant: 'slate',
          icon: <Activity size={12} color="#475569" />,
        };
    }
  };

  if (loading) {
    return (
      <Card style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Cargando jerarquía hospitalaria...</Text>
      </Card>
    );
  }

  if (!hospitals || hospitals.length === 0) {
    return (
      <Card style={styles.emptyContainer}>
        <Building2 size={36} color="#94a3b8" />
        <Text style={styles.emptyTitle}>No hay datos hospitalarios</Text>
        <Text style={styles.emptySubtitle}>
          Verifique que el backend esté ejecutándose con el script seed de datos.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Selector de Hospital */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>1. Centro Hospitalario</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {hospitals.map((h) => {
            const isSelected = h.id === activeHospital?.id;
            return (
              <TouchableOpacity
                key={h.id}
                onPress={() => {
                  setSelectedHospitalId(h.id);
                  if (h.sectors.length > 0) {
                    setSelectedSectorId(h.sectors[0].id);
                  }
                }}
                style={[
                  styles.selectorChip,
                  isSelected && styles.selectedChip,
                ]}
              >
                <Building2 size={16} color={isSelected ? '#ffffff' : '#2563eb'} />
                <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                  {h.name}
                </Text>
                <Badge
                  label={h.code}
                  variant={isSelected ? 'slate' : 'blue'}
                  size="sm"
                  style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'transparent' } : undefined}
                  textStyle={isSelected ? { color: '#ffffff' } : undefined}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Selector de Sectores */}
      {activeHospital && activeHospital.sectors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>2. Sector / Servicio Clínico</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
            {activeHospital.sectors.map((s) => {
              const isSelected = s.id === activeSector?.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelectedSectorId(s.id)}
                  style={[
                    styles.selectorChip,
                    isSelected && styles.selectedChipIndigo,
                  ]}
                >
                  <Layers size={16} color={isSelected ? '#ffffff' : '#4f46e5'} />
                  <View>
                    <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                      {s.name}
                    </Text>
                    {s.floor_level && (
                      <Text style={[styles.chipSubtext, isSelected && styles.selectedChipSubtext]}>
                        {s.floor_level}
                      </Text>
                    )}
                  </View>
                  <Badge
                    label={`${s.assets.length} activos`}
                    variant={isSelected ? 'slate' : 'indigo'}
                    size="sm"
                    style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'transparent' } : undefined}
                    textStyle={isSelected ? { color: '#ffffff' } : undefined}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 3. Lista de Activos del Sector Seleccionado */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          3. Activos Disponibles en {activeSector?.name || 'el sector'} ({activeSector?.assets.length || 0})
        </Text>

        {(!activeSector || activeSector.assets.length === 0) ? (
          <Card style={styles.noAssetsCard}>
            <Text style={styles.noAssetsText}>No hay activos registrados en este sector.</Text>
          </Card>
        ) : (
          <View style={styles.assetsGrid}>
            {activeSector.assets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              const typeInfo = getAssetTypeBadge(asset.asset_type);

              return (
                <TouchableOpacity
                  key={asset.id}
                  activeOpacity={0.85}
                  onPress={() => onSelectAsset(asset)}
                  style={[
                    styles.assetCard,
                    isSelected && styles.selectedAssetCard,
                  ]}
                >
                  <View style={styles.assetHeader}>
                    <Badge
                      label={typeInfo.label}
                      variant={typeInfo.variant}
                      icon={typeInfo.icon}
                      size="sm"
                    />
                    <Badge label={asset.tag_code} variant="slate" size="sm" />
                  </View>

                  <Text style={styles.assetName}>{asset.name}</Text>

                  <View style={styles.assetFooter}>
                    <View style={styles.statusIndicator}>
                      <View style={styles.activeDot} />
                      <Text style={styles.statusText}>Operativo en línea</Text>
                    </View>

                    <Button
                      title="Auditar / Inspeccionar"
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      icon={<PlayCircle size={14} color={isSelected ? '#ffffff' : '#2563eb'} />}
                      onPress={() => onStartInspection(asset)}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    marginRight: 8,
  },
  selectedChip: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  selectedChipIndigo: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  selectedChipText: {
    color: '#ffffff',
  },
  chipSubtext: {
    fontSize: 11,
    color: '#64748b',
  },
  selectedChipSubtext: {
    color: '#e0e7ff',
  },
  assetsGrid: {
    gap: 10,
  },
  assetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  selectedAssetCard: {
    borderColor: '#2563eb',
    backgroundColor: '#f8faff',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  assetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  noAssetsCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAssetsText: {
    fontSize: 13,
    color: '#64748b',
  },
});
