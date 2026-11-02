import React from 'react';
import type { UserRole } from '../../services/types';
import { cn } from '../../lib/utils';
import { Shield, Wrench, Eye, UserCheck } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'sm',
  showIcon = true,
  className,
}) => {
  const meta: Record<
    UserRole,
    { label: string; icon: React.ReactNode; classes: string }
  > = {
    TECHNICIAN: {
      label: 'Técnico',
      icon: <Wrench className="w-3 h-3" />,
      classes:
        'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]/20',
    },
    SUPERVISOR: {
      label: 'Supervisor',
      icon: <UserCheck className="w-3 h-3" />,
      classes:
        'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
    },
    AUDITOR: {
      label: 'Auditor',
      icon: <Eye className="w-3 h-3" />,
      classes:
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    },
    ADMIN: {
      label: 'Administrador',
      icon: <Shield className="w-3 h-3" />,
      classes:
        'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    },
  };

  const current = meta[role] || {
    label: role,
    icon: null,
    classes: 'bg-[var(--surface-2)] text-[var(--ink-soft)] border-[var(--border)]',
  };

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-[11.5px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold border tracking-tight select-none shadow-2xs',
        current.classes,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
};
