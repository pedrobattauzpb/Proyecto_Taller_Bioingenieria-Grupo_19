import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 100
  height?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showLabel = false,
  style,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const getProgressColor = () => {
    if (clampedProgress >= 100) return '#10b981';
    if (clampedProgress >= 50) return '#2563eb';
    return '#3b82f6';
  };

  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>Progreso de Inspección</Text>
          <Text style={styles.percentage}>{Math.round(clampedProgress)}%</Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: getProgressColor(),
              height,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  track: {
    backgroundColor: '#e2e8f0',
    borderRadius: 9999,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 9999,
  },
});
