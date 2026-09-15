import { useMemo } from 'react';
import type { ChecklistItem, InspectionResponse, ComplianceStatus, ComplianceSeverity } from '../services/types';

export interface LocalComplianceItemEvaluation {
  itemId: number;
  status: ComplianceStatus;
  severity: ComplianceSeverity;
  message?: string;
  expectedValue: string;
  actualValue: string;
  isCompliant: boolean;
  isFailing: boolean;
  isWarning: boolean;
  isPending: boolean;
}

export interface LocalComplianceEvaluationSummary {
  evaluations: Record<number, LocalComplianceItemEvaluation>;
  totalItems: number;
  evaluatedCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  warningCount: number;
  pendingCount: number;
  criticalCount: number;
  compliancePercentage: number;
  isFullyCompliant: boolean;
}

export function evaluateLocalCompliance(
  item: ChecklistItem,
  response?: Partial<InspectionResponse>
): LocalComplianceItemEvaluation {
  const hasAnswer =
    (response?.val_boolean !== undefined && response?.val_boolean !== null) ||
    (response?.val_numeric !== undefined && response?.val_numeric !== null) ||
    (response?.val_text !== undefined && response?.val_text !== null && response.val_text.trim() !== '');

  if (!hasAnswer) {
    return {
      itemId: item.id,
      status: 'NOT_EVALUATED',
      severity: item.is_mandatory ? 'MAJOR' : 'OBSERVATION',
      message: item.is_mandatory ? 'Requisito obligatorio pendiente' : 'Punto opcional sin verificar',
      expectedValue: item.is_mandatory ? 'Requerido' : 'Opcional',
      actualValue: 'Sin carga',
      isCompliant: false,
      isFailing: false,
      isWarning: false,
      isPending: true,
    };
  }

  // 1. BOOLEANO
  if (item.input_type === 'BOOLEAN') {
    const isPass = response?.val_boolean === true;
    const isFail = response?.val_boolean === false;

    if (isPass) {
      return {
        itemId: item.id,
        status: 'COMPLIANT',
        severity: 'OBSERVATION',
        message: 'Conforme a normativa aplicable',
        expectedValue: 'Pasa (Conforme)',
        actualValue: 'Pasa',
        isCompliant: true,
        isFailing: false,
        isWarning: false,
        isPending: false,
      };
    }

    if (isFail) {
      const isCritical = (item.title || '').toLowerCase().includes('alarma') ||
        (item.title || '').toLowerCase().includes('fuga') ||
        (item.title || '').toLowerCase().includes('hidráulica') ||
        (item.title || '').toLowerCase().includes('seguridad');

      return {
        itemId: item.id,
        status: 'NON_COMPLIANT',
        severity: isCritical ? 'CRITICAL' : (item.is_mandatory ? 'MAJOR' : 'MINOR'),
        message: `No Conforme: no satisface ${item.referencia_normativa}`,
        expectedValue: 'Pasa (Conforme)',
        actualValue: 'No Pasa',
        isCompliant: false,
        isFailing: true,
        isWarning: false,
        isPending: false,
      };
    }
  }

  // 2. NUMÉRICO
  if (item.input_type === 'NUMERIC') {
    const val = response?.val_numeric;
    const unit = item.unit || '';
    const hasMin = item.min_value !== undefined && item.min_value !== null;
    const hasMax = item.max_value !== undefined && item.max_value !== null;

    if (val === undefined || val === null) {
      return {
        itemId: item.id,
        status: 'NOT_EVALUATED',
        severity: 'MAJOR',
        message: 'Valor numérico no ingresado',
        expectedValue: `${item.min_value ?? ''} - ${item.max_value ?? ''} ${unit}`.trim(),
        actualValue: 'Nulo',
        isCompliant: false,
        isFailing: false,
        isWarning: false,
        isPending: true,
      };
    }

    const expectedStr = `${hasMin ? `Mín: ${item.min_value}` : ''} ${hasMax ? `Máx: ${item.max_value}` : ''} ${unit}`.trim();
    const actualStr = `${val} ${unit}`.trim();

    const isBelow = hasMin && val < item.min_value!;
    const isAbove = hasMax && val > item.max_value!;

    if (isBelow || isAbove) {
      const isFar = (hasMin && val < item.min_value! * 0.7) || (hasMax && val > item.max_value! * 1.3);
      return {
        itemId: item.id,
        status: 'NON_COMPLIANT',
        severity: isFar ? 'CRITICAL' : (item.is_mandatory ? 'MAJOR' : 'MINOR'),
        message: isBelow
          ? `Valor inferior al mínimo normativo (${val} < ${item.min_value} ${unit})`
          : `Valor superior al máximo permitido (${val} > ${item.max_value} ${unit})`,
        expectedValue: expectedStr,
        actualValue: actualStr,
        isCompliant: false,
        isFailing: true,
        isWarning: false,
        isPending: false,
      };
    }

    // Alerta preventiva de margen 10%
    let inWarning = false;
    let warnMsg = '';
    if (hasMin && hasMax) {
      const span = item.max_value! - item.min_value!;
      const margin = span * 0.10;
      if (val <= item.min_value! + margin) {
        inWarning = true;
        warnMsg = `⚠️ Advertencia: próximo al umbral mínimo (${val} ${unit})`;
      } else if (val >= item.max_value! - margin) {
        inWarning = true;
        warnMsg = `⚠️ Advertencia: próximo al límite superior de seguridad (${val} ${unit})`;
      }
    } else if (hasMin && val <= item.min_value! * 1.1) {
      inWarning = true;
      warnMsg = `⚠️ Advertencia: próximo al límite mínimo (${val} ${unit})`;
    } else if (hasMax && val >= item.max_value! * 0.9) {
      inWarning = true;
      warnMsg = `⚠️ Advertencia: próximo al límite máximo (${val} ${unit})`;
    }

    if (inWarning) {
      return {
        itemId: item.id,
        status: 'WARNING',
        severity: 'MINOR',
        message: warnMsg,
        expectedValue: expectedStr,
        actualValue: actualStr,
        isCompliant: true,
        isFailing: false,
        isWarning: true,
        isPending: false,
      };
    }

    return {
      itemId: item.id,
      status: 'COMPLIANT',
      severity: 'OBSERVATION',
      message: 'Dentro de rango reglamentario',
      expectedValue: expectedStr,
      actualValue: actualStr,
      isCompliant: true,
      isFailing: false,
      isWarning: false,
      isPending: false,
    };
  }

  // 3. TEXTO
  if (item.input_type === 'TEXT') {
    const textVal = (response?.val_text || '').trim();
    if (item.is_mandatory && !textVal) {
      return {
        itemId: item.id,
        status: 'NON_COMPLIANT',
        severity: 'MAJOR',
        message: 'Registro descriptivo obligatorio requerido',
        expectedValue: 'Texto no vacío',
        actualValue: 'Vacío',
        isCompliant: false,
        isFailing: true,
        isWarning: false,
        isPending: false,
      };
    }

    return {
      itemId: item.id,
      status: 'COMPLIANT',
      severity: 'OBSERVATION',
      message: 'Registro cargado',
      expectedValue: 'Descriptivo',
      actualValue: textVal || 'N/A',
      isCompliant: true,
      isFailing: false,
      isWarning: false,
      isPending: false,
    };
  }

  return {
    itemId: item.id,
    status: 'COMPLIANT',
    severity: 'OBSERVATION',
    expectedValue: 'N/A',
    actualValue: 'N/A',
    isCompliant: true,
    isFailing: false,
    isWarning: false,
    isPending: false,
  };
}

