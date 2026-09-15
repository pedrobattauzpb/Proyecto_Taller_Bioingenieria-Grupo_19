import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import type { ComplianceStatus, ComplianceSeverity } from '../../services/types';
import { cn } from '../../lib/utils';

interface ComplianceBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: ComplianceStatus;
  severity?: ComplianceSeverity;
  showIcon?: boolean;
}

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({
  status,
  severity,
  showIcon = true,
  className,
  ...rest
}) => {
  if (status === 'COMPLIANT') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-bold select-none',
          className
        )}
        {...rest}
      >
        {showIcon && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
        <span>Conforme</span>
      </div>
    );
  }

  if (status === 'NON_COMPLIANT') {
    const isCritical = severity === 'CRITICAL';
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md border text-[11px] font-bold select-none',
          isCritical
            ? 'border-rose-300 bg-rose-50 text-rose-900 ring-1 ring-rose-300'
            : 'border-rose-200 bg-rose-50 text-rose-800',
          className
        )}
        {...rest}
      >
        {showIcon && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
        <span>{isCritical ? 'No Conforme (Crítico)' : 'No Conforme'}</span>
      </div>
    );
  }

  if (status === 'WARNING') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-bold select-none',
          className
        )}
        {...rest}
      >
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
        <span>Advertencia</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-bold select-none',
        className
      )}
      {...rest}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      <span>Pendiente</span>
    </div>
  );
};
