import React from 'react';
import { ShieldCheck, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NormativeBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  reference: string;
}

export const NormativeBadge: React.FC<NormativeBadgeProps> = ({ reference, className, ...rest }) => {
  if (!reference) return null;

  const isRes1130 = reference.toLowerCase().includes('res1130') || reference.toLowerCase().includes('1130');
  const isISO = reference.toLowerCase().includes('iso');

  const formatText = (ref: string) => {
    return ref
      .replace('ISO7396-1:', 'ISO 7396-1 · ')
      .replace('ISO 7396-1:', 'ISO 7396-1 · ')
      .replace('Res1130/2000:', 'Res. 1130/2000 · cl. ')
      .replace('Res 1130/2000:', 'Res. 1130/2000 · cl. ');
  };

  const formatted = formatText(reference);
  const colorClasses = isRes1130
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : isISO
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-slate-50 border-slate-200 text-slate-700';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 py-0.5 px-2 rounded-md border text-[11px] font-bold tracking-tight select-none',
        colorClasses,
        className
      )}
      {...rest}
    >
      {isRes1130 ? (
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-blue-600" />
      ) : (
        <BookOpen className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
      )}
      <span>{formatted}</span>
    </div>
  );
};
