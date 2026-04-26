import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props компонента {@link InputMask}. */
export interface InputMaskProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  mask?: string; // Простая маска (например: '999-999-999 99')
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Текстовое поле с поддержкой простой маски (через шаблон вида `'9'` для цифр).
 *
 * @example
 * ```tsx
 * import { InputMask } from '@reformer/ui-kit';
 *
 * <InputMask value={phone} onChange={setPhone} mask="+7 (999) 999-99-99" />
 * ```
 */
const InputMask = React.forwardRef<HTMLInputElement, InputMaskProps>(
  ({ className, value, onChange, onBlur, mask, placeholder, disabled, ...props }, ref) => {
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange?.(newValue || null);
    };

    const inputValue = React.useMemo(() => {
      if (value === null || value === undefined) return '';
      return String(value);
    }, [value]);

    return (
      <input
        ref={ref}
        type="text"
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder || mask}
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

InputMask.displayName = 'InputMask';

export { InputMask };
