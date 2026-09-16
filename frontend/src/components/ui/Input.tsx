import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  unit?: string;
  error?: string;
  warning?: string;
  helperText?: string;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  onChangeText?: (text: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  unit,
  error,
  warning,
  helperText,
  multiline = false,
  numberOfLines = 3,
  editable = true,
  disabled,
  value,
  onChangeText,
  onChange,
  placeholder,
  className,
  ...rest
}) => {
  const isInvalid = !!error;
  const isWarning = !!warning && !error;
  const isDisabled = disabled !== undefined ? disabled : !editable;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onChange) onChange(e);
    if (onChangeText) onChangeText(e.target.value);
  };

  const borderClass = isInvalid
    ? 'border-rose-500 focus-within:ring-2 focus-within:ring-rose-200'
    : isWarning
    ? 'border-amber-500 focus-within:ring-2 focus-within:ring-amber-200'
    : 'border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]';

  return (
    <div className={cn('my-1 flex flex-col', className)}>
      {label && <label className="text-xs sm:text-sm font-semibold text-[var(--ink)] mb-1.5">{label}</label>}
      <div
        className={cn(
          'flex items-center rounded-lg border transition-all overflow-hidden bg-[var(--surface)]',
          borderClass,
          isDisabled && 'bg-[var(--surface-2)] opacity-80 cursor-not-allowed'
        )}
      >
        {multiline ? (
          <textarea
            rows={numberOfLines}
            value={value ?? ''}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isDisabled}
            className="flex-1 w-full p-3 text-sm sm:text-base text-[var(--ink)] placeholder:text-[var(--ink-faint)] bg-transparent outline-none resize-y min-h-[72px]"
          />
        ) : (
          <input
            value={value ?? ''}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isDisabled}
            className="flex-1 w-full px-3.5 py-2 text-sm sm:text-base text-[var(--ink)] placeholder:text-[var(--ink-faint)] bg-transparent outline-none"
            {...rest}
          />
        )}
        {unit && (
          <div className="bg-[var(--surface-2)] border-l border-[var(--border)] px-3 py-2 text-xs sm:text-sm font-bold text-[var(--ink-soft)] select-none flex items-center justify-center">
            {unit}
          </div>
        )}
      </div>
      {error ? (
        <span className="text-xs text-rose-500 font-medium mt-1">{error}</span>
      ) : warning ? (
        <span className="text-xs text-amber-500 font-medium mt-1">{warning}</span>
      ) : helperText ? (
        <span className="text-xs text-[var(--ink-faint)] mt-1">{helperText}</span>
      ) : null}
    </div>
  );
};
