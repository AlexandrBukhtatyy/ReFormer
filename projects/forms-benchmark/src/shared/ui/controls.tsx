/**
 * Нейтральные UI-примитивы бенчмарка — тонкие обёртки над нативными элементами.
 *
 * Контракт одинаков для всех библиотек: нативные пропсы проходят насквозь, `onChange` получает
 * нативное событие, `ref` — обычный проп (React 19). Поэтому React Hook Form может работать через
 * `register` (неконтролируемо), Formik — через `getFieldProps`, а ReFormer и RJSF — через свои
 * адаптеры «значение ⇄ событие». Логики форм здесь нет.
 */
import type {
  ChangeEvent,
  FocusEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { applyMask } from './mask';
import { countRender, registerPrimitives } from './instrument';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

export function TextInput({ className, ...rest }: InputProps) {
  countRender('TextInput');
  return <input className={className ? `b-input ${className}` : 'b-input'} {...rest} />;
}

export function Checkbox(props: Omit<InputProps, 'type'>) {
  countRender('Checkbox');
  return <input type="checkbox" className="b-checkbox" {...props} />;
}

export type MaskedInputProps = InputProps & { mask: string };

/**
 * Маска применяется к самому DOM-элементу ДО того, как событие уходит наружу: и
 * неконтролируемый `register`, и контролируемый `value` видят уже отформатированное значение.
 */
export function MaskedInput({ mask, onChange, ...rest }: MaskedInputProps) {
  countRender('MaskedInput');
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const masked = applyMask(event.target.value, mask);
    if (masked !== event.target.value) event.target.value = masked;
    onChange?.(event);
  };
  return <input className="b-input" inputMode="tel" onChange={handleChange} {...rest} />;
}

export interface SelectOption {
  value: string;
  label: string;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
  options: readonly SelectOption[];
  placeholder?: string;
};

export function Select({ options, placeholder = 'Выберите…', ...rest }: SelectProps) {
  countRender('Select');
  return (
    <select className="b-select" {...rest}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea(props: TextareaProps) {
  countRender('Textarea');
  return <textarea className="b-textarea" {...props} />;
}

/**
 * Число: `input type="number"`. Значение в DOM и в `event.target.value` — СТРОКА (`''` — пусто);
 * в число переводит привязка библиотеки (`parseNumberInput` / `formatNumberInput` из
 * `domain/credit`): пусто → `null`. Нативные `min`/`max`/`step` не ставятся — правила у библиотеки.
 */
export function NumberInput({ className, ...rest }: Omit<InputProps, 'type'>) {
  countRender('NumberInput');
  return (
    <input type="number" className={className ? `b-input ${className}` : 'b-input'} {...rest} />
  );
}

/** Дата: `input type="date"`, значение — `YYYY-MM-DD` или `''`. */
export function DateInput({ className, ...rest }: Omit<InputProps, 'type'>) {
  countRender('DateInput');
  return <input type="date" className={className ? `b-input ${className}` : 'b-input'} {...rest} />;
}

type GroupAttrs = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onBlur' | 'defaultValue'>;

export interface RadioGroupProps extends GroupAttrs {
  name: string;
  options: readonly SelectOption[];
  /** Контролируемый режим: отмечена опция с этим значением. Без `value` — неконтролируемый. */
  value?: string;
  /** Неконтролируемый режим без библиотеки (baseline). */
  defaultValue?: string;
  /** Нативное событие радиокнопки: `event.target.value` — значение опции, `name` — имя поля. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Ставится на КАЖДУЮ радиокнопку: callback-ref (`register` RHF) получает их все. */
  ref?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/**
 * Группа нативных радиокнопок с одним `name`. Атрибуты контракта (`controlAttrs`: id, testid,
 * aria) ложатся на контейнер `role="radiogroup"` (`input-{path}`); у кнопки — `input-{path}-{value}`
 * и id `{id}-{value}`.
 *
 * Привязка: RHF — `{...register(name)}` (без `value`, кнопки неконтролируемые, RHF отмечает их
 * через ref); Formik — `{...getFieldProps(name)}` (`value` + `handleChange`, который читает
 * `event.target.name/value`); ReFormer/RJSF — `value` + `onChange(e => set(e.target.value))`.
 */
export function RadioGroup({
  name,
  options,
  value,
  defaultValue,
  onChange,
  onBlur,
  ref,
  disabled,
  ...groupAttrs
}: RadioGroupProps) {
  countRender('RadioGroup');
  const attrs = groupAttrs as GroupAttrs & { id?: string; 'data-testid'?: string };
  const testId = attrs['data-testid'];
  return (
    <div role="radiogroup" className="b-radio-group" {...groupAttrs}>
      {options.map((o) => (
        <label key={o.value} className="b-radio">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === undefined ? undefined : value === o.value}
            defaultChecked={defaultValue === undefined ? undefined : defaultValue === o.value}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
            disabled={disabled}
            id={attrs.id ? `${attrs.id}-${o.value}` : undefined}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export interface ReadonlyValueProps {
  /** Путь DOM-контракта (`computed-{path}`). */
  path: string;
  label: string;
  /** Уже вычисленное значение; `null`/`undefined` — пусто. Числа выводятся `String(n)` (без разрядов). */
  value: string | number | null | undefined;
}

/** Вычисляемое поле (C.1–C.8): подпись и `<output data-testid="computed-{path}">`, без контрола. */
export function ReadonlyValue({ path, label, value }: ReadonlyValueProps) {
  countRender('ReadonlyValue');
  return (
    <div className="b-field b-computed">
      <span className="b-label" id={`c-${path}`}>
        {label}
      </span>
      <output
        className="b-computed__value"
        aria-labelledby={`c-${path}`}
        data-testid={`computed-${path}`}
      >
        {value == null ? '' : String(value)}
      </output>
    </div>
  );
}

registerPrimitives({
  TextInput,
  Checkbox,
  MaskedInput,
  Select,
  Textarea,
  NumberInput,
  DateInput,
  RadioGroup,
  ReadonlyValue,
});
