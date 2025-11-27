import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  className?: string;
  value?: string | number | null;
  onChange?: (value: string | number | null) => void;
  onBlur?: () => void;
  type?: 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
  placeholder?: string;
  disabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, value, onChange, onBlur, type = 'text', placeholder, disabled, ...props }, ref) => {
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;

      if (type === 'number') {
        if (newValue === '') {
          onChange?.(null);
        } else {
          const numValue = Number(newValue);
          // Only call onChange if the value is a valid number (not NaN)
          if (!isNaN(numValue)) {
            // Block negative values if min is 0 or positive
            const minValue = props.min !== undefined ? Number(props.min) : undefined;
            if (minValue !== undefined && minValue >= 0 && numValue < 0) {
              onChange?.(0);
            } else {
              onChange?.(numValue);
            }
          }
        }
      } else {
        onChange?.(newValue || null);
      }
    };

    const inputValue = React.useMemo(() => {
      if (value === null || value === undefined) return '';
      if (type === 'number' && typeof value === 'number') {
        // Don't render NaN values in number inputs
        if (isNaN(value)) return '';
        return value.toString();
      }
      return String(value);
    }, [value, type]);

    return (
      <input
        ref={ref}
        type={type}
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder}
        data-slot="input"
        className={cn(
          'h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          className
        )}
        onChange={handleInputChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
