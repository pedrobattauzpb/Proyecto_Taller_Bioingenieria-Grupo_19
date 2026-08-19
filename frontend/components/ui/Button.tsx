import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  style,
  textStyle,
}) => {
  const getVariantStyles = (): { bg: string; text: string; border: string } => {
    if (disabled) {
      return { bg: '#e2e8f0', text: '#94a3b8', border: '#cbd5e1' };
    }
    switch (variant) {
      case 'success':
        return { bg: '#10b981', text: '#ffffff', border: '#059669' };
      case 'danger':
        return { bg: '#f43f5e', text: '#ffffff', border: '#e11d48' };
      case 'secondary':
        return { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
      case 'outline':
        return { bg: 'transparent', text: '#2563eb', border: '#3b82f6' };
      case 'ghost':
        return { bg: 'transparent', text: '#475569', border: 'transparent' };
      case 'primary':
      default:
        return { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' };
    }
  };

  const getSizeStyles = (): { paddingV: number; paddingH: number; fontSize: number; minHeight: number } => {
    switch (size) {
      case 'sm':
        return { paddingV: 6, paddingH: 12, fontSize: 13, minHeight: 36 };
      case 'lg':
        return { paddingV: 14, paddingH: 24, fontSize: 16, minHeight: 52 };
      case 'md':
      default:
        return { paddingV: 10, paddingH: 18, fontSize: 14, minHeight: 44 };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: vStyles.bg,
          borderColor: vStyles.border,
          borderWidth: variant === 'outline' ? 1.5 : 1,
          paddingVertical: sStyles.paddingV,
          paddingHorizontal: sStyles.paddingH,
          minHeight: sStyles.minHeight,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vStyles.text} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          {title ? (
            <Text
              style={[
                styles.text,
                { color: vStyles.text, fontSize: sStyles.fontSize },
                textStyle,
              ]}
            >
              {title}
            </Text>
          ) : (
            children
          )}
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
