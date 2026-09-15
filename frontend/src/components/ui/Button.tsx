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
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-sm',
    outline: 'bg-transparent hover:bg-blue-50 text-blue-600 border-blue-500 border-1.5',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border-transparent',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[42px]',
    lg: 'px-6 py-3 text-base min-h-[50px]',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-xl border transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'opacity-60 cursor-not-allowed active:scale-100 bg-slate-200 text-slate-400 border-slate-300',
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
