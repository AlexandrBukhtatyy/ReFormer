import * as React from 'react';

import { Input } from '@/components/input';

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
 * Рендерит canonical shadcn {@link Input} (`@/components/input`), надстраивая
 * value-based контракт (`value: string | null` / `onChange(string | null)` / `onBlur`).
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
      <Input
        ref={ref}
        type="text"
        data-slot="input-mask"
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder || mask}
        className={className}
        onChange={handleInputChange}
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

InputMask.displayName = 'InputMask';

export { InputMask };