export function useComplianceValidation(
  items: ChecklistItem[] = [],
  responsesMap: Record<number, Partial<InspectionResponse>> = {}
): LocalComplianceEvaluationSummary {
  return useMemo(() => {
    const evaluations: Record<number, LocalComplianceItemEvaluation> = {};
    let compliantCount = 0;
    let nonCompliantCount = 0;
    let warningCount = 0;
    let pendingCount = 0;
    let criticalCount = 0;

    items.forEach((item) => {
      const resp = responsesMap[item.id];
      const evalResult = evaluateLocalCompliance(item, resp);
      evaluations[item.id] = evalResult;

      if (evalResult.status === 'COMPLIANT') compliantCount++;
      else if (evalResult.status === 'NON_COMPLIANT') {
        nonCompliantCount++;
        if (evalResult.severity === 'CRITICAL') criticalCount++;
      } else if (evalResult.status === 'WARNING') warningCount++;
      else pendingCount++;
    });

    const totalItems = items.length;
    const evaluatedCount = compliantCount + nonCompliantCount + warningCount;
    const compliancePercentage =
      totalItems > 0 ? Math.round((compliantCount / totalItems) * 1000) / 10 : 0;
    const isFullyCompliant = nonCompliantCount === 0 && pendingCount === 0 && totalItems > 0;

    return {
      evaluations,
      totalItems,
      evaluatedCount,
      compliantCount,
      nonCompliantCount,
      warningCount,
      pendingCount,
      criticalCount,
      compliancePercentage,
      isFullyCompliant,
    };
  }, [items, responsesMap]);
}
