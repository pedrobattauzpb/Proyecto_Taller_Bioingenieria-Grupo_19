import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
} from 'lucide-react-native';
import { ChecklistItem, InspectionResponse } from '../../services/types';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Input } from '../ui/Input';
import { NormativeBadge } from './NormativeBadge';
import { Badge } from '../ui/Badge';
import { ComplianceBadge } from './ComplianceBadge';
import { evaluateLocalCompliance } from '../../hooks/useComplianceValidation';

interface ChecklistCardProps {
  item: ChecklistItem;
  response?: InspectionResponse;
  onUpdateResponse: (itemId: number, updates: Partial<InspectionResponse>) => void;
  disabled?: boolean;
  style?: ViewStyle;
}


export const ChecklistCard: React.FC<ChecklistCardProps> = ({
  item,
  response,
  onUpdateResponse,
  disabled = false,
  style,
}) => {
  const [showObservations, setShowObservations] = useState<boolean>(
    !!response?.observations && response.observations.trim().length > 0
  );

  const numericValueStr = response?.val_numeric !== undefined && response?.val_numeric !== null
    ? String(response.val_numeric)
    : '';

  // Verificar si el valor numérico está fuera de rango nominal
  const isOutOfRange = (): { out: boolean; message?: string } => {
    if (item.input_type !== 'NUMERIC' || response?.val_numeric === undefined || response?.val_numeric === null) {
      return { out: false };
    }
    const val = response.val_numeric;
    const hasMin = item.min_value !== undefined && item.min_value !== null;
    const hasMax = item.max_value !== undefined && item.max_value !== null;

    if (hasMin && hasMax && (val < item.min_value! || val > item.max_value!)) {
      return {
        out: true,
        message: `⚠️ Valor fuera de rango normativo (${item.min_value} a ${item.max_value} ${item.unit || ''})`,
      };
    }
    if (hasMin && val < item.min_value!) {
      return {
        out: true,
        message: `⚠️ Valor inferior al mínimo normativo (${item.min_value} ${item.unit || ''})`,
      };
    }
    if (hasMax && val > item.max_value!) {
      return {
        out: true,
        message: `⚠️ Valor superior al máximo normativo (${item.max_value} ${item.unit || ''})`,
      };
    }
    return { out: false };
  };

  const rangeCheck = isOutOfRange();

  // Determinar estado de completitud para borde visual
  const isAnswered =
    response?.val_boolean !== undefined && response?.val_boolean !== null ||
    response?.val_numeric !== undefined && response?.val_numeric !== null ||
    (response?.val_text !== undefined && response?.val_text !== null && response.val_text.trim() !== '');

  const isFailing =
    response?.val_boolean === false ||
    (item.input_type === 'NUMERIC' && rangeCheck.out);

  const getBorderHighlight = () => {
    if (isFailing) return styles.failingBorder;
    if (isAnswered) return styles.answeredBorder;
    return styles.neutralBorder;
  };

  const complianceEval = evaluateLocalCompliance(item, response);

  return (

    <Card style={[styles.card, getBorderHighlight(), style]}>
      {/* Encabezado del Ítem */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.codeRow}>
            <Badge label={item.code} variant="slate" size="sm" />
            {item.is_mandatory && (
              <Badge label="Obligatorio" variant="rose" size="sm" />
            )}
            <ComplianceBadge
              status={complianceEval.status}
              severity={complianceEval.severity}
            />
          </View>
          <NormativeBadge reference={item.referencia_normativa} />
        </View>

        <Text style={styles.title}>{item.title}</Text>

        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}


        {/* Indicador de Rango Nominal si aplica */}
        {item.input_type === 'NUMERIC' && (item.min_value !== null || item.max_value !== null) && (
          <View style={styles.rangePill}>
            <Text style={styles.rangePillText}>
              Rango Nominal Requerido: {item.min_value ?? '-∞'} a {item.max_value ?? '+∞'} {item.unit || ''}
            </Text>
          </View>
        )}
      </View>

      {/* Control de Entrada según Tipo de Dato */}
      <View style={styles.controlContainer}>
        {item.input_type === 'BOOLEAN' && (
          <SegmentedControl
            value={response?.val_boolean}
            onChange={(val) => onUpdateResponse(item.id, { val_boolean: val })}
            disabled={disabled}
          />
        )}

        {item.input_type === 'NUMERIC' && (
          <View>
            <Input
              value={numericValueStr}
              onChangeText={(text) => {
                const cleaned = text.replace(',', '.');
                const num = cleaned === '' ? null : parseFloat(cleaned);
                onUpdateResponse(item.id, {
                  val_numeric: isNaN(num as number) ? null : num,
                });
              }}
              placeholder={`Ej: ${item.min_value !== null ? item.min_value : '4.5'}`}
              keyboardType="numeric"
              unit={item.unit || undefined}
              warning={rangeCheck.out ? rangeCheck.message : undefined}
              editable={!disabled}
            />
          </View>
        )}

        {item.input_type === 'TEXT' && (
          <Input
            value={response?.val_text || ''}
            onChangeText={(text) => onUpdateResponse(item.id, { val_text: text })}
            placeholder="Ingrese el valor o detalle técnico observado..."
            multiline
            numberOfLines={2}
            editable={!disabled}
          />
        )}
      </View>

      {/* Acordeón de Observaciones y Notas Técnicas */}
      <View style={styles.observationsContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowObservations(!showObservations)}
          style={styles.obsToggleBtn}
        >
          <View style={styles.obsToggleLeft}>
            <MessageSquarePlus size={15} color="#475569" />
            <Text style={styles.obsToggleText}>
              {response?.observations && response.observations.trim().length > 0
                ? 'Observación registrada'
                : 'Agregar nota / observación técnica'}
            </Text>
            {response?.observations && response.observations.trim().length > 0 && (
              <Badge label="Nota" variant="amber" size="sm" />
            )}
          </View>
          {showObservations ? (
            <ChevronUp size={16} color="#64748b" />
          ) : (
            <ChevronDown size={16} color="#64748b" />
          )}
        </TouchableOpacity>

        {showObservations && (
          <View style={styles.obsInputWrapper}>
            <Input
              value={response?.observations || ''}
              onChangeText={(text) => onUpdateResponse(item.id, { observations: text })}
              placeholder="Describa desvíos, condiciones operativas, números de serie o acciones correctivas requeridas..."
              multiline
              numberOfLines={3}
              editable={!disabled}
            />
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ffffff',
  },
  neutralBorder: {
    borderColor: '#e2e8f0',
  },
  answeredBorder: {
    borderColor: '#93c5fd',
  },
  failingBorder: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffcfc',
  },
  header: {
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2,
  },
  rangePill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  controlContainer: {
    marginTop: 4,
    marginBottom: 10,
  },
  observationsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 6,
  },
  obsToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  obsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  obsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  obsInputWrapper: {
    marginTop: 8,
  },
});
