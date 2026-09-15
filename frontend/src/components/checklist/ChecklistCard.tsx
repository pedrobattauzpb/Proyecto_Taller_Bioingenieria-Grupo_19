import React, { useState } from 'react';
import { MessageSquarePlus, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import type { ChecklistItem, InspectionResponse, InspectionEvidence } from '../../services/types';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Input } from '../ui/Input';
import { NormativeBadge } from './NormativeBadge';
import { Badge } from '../ui/Badge';
import { ComplianceBadge } from './ComplianceBadge';
import { evaluateLocalCompliance } from '../../hooks/useComplianceValidation';
import { EvidenceThumbnail } from './EvidenceThumbnail';
import { MediaUploader } from './MediaUploader';
import { cn } from '../../lib/utils';

interface ChecklistCardProps {
  item: ChecklistItem;
  response?: InspectionResponse;
  evidences?: InspectionEvidence[];
  inspectionId?: number;
  inspectorName?: string;
  onUpdateResponse: (itemId: number, updates: Partial<InspectionResponse>) => void;
  onUploadEvidence?: (evidence: InspectionEvidence) => void;
  onDeleteEvidence?: (evidenceId: number) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

export const ChecklistCard: React.FC<ChecklistCardProps> = ({
  item,
  response,
  evidences = [],
  inspectionId,
  inspectorName,
  onUpdateResponse,
  onUploadEvidence,
  onDeleteEvidence,
  disabled = false,
  className,
}) => {
  const [showObservations, setShowObservations] = useState<boolean>(
    !!response?.observations && response.observations.trim().length > 0
  );
  const [showEvidenceSection, setShowEvidenceSection] = useState<boolean>(
    evidences.length > 0
  );

  const numericValueStr =
    response?.val_numeric !== undefined && response?.val_numeric !== null
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

  const isAnswered =
    (response?.val_boolean !== undefined && response?.val_boolean !== null) ||
    (response?.val_numeric !== undefined && response?.val_numeric !== null) ||
    (response?.val_text !== undefined && response?.val_text !== null && response.val_text.trim() !== '');

  const isFailing =
    response?.val_boolean === false ||
    (item.input_type === 'NUMERIC' && rangeCheck.out);

  const borderHighlight = isFailing
    ? 'border-rose-400 bg-rose-50/20 shadow-xs'
    : isAnswered
    ? 'border-emerald-300 bg-white shadow-xs'
    : 'border-slate-200 bg-white';

  const complianceEval = evaluateLocalCompliance(item, response);

  return (
    <Card className={cn('flex flex-col gap-3.5 border-1.5 transition-all', borderHighlight, className)}>
      {/* Encabezado del Ítem */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge label={item.code} variant="slate" size="sm" />
            {item.is_mandatory && <Badge label="Obligatorio" variant="rose" size="sm" />}
            <ComplianceBadge status={complianceEval.status} severity={complianceEval.severity} />
          </div>
          <NormativeBadge reference={item.referencia_normativa} />
        </div>

        <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{item.title}</h4>

        {item.description && (
          <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
        )}

        {item.input_type === 'NUMERIC' && (item.min_value !== null || item.max_value !== null) && (
          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50/80 border border-blue-200 text-[11px] font-semibold text-blue-800 self-start">
            <span>
              Rango Nominal Requerido: {item.min_value ?? '-∞'} a {item.max_value ?? '+∞'} {item.unit || ''}
            </span>
          </div>
        )}
      </div>

      {/* Control de Entrada según Tipo */}
      <div className="pt-1">
        {item.input_type === 'BOOLEAN' && (
          <SegmentedControl
            value={response?.val_boolean}
            onChange={(val) => onUpdateResponse(item.id, { val_boolean: val })}
            disabled={disabled}
          />
        )}

        {item.input_type === 'NUMERIC' && (
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
            type="number"
            step="any"
            unit={item.unit || undefined}
            warning={rangeCheck.out ? rangeCheck.message : undefined}
            disabled={disabled}
          />
        )}

        {item.input_type === 'TEXT' && (
          <Input
            value={response?.val_text || ''}
            onChangeText={(text) => onUpdateResponse(item.id, { val_text: text })}
            placeholder="Ingrese el valor o detalle técnico observado..."
            multiline
            numberOfLines={2}
            disabled={disabled}
          />
        )}
      </div>

      {/* Observaciones técnicas */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowObservations(!showObservations)}
          className="inline-flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer select-none py-1"
        >
          <div className="flex items-center gap-1.5">
            <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {response?.observations && response.observations.trim().length > 0
                ? 'Observación registrada'
                : 'Agregar nota / observación técnica'}
            </span>
            {response?.observations && response.observations.trim().length > 0 && (
              <Badge label="Nota" variant="amber" size="sm" />
            )}
          </div>
          {showObservations ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showObservations && (
          <Input
            value={response?.observations || ''}
            onChangeText={(text) => onUpdateResponse(item.id, { observations: text })}
            placeholder="Describa desvíos, condiciones operativas, números de serie o acciones correctivas..."
            multiline
            numberOfLines={2}
            disabled={disabled}
          />
        )}
      </div>

      {/* Evidencia Multimedia */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowEvidenceSection(!showEvidenceSection)}
          className="inline-flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer select-none py-1"
        >
          <div className="flex items-center gap-1.5">
            <Camera className={`w-3.5 h-3.5 ${evidences.length > 0 ? 'text-blue-600' : 'text-slate-500'}`} />
            <span>
              {evidences.length > 0
                ? `Evidencia adjunta (${evidences.length})`
                : 'Adjuntar evidencia (foto / video)'}
            </span>
            {evidences.length > 0 && <Badge label={`${evidences.length}`} variant="blue" size="sm" />}
          </div>
          {showEvidenceSection ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showEvidenceSection && (
          <div className="flex flex-col gap-3 pt-1">
            {evidences.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {evidences.map((ev) => (
                  <EvidenceThumbnail
                    key={ev.id}
                    evidence={ev}
                    disabled={disabled}
                    onDelete={onDeleteEvidence}
                  />
                ))}
              </div>
            )}

            {inspectionId && !disabled && (
              <MediaUploader
                inspectionId={inspectionId}
                itemId={item.id}
                inspectorName={inspectorName}
                disabled={disabled}
                onEvidenceUploaded={(ev) => {
                  if (onUploadEvidence) onUploadEvidence(ev);
                }}
                compact
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
