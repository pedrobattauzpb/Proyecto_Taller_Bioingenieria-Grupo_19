import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type BadgeVariant = 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'slate' | 'cyan';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'blue',
  size = 'md',
  icon,
  style,
  textStyle,
}) => {
  const getColors = (): { bg: string; text: string; border: string } => {
    switch (variant) {
      case 'emerald':
        return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
      case 'rose':
        return { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' };
      case 'amber':
        return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
      case 'indigo':
        return { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' };
      case 'cyan':
        return { bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' };
      case 'slate':
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
      case 'blue':
      default:
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
    }
  };

  const colors = getColors();

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 2, paddingHorizontal: 6, fontSize: 10 };
      case 'lg':
        return { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13 };
      case 'md':
      default:
        return { paddingVertical: 3, paddingHorizontal: 8, fontSize: 11 };
    }
  };

  const sizeStyles = getPadding();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: sizeStyles.fontSize,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
