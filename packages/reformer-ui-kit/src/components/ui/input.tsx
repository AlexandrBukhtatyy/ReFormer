import * as React from 'react';
import { cn } from '@/lib/utils';
import { deriveNumberDisplay, resolveEmittedNumber } from './input-number-buffer';

/** Общие props компонента {@link Input}, не зависящие от `type`. */
interface InputBaseProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue' | 'type'
> {
  /** Дополнительный CSS-класс (мерджится с дефолтными Tailwind-классами через `tailwind-merge`). */
  className?: string;
  /** Срабатывает при потере фокуса. Используется `FormField` для пометки `touched`. */
  onBlur?: () => void;
  /** Подсказка внутри поля. */
  placeholder?: string;
  /** Блокирует ввод и редактирование. */
  disabled?: boolean;
}

/** Props числового поля (`type="number"`): `value`/`onChange` работают с `number`. */
export interface NumberInputProps extends InputBaseProps {
  /** HTML-тип input. Включает специальный парсинг значения. */
  type: 'number';
  /** Текущее значение. `null`/`undefined` рендерится как пустое поле. */
  value?: number | null;
  /**
   * Обработчик изменений. Получает уже распарсенное `number` или `null` (для пустой строки).
   * `NaN` не прокидывается. При `min >= 0` отрицательные значения превращаются в `0`.
   */
  onChange?: (value: number | null) => void;
}

/** Props строкового поля (любой `type`, кроме `number`): `value`/`onChange` — строковые. */
export interface TextInputProps extends InputBaseProps {
  /** HTML-тип input. По умолчанию `'text'`. */
  type?: 'text' | 'email' | 'tel' | 'url' | 'password';
  /** Текущее значение. `null`/`undefined` рендерится как пустое поле. */
  value?: string | null;
  /** Обработчик изменений. Получает строку или `null` (для пустой строки). */
  onChange?: (value: string | null) => void;
}

/**
 * Props компонента {@link Input} — дискриминированный union по `type`:
 * `type="number"` даёт `number | null` для `value`/`onChange`, любой другой `type` — `string | null`.
 */
export type InputProps = NumberInputProps | TextInputProps;

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
 *   onChange={setAge}
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
 *       onChange={(v) => control.setValue(v ?? '')}
 *       onBlur={() => control.markAsTouched()}
 *       aria-invalid={shouldShowError}
 *       placeholder={shouldShowError ? errors[0]?.message : 'you@example.com'}
 *     />
 *   );
 * }
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const type = props.type ?? 'text';

  // Сырой строковый буфер для `type="number"`: удерживает промежуточные и
  // неканонические состояния ввода («1.», «1.50», «0.05», «-», ведущие нули),
  // которые схлопнулись бы при round-trip через `Number(...).toString()`.
  // Для остальных типов не используется (значение и так строка).
  const [rawNumberInput, setRawNumberInput] = React.useState<string | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;

    // Сужаем union по `props.type` (не деструктурируя дискриминант) — тогда `props.onChange`
    // типизирован точно (`number|null` / `string|null`) и вызовы ниже без единого каста.
    if (props.type === 'number') {
      // Запоминаем сырую строку до канонизации — из неё выводим отображение.
      setRawNumberInput(newValue);
      const minValue = props.min !== undefined ? Number(props.min) : undefined;
      const result = resolveEmittedNumber(newValue, minValue);
      // Частичный ввод («-», «.», «1e») не эмитим — поле не откатывается,
      // но буфер сохранит набранное.
      if (result.emit) {
        props.onChange?.(result.value);
      }
    } else {
      props.onChange?.(newValue || null);
    }
  };

  const inputValue = React.useMemo(() => {
    if (props.type === 'number') {
      // Показываем сырой буфер, пока он согласован с value; иначе — каноническое
      // value.toString() (внешнее изменение value выигрывает).
      return deriveNumberDisplay(rawNumberInput, props.value);
    }
    const value = props.value;
    if (value === null || value === undefined) return '';
    return String(value);
  }, [props.value, props.type, rawNumberInput]);

  // Нативные атрибуты (min/max/name/id/aria-*/…) прокидываем как есть. value/onChange/type читаем
  // через `props` (для сужения union), className/onBlur/placeholder/disabled рендерим явно —
  // поэтому исключаем их из rest (`_`-префикс: eslint varsIgnorePattern).
  const {
    className,
    onBlur,
    placeholder,
    disabled,
    value: _value,
    onChange: _onChange,
    type: _type,
    ...nativeRest
  } = props;

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
      {...nativeRest}
    />
  );
});

Input.displayName = 'Input';

export { Input };
