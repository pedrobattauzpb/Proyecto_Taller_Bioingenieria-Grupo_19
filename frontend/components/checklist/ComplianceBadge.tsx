import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react-native';
import { ComplianceStatus, ComplianceSeverity } from '../../services/types';

interface ComplianceBadgeProps {
  status: ComplianceStatus;
  severity?: ComplianceSeverity;
  showIcon?: boolean;
  style?: ViewStyle;
}

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({
  status,
  severity,
  showIcon = true,
  style,
}) => {
  if (status === 'COMPLIANT') {
    return (
      <View style={[styles.badge, styles.compliant, style]}>
        {showIcon && <CheckCircle size={13} color="#059669" />}
        <Text style={[styles.label, styles.compliantLabel]}>Conforme</Text>
      </View>
    );
  }

  if (status === 'NON_COMPLIANT') {
    const isCritical = severity === 'CRITICAL';
    return (
      <View
        style={[
          styles.badge,
          isCritical ? styles.criticalNonCompliant : styles.nonCompliant,
          style,
        ]}
      >
        {showIcon && <XCircle size={13} color={isCritical ? '#991b1b' : '#dc2626'} />}
        <Text
          style={[
            styles.label,
            isCritical ? styles.criticalLabel : styles.nonCompliantLabel,
          ]}
        >
          {isCritical ? 'No Conforme (Crítico)' : 'No Conforme'}
        </Text>
      </View>
    );
  }

  if (status === 'WARNING') {
    return (
      <View style={[styles.badge, styles.warning, style]}>
        {showIcon && <AlertTriangle size={13} color="#d97706" />}
        <Text style={[styles.label, styles.warningLabel]}>Advertencia</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.pending, style]}>
      {showIcon && <Clock size={13} color="#64748b" />}
      <Text style={[styles.label, styles.pendingLabel]}>Pendiente</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  compliant: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  compliantLabel: {
    color: '#047857',
  },
  nonCompliant: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  nonCompliantLabel: {
    color: '#b91c1c',
  },
  criticalNonCompliant: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  criticalLabel: {
    color: '#991b1b',
  },
  warning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  warningLabel: {
    color: '#b45309',
  },
  pending: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  pendingLabel: {
    color: '#64748b',
  },
});
