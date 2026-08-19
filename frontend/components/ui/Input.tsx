import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  unit?: string;
  error?: string;
  warning?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  unit,
  error,
  warning,
  helperText,
  containerStyle,
  inputStyle,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  ...rest
}) => {
  const isInvalid = !!error;
  const isWarning = !!warning && !error;

  const getBorderColor = () => {
    if (isInvalid) return '#f43f5e';
    if (isWarning) return '#f59e0b';
    return '#cbd5e1';
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: getBorderColor(),
            backgroundColor: editable ? '#ffffff' : '#f8fafc',
            minHeight: multiline ? (numberOfLines || 3) * 24 : 46,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            inputStyle,
          ]}
          {...rest}
        />
        {unit && (
          <View style={styles.unitContainer}>
            <Text style={styles.unitText}>{unit}</Text>
          </View>
        )}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : warning ? (
        <Text style={styles.warningText}>{warning}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  multilineInput: {
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  unitContainer: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  errorText: {
    fontSize: 12,
    color: '#e11d48',
    marginTop: 4,
    fontWeight: '500',
  },
  warningText: {
    fontSize: 12,
    color: '#d97706',
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});
