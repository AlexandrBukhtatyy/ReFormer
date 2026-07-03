import * as React from 'react';
import { cn } from '@/lib/utils';

/** Props компонента {@link Input}. */
export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue'
> {
  /** Дополнительный CSS-класс (мерджится с дефолтными Tailwind-классами через `tailwind-merge`). */
  className?: string;
  /**
   * Текущее значение поля. Для `type='number'` ожидается `number | null`,
   * для остальных — `string | null`. `null`/`undefined` рендерится как пустое поле.
   */
  value?: string | number | null;
  /**
   * Обработчик изменений. Получает уже распарсенное значение:
   * - для `type='number'` — `number` или `null` (для пустой строки),
   * - иначе — `string` или `null`.
   * `NaN` не прокидывается. При `min >= 0` отрицательные значения превращаются в `0`.
   */
  onChange?: (value: string | number | null) => void;
  /** Срабатывает при потере фокуса. Используется `FormField` для пометки `touched`. */
  onBlur?: () => void;
  /** HTML-тип input. Для `'number'` включается специальный парсинг значения. */
  type?: 'text' | 'email' | 'number' | 'tel' | 'url' | 'password';
  /** Подсказка внутри поля. */
  placeholder?: string;
  /** Блокирует ввод и редактирование. */
  disabled?: boolean;
}

/**
 * Текстовое поле ввода. Контролируемый компонент с тривиальным API: `value`/`onChange`
 * получает строку (или число для `type="number"`). Все нативные `<input>`-атрибуты
 * (кроме `value`/`onChange`) прокидываются как есть.
 *
 * @example Базовое строковое поле
 * ```tsx
 * import { Input } from '@reformer/ui-kit';
 *
 * <Input value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
 * ```
 *
 * @example Числовое поле с лимитом снизу
 * ```tsx
 * import { Input } from '@reformer/ui-kit';
 *
 * // Пустой ввод даёт null. Отрицательные значения зажимаются к 0 из-за min={0}.
 * <Input
 *   type="number"
 *   value={age}
 *   onChange={(v) => setAge(v as number | null)}
 *   min={0}
 *   placeholder="Возраст"
 * />
 * ```
 *
 * @example Привязка к полю формы через `useFormControl`
 * ```tsx
 * import { useFormControl, type FieldNode } from '@reformer/core';
 * import { Input } from '@reformer/ui-kit';
 *
 * function EmailField({ control }: { control: FieldNode<string> }) {
 *   const { value, disabled, errors, shouldShowError } = useFormControl(control);
 *   return (
 *     <Input
 *       type="email"
 *       value={value}
 *       disabled={disabled}
 *       onChange={(v) => control.setValue((v ?? '') as string)}
 *       onBlur={() => control.markAsTouched()}
 *       aria-invalid={shouldShowError}
 *       placeholder={shouldShowError ? errors[0]?.message : 'you@example.com'}
 *     />
 *   );
 * }
 * ```
 */
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
