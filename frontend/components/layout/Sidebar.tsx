import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  LayoutDashboard,
  ClipboardCheck,
  History,
  FileCheck2,
  ShieldCheck,
  Hospital,
  Info,
} from 'lucide-react-native';

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Panel Principal',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Historial de Auditoría',
      path: '/history',
      icon: History,
    },
  ];

  return (
    <View style={styles.sidebar}>
      {/* Navegación Principal */}
      <View style={styles.navSection}>
        <Text style={styles.sectionHeader}>NAVEGACIÓN</Text>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path === '/dashboard' && pathname === '/');
          const Icon = item.icon;

          return (
            <TouchableOpacity
              key={item.path}
              activeOpacity={0.8}
              onPress={() => router.push(item.path as any)}
              style={[
                styles.navButton,
                isActive && styles.activeNavButton,
              ]}
            >
              <Icon
                size={18}
                color={isActive ? '#2563eb' : '#64748b'}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              <Text
                style={[
                  styles.navLabel,
                  isActive && styles.activeNavLabel,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tarjeta de Trazabilidad y Normativas Clínicas */}
      <View style={styles.infoCard}>
        <View style={styles.infoTitleRow}>
          <ShieldCheck size={16} color="#2563eb" />
          <Text style={styles.infoTitle}>Marco Normativo</Text>
        </View>
        <Text style={styles.infoBody}>
          Auditoría de gases según Resolución MSAL 1130/2000 (control de envases) y norma ISO 7396-1 (redes fijas).
        </Text>
        <View style={styles.tagRow}>
          <View style={styles.normTag}>
            <Text style={styles.normTagText}>O2 · 4-5 bar</Text>
          </View>
          <View style={styles.normTag}>
            <Text style={styles.normTagText}>Vacío · -0.7 bar</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    padding: 16,
    justifyContent: 'space-between',
    height: '100%',
  },
  navSection: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    paddingHorizontal: 8,
    letterSpacing: 0.5,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  activeNavButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  activeNavLabel: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  infoBody: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  normTag: {
    backgroundColor: '#ffffff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  normTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
});
