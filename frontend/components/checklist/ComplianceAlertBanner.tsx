import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { AlertOctagon, AlertTriangle } from 'lucide-react-native';

interface ComplianceAlertBannerProps {
  nonCompliantCount: number;
  criticalCount: number;
  warningCount?: number;
  style?: ViewStyle;
}

export const ComplianceAlertBanner: React.FC<ComplianceAlertBannerProps> = ({
  nonCompliantCount,
  criticalCount,
  warningCount = 0,
  style,
}) => {
  if (nonCompliantCount === 0 && warningCount === 0) return null;

  const isCritical = criticalCount > 0;

  return (
    <View
      style={[
        styles.container,
        isCritical
          ? styles.criticalContainer
          : nonCompliantCount > 0
          ? styles.dangerContainer
          : styles.warningContainer,
        style,
      ]}
    >
      <View style={styles.iconBox}>
        {isCritical ? (
          <AlertOctagon size={22} color="#991b1b" />
        ) : (
          <AlertTriangle size={22} color={nonCompliantCount > 0 ? '#dc2626' : '#d97706'} />
        )}
      </View>

      <View style={styles.textBox}>
        <Text
          style={[
            styles.title,
            isCritical
              ? styles.criticalTitle
              : nonCompliantCount > 0
              ? styles.dangerTitle
              : styles.warningTitle,
          ]}
        >
          {isCritical
            ? `⚠️ ALERTA CRÍTICA DE BIOINGENIERÍA: ${criticalCount} desvío(s) de alta severidad`
            : nonCompliantCount > 0
            ? `Desvíos Normativos Detectados: ${nonCompliantCount} ítem(s) no conforme(s)`
            : `Puntos en Advertencia: ${warningCount} ítem(s) cercanos al límite`}
        </Text>
        <Text style={styles.description}>
          {isCritical
            ? 'Se detectaron parámetros fuera de norma en elementos de seguridad directa o presiones críticas. Requiere subsanación técnica inmediata antes de autorizar el servicio.'
            : nonCompliantCount > 0
            ? 'Los puntos señalados en rojo incumplen las tolerancias de la Res. MSAL 1130/2000 o ISO 7396-1. Verifique los valores medidos o registre la acción correctiva.'
            : 'Los valores medidos se encuentran en la zona preventiva de margen (±10%). Monitoree la estabilidad de la red.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 6,
  },
  iconBox: {
    marginTop: 2,
  },
  textBox: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  criticalContainer: {
    backgroundColor: '#fff1f2',
    borderColor: '#fda4af',
  },
  criticalTitle: {
    color: '#991b1b',
  },
  dangerContainer: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  dangerTitle: {
    color: '#b91c1c',
  },
  warningContainer: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  warningTitle: {
    color: '#b45309',
  },
});
