import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SegmentedControlProps {
  value?: boolean | null;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const isConforme = value === true;
  const isNoConforme = value === false;

  return (
    <div
      className={cn(
        'grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1.5 min-h-[48px]',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer select-none',
          isConforme
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-emerald-700 hover:bg-emerald-50/60'
        )}
      >
        <CheckCircle2 className={`w-4 h-4 ${isConforme ? 'text-white' : 'text-emerald-600'}`} />
        <span>CUMPLE (PASA)</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer select-none',
          isNoConforme
            ? 'bg-rose-600 text-white shadow-sm'
            : 'text-rose-700 hover:bg-rose-50/60'
        )}
      >
        <XCircle className={`w-4 h-4 ${isNoConforme ? 'text-white' : 'text-rose-600'}`} />
        <span>NO CUMPLE (FALLA)</span>
      </button>
    </div>
  );
};
