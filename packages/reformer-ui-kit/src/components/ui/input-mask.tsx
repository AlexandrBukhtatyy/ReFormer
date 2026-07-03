import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props компонента {@link InputMask}. */
export interface InputMaskProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue'
> {
  /** Дополнительный CSS-класс. */
  className?: string;
  /** Текущее значение поля. `null`/`undefined` рендерится как пустое поле. */
  value?: string | null;
  /** Обработчик изменений. Пустая строка приводится к `null`. */
  onChange?: (value: string | null) => void;
  /** Срабатывает при потере фокуса. */
  onBlur?: () => void;
  /**
   * Шаблон маски: символ `'9'` означает «цифра», все остальные символы (`+`,
   * `-`, `(`, `)`, пробел, точка) — литералы и используются в `placeholder`.
   * Пример: `'+7 (999) 999-99-99'`.
   */
  mask?: string;
  /** Подсказка внутри поля. По умолчанию равна `mask` для подсветки формата. */
  placeholder?: string;
  /** Блокирует ввод и редактирование. */
  disabled?: boolean;
}

/**
 * Текстовое поле с поддержкой простой маски-подсказки (через шаблон вида
 * `'9'` для цифр). Маска показывается в `placeholder`, но автоматическая
 * вставка литералов **не** выполняется — компонент просто помечает формат.
 *
 * @example Маска для телефона
 * ```tsx
 * import { InputMask } from '@reformer/ui-kit';
 *
 * <InputMask
 *   value={phone}
 *   onChange={setPhone}
 *   mask="+7 (999) 999-99-99"
 * />
 * ```
 *
 * @example Маска для даты `DD.MM.YYYY`
 * ```tsx
 * import { InputMask } from '@reformer/ui-kit';
 *
 * <InputMask
 *   value={birthDate}
 *   onChange={setBirthDate}
 *   mask="99.99.9999"
 *   placeholder="Дата рождения"
 * />
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
