import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ShieldCheck, BookOpen } from 'lucide-react-native';

interface NormativeBadgeProps {
  reference: string;
  style?: ViewStyle;
}

export const NormativeBadge: React.FC<NormativeBadgeProps> = ({ reference, style }) => {
  if (!reference) return null;

  const isRes1130 = reference.toLowerCase().includes('res1130') || reference.toLowerCase().includes('1130');
  const isISO = reference.toLowerCase().includes('iso');

  const formatText = (ref: string) => {
    // Normalizar texto para presentación limpia: ej "ISO7396-1:cl.5.3" -> "ISO 7396-1 · cl. 5.3"
    return ref
      .replace('ISO7396-1:', 'ISO 7396-1 · ')
      .replace('ISO 7396-1:', 'ISO 7396-1 · ')
      .replace('Res1130/2000:', 'Res. 1130/2000 · cl. ')
      .replace('Res 1130/2000:', 'Res. 1130/2000 · cl. ');
  };

  const formatted = formatText(reference);
  const bgColor = isRes1130 ? '#eff6ff' : isISO ? '#f0fdf4' : '#f8fafc';
  const borderColor = isRes1130 ? '#bfdbfe' : isISO ? '#bbf7d0' : '#e2e8f0';
  const textColor = isRes1130 ? '#1d4ed8' : isISO ? '#15803d' : '#475569';
  const iconColor = isRes1130 ? '#2563eb' : isISO ? '#16a34a' : '#64748b';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }, style]}>
      {isRes1130 ? (
        <ShieldCheck size={12} color={iconColor} style={styles.icon} />
      ) : (
        <BookOpen size={12} color={iconColor} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: textColor }]}>{formatted}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
