import React from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import type { LocalComplianceEvaluationSummary } from '../../hooks/useComplianceValidation';
import { cn } from '../../lib/utils';

interface ComplianceSummaryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  summary: LocalComplianceEvaluationSummary;
}

export const ComplianceSummaryCard: React.FC<ComplianceSummaryCardProps> = ({
  summary,
  className,
  ...rest
}) => {
  const isOptimal = summary.isFullyCompliant;
  const hasFailures = summary.nonCompliantCount > 0;

  const cardVariantClass = isOptimal
    ? 'bg-emerald-50/50 border-emerald-200'
    : hasFailures
    ? 'bg-rose-50/40 border-rose-200'
    : 'bg-white border-slate-200';

  return (
    <Card className={cn('p-5 flex flex-col gap-4 border', cardVariantClass, className)} {...rest}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOptimal
                ? 'bg-emerald-100 text-emerald-700'
                : hasFailures
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isOptimal ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Auditoría de Conformidad Normativa
            </h3>
            <p className="text-xs text-slate-500 font-medium">Evaluación legal algorítmica en tiempo real</p>
          </div>
        </div>

        <Badge
          label={`${summary.compliancePercentage}% Conforme`}
          variant={isOptimal ? 'emerald' : hasFailures ? 'rose' : 'amber'}
          size="md"
        />
      </div>

      {/* Barra de Progreso */}
      <div>
        <ProgressBar progress={summary.compliancePercentage} showLabel={false} height={8} />
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/60">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>CONFORMES</span>
          </div>
          <span className="text-base font-black text-emerald-600">
            {summary.compliantCount} / {summary.totalItems}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 tracking-wider">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>NO CONFORMES</span>
          </div>
          <span className={`text-base font-black ${summary.nonCompliantCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {summary.nonCompliantCount}
            {summary.criticalCount > 0 ? ` (${summary.criticalCount} crít.)` : ''}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>ADVERTENCIAS</span>
          </div>
          <span className="text-base font-black text-amber-600">{summary.warningCount}</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 tracking-wider">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>PENDIENTES</span>
          </div>
          <span className="text-base font-black text-slate-700">{summary.pendingCount}</span>
        </div>
      </div>

      <p className="text-xs text-slate-600 italic leading-relaxed">
        {isOptimal
          ? '✅ Todos los parámetros registrados cumplen con los estándares vigentes de Res. MSAL 1130/2000 e ISO 7396-1.'
          : hasFailures
          ? '❌ Existen desvíos que violan requisitos normativos obligatorios. Revise las alertas antes de firmar.'
          : '⏳ Complete los puntos de inspección pendientes para obtener la certificación técnica completa.'}
      </p>
    </Card>
  );
};
