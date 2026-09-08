import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { ShieldCheck, AlertTriangle, Info, X } from 'lucide-react-native';
import { apiService } from '../../services/api';
import { NormativeCurrencyReport } from '../../services/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface NormativeStatusIndicatorProps {
  templateId?: number;
}

export const NormativeStatusIndicator: React.FC<NormativeStatusIndicatorProps> = ({
  templateId,
}) => {
  const [report, setReport] = useState<NormativeCurrencyReport | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (templateId) {
      apiService
        .checkTemplateNormativeCurrency(templateId)
        .then((res) => setReport(res))
        .catch((err) => console.error('Error verificando vigencia normativa:', err));
    }
  }, [templateId]);

  if (!report) return null;

  const isCurrent = report.all_current;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
        style={[styles.pill, isCurrent ? styles.currentPill : styles.outdatedPill]}
      >
        {isCurrent ? (
          <ShieldCheck size={14} color="#059669" />
        ) : (
          <AlertTriangle size={14} color="#dc2626" />
        )}
        <Text style={[styles.pillText, isCurrent ? styles.currentText : styles.outdatedText]}>
          {isCurrent ? 'Normativa Legal Vigente' : 'Alerta: Norma Desactualizada'}
        </Text>
        <Info size={12} color={isCurrent ? '#059669' : '#dc2626'} />
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.titleRow}>
                <ShieldCheck size={20} color={isCurrent ? '#059669' : '#dc2626'} />
                <Text style={styles.modalTitle}>Verificación de Vigencia Regulatoria</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Comprobación algorítmica contra el catálogo del Ministerio de Salud (Res. 1130/2000) e ISO 7396-1:2016.
            </Text>

            <View style={styles.clauseList}>
              {report.clauses.map((c) => (
                <View key={c.item_id} style={styles.clauseItem}>
                  <View style={styles.clauseItemTop}>
                    <Badge label={c.item_code} variant="slate" size="sm" />
                    <Badge
                      label={c.is_current ? 'Vigente' : 'Superada'}
                      variant={c.is_current ? 'emerald' : 'rose'}
                      size="sm"
                    />
                  </View>
                  <Text style={styles.clauseRef}>{c.referencia_normativa}</Text>
                  <Text style={styles.clauseMsg}>{c.status_message}</Text>
                  {c.suggested_replacement && (
                    <Text style={styles.clauseSugg}>👉 {c.suggested_replacement}</Text>
                  )}
                </View>
              ))}
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  currentPill: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  outdatedPill: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  currentText: {
    color: '#047857',
  },
  outdatedText: {
    color: '#b91c1c',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '85%',
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  clauseList: {
    gap: 8,
    marginTop: 6,
  },
  clauseItem: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  clauseItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clauseRef: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  clauseMsg: {
    fontSize: 11,
    color: '#334155',
  },
  clauseSugg: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
  },
});
