import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import { LocalComplianceEvaluationSummary } from '../../hooks/useComplianceValidation';

interface ComplianceSummaryCardProps {
  summary: LocalComplianceEvaluationSummary;
  style?: ViewStyle;
}

export const ComplianceSummaryCard: React.FC<ComplianceSummaryCardProps> = ({
  summary,
  style,
}) => {
  const isOptimal = summary.isFullyCompliant;
  const hasFailures = summary.nonCompliantCount > 0;

  return (
    <Card style={[styles.card, isOptimal ? styles.optimalCard : hasFailures ? styles.failureCard : styles.neutralCard, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isOptimal ? (
            <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
              <ShieldCheck size={22} color="#059669" />
            </View>
          ) : (
            <View style={[styles.iconBox, { backgroundColor: hasFailures ? '#fef2f2' : '#fffbeb' }]}>
              <ShieldAlert size={22} color={hasFailures ? '#dc2626' : '#d97706'} />
            </View>
          )}
          <View>
            <Text style={styles.title}>Auditoría de Conformidad Normativa</Text>
            <Text style={styles.subtitle}>
              Evaluación legal algorítmica en tiempo real
            </Text>
          </View>
        </View>

        <Badge
          label={`${summary.compliancePercentage}% Conforme`}
          variant={isOptimal ? 'emerald' : hasFailures ? 'rose' : 'amber'}
          size="md"
        />
      </View>

      {/* Barra de Progreso de Cumplimiento Legal */}
      <View style={styles.progressBox}>
        <ProgressBar
          progress={summary.compliancePercentage}
          showLabel={false}
          height={8}
        />
      </View>

      {/* Cuadrícula de Métricas de Auditoría */}
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <View style={styles.statLabelRow}>
            <CheckCircle2 size={13} color="#059669" />
            <Text style={styles.statLabel}>CONFORMES</Text>
          </View>
          <Text style={[styles.statValue, { color: '#059669' }]}>
            {summary.compliantCount} / {summary.totalItems}
          </Text>
        </View>

        <View style={styles.gridItem}>
          <View style={styles.statLabelRow}>
            <XCircle size={13} color="#dc2626" />
            <Text style={styles.statLabel}>NO CONFORMES</Text>
          </View>
          <Text style={[styles.statValue, { color: summary.nonCompliantCount > 0 ? '#dc2626' : '#0f172a' }]}>
            {summary.nonCompliantCount}
            {summary.criticalCount > 0 ? ` (${summary.criticalCount} críticos)` : ''}
          </Text>
        </View>

        <View style={styles.gridItem}>
          <View style={styles.statLabelRow}>
            <AlertTriangle size={13} color="#d97706" />
            <Text style={styles.statLabel}>ADVERTENCIAS</Text>
          </View>
          <Text style={[styles.statValue, { color: '#d97706' }]}>
            {summary.warningCount}
          </Text>
        </View>

        <View style={styles.gridItem}>
          <View style={styles.statLabelRow}>
            <Clock size={13} color="#64748b" />
            <Text style={styles.statLabel}>PENDIENTES</Text>
          </View>
          <Text style={styles.statValue}>{summary.pendingCount}</Text>
        </View>
      </View>

      <Text style={styles.footerHelp}>
        {isOptimal
          ? '✅ Todos los parámetros registrados cumplen con los estándares vigentes de Res. MSAL 1130/2000 e ISO 7396-1.'
          : hasFailures
          ? '❌ Existen desvíos que violan requisitos normativos obligatorios. Revise las alertas antes de firmar.'
          : '⏳ Complete los puntos de inspección pendientes para obtener la certificación técnica completa.'}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  optimalCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  failureCard: {
    backgroundColor: '#fffafb',
    borderColor: '#fecaca',
  },
  neutralCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  progressBox: {
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.6)',
  },
  gridItem: {
    flex: 1,
    minWidth: 120,
    gap: 2,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  footerHelp: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
