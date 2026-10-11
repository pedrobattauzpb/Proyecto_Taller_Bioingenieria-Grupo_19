import React from 'react';
import type { AlertStatus } from '../../services/types';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle, Clock, VolumeX } from 'lucide-react';

interface AlertStatusBadgeProps {
  status: AlertStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const AlertStatusBadge: React.FC<AlertStatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const isSm = size === 'sm';

  const config: Record<
    AlertStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    OPEN: {
      label: 'Abierta',
      bg: 'bg-[var(--danger-soft)]',
      text: 'text-[var(--danger)]',
      border: 'border-[var(--danger)]/30',
      icon: AlertCircle,
    },
    ACKNOWLEDGED: {
      label: 'Reconocida',
      bg: 'bg-[var(--warn-soft)]',
      text: 'text-[var(--warn)]',
      border: 'border-[var(--warn)]/30',
      icon: Clock,
    },
    RESOLVED: {
      label: 'Resuelta',
      bg: 'bg-[var(--ok-soft)]',
      text: 'text-[var(--ok)]',
      border: 'border-[var(--ok)]/30',
      icon: CheckCircle,
    },
    AUTO_RESOLVED: {
      label: 'Auto-resuelta',
      bg: 'bg-[var(--ok-soft)]',
      text: 'text-[var(--ok)]',
      border: 'border-[var(--ok)]/30',
      icon: CheckCircle,
    },
    SILENCED: {
      label: 'Silenciada',
      bg: 'bg-[var(--surface-2)]',
      text: 'text-[var(--ink-soft)]',
      border: 'border-[var(--border)]',
      icon: VolumeX,
    },
  };

  const current = config[status] || config.OPEN;
  const Icon = current.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold rounded-md border select-none transition-colors',
        current.bg,
        current.text,
        current.border,
        isSm ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
    >
      <Icon className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{current.label}</span>
    </span>
  );
};
