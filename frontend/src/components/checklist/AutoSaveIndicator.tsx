import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status: SaveStatus;
  lastSavedAt?: Date | null;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSavedAt,
  className,
  ...rest
}) => {
  if (status === 'idle') return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-semibold select-none transition-all',
        status === 'saving' && 'bg-blue-50 text-blue-700',
        status === 'saved' && 'bg-emerald-50 text-emerald-700',
        status === 'error' && 'bg-rose-50 text-rose-700',
        className
      )}
      {...rest}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Guardando...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {lastSavedAt
              ? `Guardado ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Sincronizado'}
          </span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Error de sincronización</span>
        </>
      )}
    </div>
  );
};
