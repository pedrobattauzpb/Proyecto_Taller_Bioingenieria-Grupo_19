import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircle2, AlertCircle } from 'lucide-react-native';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSavedAt,
}) => {
  if (status === 'idle') return null;

  return (
    <View style={styles.container}>
      {status === 'saving' && (
        <>
          <ActivityIndicator size="small" color="#2563eb" style={styles.icon} />
          <Text style={[styles.text, styles.savingText]}>Guardando...</Text>
        </>
      )}

      {status === 'saved' && (
        <>
          <CheckCircle2 size={15} color="#10b981" strokeWidth={2.4} style={styles.icon} />
          <Text style={[styles.text, styles.savedText]}>
            {lastSavedAt ? `Guardado ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Sincronizado'}
          </Text>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle size={15} color="#f43f5e" strokeWidth={2.4} style={styles.icon} />
          <Text style={[styles.text, styles.errorText]}>Error de sincronización</Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  savingText: {
    color: '#2563eb',
  },
  savedText: {
    color: '#059669',
  },
  errorText: {
    color: '#e11d48',
  },
});
