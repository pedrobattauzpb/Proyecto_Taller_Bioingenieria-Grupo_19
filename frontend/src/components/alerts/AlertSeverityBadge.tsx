import React from 'react';
import type { AlertSeverity } from '../../services/types';
import { cn } from '../../lib/utils';

interface AlertSeverityBadgeProps {
  severity: AlertSeverity;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const AlertSeverityBadge: React.FC<AlertSeverityBadgeProps> = ({
  severity,
  size = 'md',
  showDot = true,
  className,
}) => {
  const config: Record<
    AlertSeverity,
    { label: string; bg: string; text: string; border: string; dot: string; pulse?: boolean }
  > = {
    CRITICAL: {
      label: 'Crítica',
      bg: 'bg-[var(--danger-soft)]',
      text: 'text-[var(--danger)]',
      border: 'border-[var(--danger)]/40',
      dot: 'bg-[var(--danger)]',
      pulse: true,
    },
    HIGH: {
      label: 'Alta',
      bg: 'bg-[var(--warn-soft)]',
      text: 'text-[var(--warn)]',
      border: 'border-[var(--warn)]/40',
      dot: 'bg-[var(--warn)]',
      pulse: false,
    },
    MEDIUM: {
      label: 'Media',
      bg: 'bg-[var(--warn-soft)]',
      text: 'text-[var(--warn)]',
      border: 'border-[var(--warn)]/25',
      dot: 'bg-[var(--warn)]',
      pulse: false,
    },
    LOW: {
      label: 'Baja',
      bg: 'bg-[var(--info-soft)]',
      text: 'text-[var(--info)]',
      border: 'border-[var(--info)]/30',
      dot: 'bg-[var(--info)]',
      pulse: false,
    },
    INFO: {
      label: 'Info',
      bg: 'bg-[var(--surface-2)]',
      text: 'text-[var(--ink-soft)]',
      border: 'border-[var(--border)]',
      dot: 'bg-[var(--ink-faint)]',
      pulse: false,
    },
  };

  const current = config[severity] || config.INFO;
  const isSm = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border transition-colors select-none',
        current.bg,
        current.text,
        current.border,
        isSm ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'rounded-full shrink-0',
            current.dot,
            isSm ? 'w-1.5 h-1.5' : 'w-2 h-2',
            current.pulse && 'animate-pulse'
          )}
        />
      )}
      <span>{current.label}</span>
    </span>
  );
};
