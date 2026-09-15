import React from 'react';
import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ComplianceAlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  nonCompliantCount: number;
  criticalCount: number;
  warningCount?: number;
}

export const ComplianceAlertBanner: React.FC<ComplianceAlertBannerProps> = ({
  nonCompliantCount,
  criticalCount,
  warningCount = 0,
  className,
  ...rest
}) => {
  if (nonCompliantCount === 0 && warningCount === 0) return null;

  const isCritical = criticalCount > 0;

  const containerClasses = isCritical
    ? 'bg-rose-50 border-rose-300 text-rose-950'
    : nonCompliantCount > 0
    ? 'bg-rose-50 border-rose-200 text-rose-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';

  return (
    <div
      className={cn('flex items-start gap-3 p-4 rounded-xl border my-2', containerClasses, className)}
      {...rest}
    >
      <div className="shrink-0 mt-0.5">
        {isCritical ? (
          <AlertOctagon className="w-5 h-5 text-rose-800" />
        ) : (
          <AlertTriangle className={`w-5 h-5 ${nonCompliantCount > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
        )}
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <h4 className="text-xs sm:text-sm font-bold tracking-tight">
          {isCritical
            ? `⚠️ ALERTA CRÍTICA DE BIOINGENIERÍA: ${criticalCount} desvío(s) de alta severidad`
            : nonCompliantCount > 0
            ? `Desvíos Normativos Detectados: ${nonCompliantCount} ítem(s) no conforme(s)`
            : `Puntos en Advertencia: ${warningCount} ítem(s) cercanos al límite`}
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          {isCritical
            ? 'Se detectaron parámetros fuera de norma en elementos de seguridad directa o presiones críticas. Requiere subsanación técnica inmediata antes de autorizar el servicio.'
            : nonCompliantCount > 0
            ? 'Los puntos señalados en rojo incumplen las tolerancias de la Res. MSAL 1130/2000 o ISO 7396-1. Verifique los valores medidos o registre la acción correctiva.'
            : 'Los valores medidos se encuentran en la zona preventiva de margen (±10%). Monitoree la estabilidad de la red.'}
        </p>
      </div>
    </div>
  );
};
