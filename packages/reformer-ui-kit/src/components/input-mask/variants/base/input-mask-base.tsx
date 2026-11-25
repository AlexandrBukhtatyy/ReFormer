import * as React from 'react';

import { Input } from '@/components/input';
import { withFieldTooltip, INSIDE_INPUT } from '@/fields/field-tooltip';
import { applyMask } from '@/lib/apply-mask';

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
   * `-`, `(`, `)`, пробел, точка) — литералы. Ввод форматируется по маске: цифры
   * встают в слоты, литералы подставляются; шаблон же — `placeholder` по умолчанию.
   * Пример: `'+7 (999) 999-99-99'`.
   */
  mask?: string;
  /** Подсказка внутри поля. По умолчанию равна `mask` для подсветки формата. */
  placeholder?: string;
  /** Блокирует ввод и редактирование. */
  disabled?: boolean;
}

/**
 * Текстовое поле с простой маской (шаблон вида `'9'` для цифр). Ввод форматируется по
 * маске: нецифровые символы отбрасываются, цифры встают в слоты, литералы шаблона
 * подставляются перед следующей цифрой — `9001234567` в маске `+7 (999) 999-99-99`
 * даёт `+7 (900) 123-45-67`. Шаблон же показывается в `placeholder`.
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
const InputMaskBase = React.forwardRef<HTMLInputElement, InputMaskProps>(
  ({ className, value, onChange, onBlur, mask, placeholder, disabled, ...props }, ref) => {
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const typed = event.target.value;
      const newValue = mask ? applyMask(typed, mask) : typed;
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

/**
 * InputMask + проп `tooltip`. Уже value-based (`value: string | null`, `onChange(string | null)`) —
 * адаптер не нужен, в форме кладётся в `component` как есть.
 */
const InputMask = withFieldTooltip(InputMaskBase, INSIDE_INPUT);
InputMask.displayName = 'InputMask';

export { InputMask };
