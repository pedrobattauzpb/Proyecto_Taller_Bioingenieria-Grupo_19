import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';

interface SegmentedControlProps {
  value?: boolean | null;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  disabled = false,
  style,
}) => {
  const isConforme = value === true;
  const isNoConforme = value === false;

  return (
    <View style={[styles.container, style]}>
      {/* Botón CUMPLE / CONFORME */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => onChange(true)}
        style={[
          styles.button,
          styles.buttonLeft,
          isConforme ? styles.activeConforme : styles.inactiveButton,
        ]}
      >
        <CheckCircle2
          size={18}
          color={isConforme ? '#ffffff' : '#10b981'}
          strokeWidth={2.4}
        />
        <Text
          style={[
            styles.buttonText,
            isConforme ? styles.activeConformeText : styles.inactiveConformeText,
          ]}
        >
          CUMPLE (PASA)
        </Text>
      </TouchableOpacity>

      {/* Botón NO CUMPLE / DESVÍO */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => onChange(false)}
        style={[
          styles.button,
          styles.buttonRight,
          isNoConforme ? styles.activeNoConforme : styles.inactiveButton,
        ]}
      >
        <XCircle
          size={18}
          color={isNoConforme ? '#ffffff' : '#f43f5e'}
          strokeWidth={2.4}
        />
        <Text
          style={[
            styles.buttonText,
            isNoConforme ? styles.activeNoConformeText : styles.inactiveNoConformeText,
          ]}
        >
          NO CUMPLE (FALLA)
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 52,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
    gap: 8,
  },
  buttonLeft: {
    marginRight: 2,
  },
  buttonRight: {
    marginLeft: 2,
  },
  inactiveButton: {
    backgroundColor: 'transparent',
  },
  activeConforme: {
    backgroundColor: '#10b981',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  activeNoConforme: {
    backgroundColor: '#f43f5e',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activeConformeText: {
    color: '#ffffff',
  },
  inactiveConformeText: {
    color: '#047857',
  },
  activeNoConformeText: {
    color: '#ffffff',
  },
  inactiveNoConformeText: {
    color: '#be123c',
  },
});
