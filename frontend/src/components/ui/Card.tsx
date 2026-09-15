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
    default: 'bg-white border border-slate-200 shadow-sm',
    elevated: 'bg-white border border-slate-200 shadow-md',
    outlined: 'bg-white border-2 border-slate-300 shadow-none',
    interactive: 'bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-150',
  };

  return (
    <div
      className={cn('rounded-2xl p-4 sm:p-5', variantClasses[variant], className)}
      {...rest}
    >
      {children}
    </div>
  );
};
