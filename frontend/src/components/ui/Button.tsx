import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onClick,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  className,
  ...rest
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (onClick) onClick(e);
    if (onPress) onPress();
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--accent)] hover:opacity-90 text-white border-transparent shadow-xs',
    secondary: 'bg-[var(--surface-2)] hover:opacity-90 text-[var(--ink)] border border-[var(--border)] shadow-xs',
    success: 'bg-[var(--ok)] hover:opacity-90 text-white border-transparent shadow-xs',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border-transparent shadow-xs',
    outline: 'bg-transparent hover:bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)]',
    ghost: 'bg-transparent hover:bg-[var(--surface-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] border-transparent',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs min-h-[34px]',
    md: 'px-4 py-2 text-sm min-h-[38px]',
    lg: 'px-6 py-2.5 text-base min-h-[44px]',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-lg border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'opacity-60 cursor-not-allowed active:scale-100 bg-[var(--surface-2)] text-[var(--ink-faint)] border-[var(--border)]',
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <span className="inline-flex items-center justify-center gap-2">
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {title || children}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </span>
      )}
    </button>
  );
};
