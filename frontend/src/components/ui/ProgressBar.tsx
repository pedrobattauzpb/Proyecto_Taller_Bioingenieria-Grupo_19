import React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: number; // 0 to 100
  height?: number;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showLabel = false,
  className,
  ...rest
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const getProgressColor = () => {
    if (clampedProgress >= 100) return 'bg-emerald-500';
    if (clampedProgress >= 50) return 'bg-blue-600';
    return 'bg-blue-500';
  };

  return (
    <div className={cn('w-full', className)} {...rest}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5 text-xs">
          <span className="font-semibold text-slate-500">Progreso de Inspección</span>
          <span className="font-bold text-slate-800">{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div
        className="w-full bg-slate-200 rounded-full overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div
          className={cn('rounded-full transition-all duration-300 h-full', getProgressColor())}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
