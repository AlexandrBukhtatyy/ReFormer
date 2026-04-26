import * as React from 'react';
import { cn } from '@/lib/utils';

/** Один вариант для {@link RadioGroup}. */
export interface RadioOption {
  /** Значение, попадающее в `onChange`. Должно быть строкой (DOM `value` всегда string). */
  value: string;
  /** Подпись варианта, отображаемая справа от radio. */
  label: string;
}

/** Props компонента {@link RadioGroup}. */
export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Дополнительный CSS-класс контейнера. По умолчанию вертикальная раскладка `flex flex-col gap-2`. */
  className?: string;
  /** Текущее значение. Должно совпадать с одним из `options[i].value`. `null` — ничего не выбрано. */
  value?: string | null;
  /** Обработчик выбора. Получает `event.target.value`. */
  onChange?: (value: string) => void;
  /** Срабатывает при потере фокуса любым из radio. */
  onBlur?: () => void;
  /** Список вариантов выбора. */
  options: RadioOption[];
  /** Блокирует все варианты. */
  disabled?: boolean;
  /** Test-id (используется как для контейнера, так и как префикс для каждого radio). */
  'data-testid'?: string;
}

/**
 * Группа радио-кнопок из массива `options`. По умолчанию раскладывается
 * вертикально; для горизонтальной — `className="!flex-row gap-6"`.
 *
 * @example Вертикальная раскладка
 * ```tsx
 * import { RadioGroup } from '@reformer/ui-kit';
 *
 * const LOAN_TYPES = [
 *   { value: 'consumer', label: 'Потребительский' },
 *   { value: 'mortgage', label: 'Ипотека' },
 *   { value: 'auto', label: 'Авто' },
 * ];
 *
 * <RadioGroup value={loanType} onChange={setLoanType} options={LOAN_TYPES} />
 * ```
 *
 * @example Горизонтальная раскладка размеров одежды
 * ```tsx
 * import { RadioGroup } from '@reformer/ui-kit';
 *
 * <RadioGroup
 *   value={size}
 *   onChange={setSize}
 *   className="!flex-row gap-6"
 *   options={[
 *     { value: 's', label: 'S' },
 *     { value: 'm', label: 'M' },
 *     { value: 'l', label: 'L' },
 *   ]}
 * />
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
