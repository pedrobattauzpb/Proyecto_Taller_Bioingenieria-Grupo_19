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
    : 'border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100';

  return (
    <div className={cn('my-1 flex flex-col', className)}>
      {label && <label className="text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">{label}</label>}
      <div
        className={cn(
          'flex items-center rounded-xl border-1.5 transition-all overflow-hidden bg-white',
          borderClass,
          isDisabled && 'bg-slate-50 opacity-80 cursor-not-allowed'
        )}
      >
        {multiline ? (
          <textarea
            rows={numberOfLines}
            value={value ?? ''}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isDisabled}
            className="flex-1 w-full p-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 bg-transparent outline-none resize-y min-h-[72px]"
          />
        ) : (
          <input
            value={value ?? ''}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isDisabled}
            className="flex-1 w-full px-3.5 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 bg-transparent outline-none"
            {...rest}
          />
        )}
        {unit && (
          <div className="bg-slate-100 border-l border-slate-200 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-600 select-none flex items-center justify-center">
            {unit}
          </div>
        )}
      </div>
      {error ? (
        <span className="text-xs text-rose-600 font-medium mt-1">{error}</span>
      ) : warning ? (
        <span className="text-xs text-amber-600 font-medium mt-1">{warning}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-500 mt-1">{helperText}</span>
      ) : null}
    </div>
  );
};
