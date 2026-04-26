import * as React from 'react';
import { cn } from '@/lib/utils';

/** Один вариант для {@link RadioGroup}. */
export interface RadioOption {
  value: string;
  label: string;
}

/** Props компонента {@link RadioGroup}. */
export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  className?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: RadioOption[];
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Группа радио-кнопок. `value` — строка из `options`.
 *
 * @example
 * ```tsx
 * import { RadioGroup } from '@reformer/ui-kit';
 *
 * const OPTIONS = [
 *   { value: 'consumer', label: 'Потребительский' },
 *   { value: 'mortgage', label: 'Ипотека' },
 * ];
 *
 * <RadioGroup value={loanType} onChange={setLoanType} options={OPTIONS} />
 * ```
 */
const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    { className, value, onChange, onBlur, options, disabled, 'data-testid': dataTestId, ...props },
    ref
  ) => {
    const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.value);
    };

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-2', className)}
        data-testid={dataTestId}
        {...props}
      >
        {options.map((option) => {
          const inputId = dataTestId ? `${dataTestId}-${option.value}` : `radio-${option.value}`;
          return (
            <div key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={inputId}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                className={cn(
                  'h-4 w-4 border-gray-300 text-primary focus:ring-2 focus:ring-primary',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
                onChange={handleRadioChange}
                onBlur={onBlur}
                data-testid={dataTestId ? `${dataTestId}-${option.value}` : undefined}
              />
              <label
                htmlFor={inputId}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };
