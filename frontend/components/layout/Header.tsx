import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldAlert, Activity, CheckCircle2, Flame } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Badge } from '../ui/Badge';

interface HeaderProps {
  hospitalName?: string;
  activeScreen?: string;
}

export const Header: React.FC<HeaderProps> = ({
  hospitalName = 'Hosp. Dr. Arturo Oñativia',
  activeScreen = 'Módulo de Inspección Digital',
}) => {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {/* Brand e Identidad Clínica */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/')}
        style={styles.brandContainer}
      >
        <View style={styles.logoIcon}>
          <Activity size={20} color="#ffffff" />
        </View>
        <View>
          <Text style={styles.brandTitle}>Gases Medicinales</Text>
          <Text style={styles.brandSubtitle}>{hospitalName}</Text>
        </View>
      </TouchableOpacity>

      {/* Badges de Normativas y Estado Clínico */}
      <View style={styles.normativeRow}>
        <Badge
          label="Res. MSAL 1130/2000"
          variant="indigo"
          size="sm"
          style={styles.badgeItem}
        />
        <Badge
          label="ISO 7396-1:2016"
          variant="emerald"
          size="sm"
          style={styles.badgeItem}
        />
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Red Operativa</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  normativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeItem: {
    display: 'flex',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
});
