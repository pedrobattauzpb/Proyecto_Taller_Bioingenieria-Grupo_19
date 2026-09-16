import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className,
  ...rest
}) => {
  const variantClasses = {
    default: 'bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow)]',
    elevated: 'bg-[var(--surface)] border border-[var(--border)] shadow-md',
    outlined: 'bg-[var(--surface)] border-2 border-[var(--border)] shadow-none',
    interactive: 'bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow)] hover:border-[var(--accent)] transition-all duration-150',
  };

  return (
    <div
      className={cn('rounded-xl p-4 sm:p-5 text-[var(--ink)] transition-colors', variantClasses[variant], className)}
      {...rest}
    >
      {children}
    </div>
  );
};
