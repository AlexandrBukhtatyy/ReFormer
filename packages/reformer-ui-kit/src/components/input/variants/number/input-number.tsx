import * as React from 'react';

import { Input } from '../base/input-base';
import { deriveNumberDisplay, resolveEmittedNumber } from './input-number-buffer';

/** Props {@link InputNumber}: native input без `type`/`value`/`onChange` + числовой контракт. */
export interface InputNumberProps extends Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'ref'
> {
  /** Текущее число. `null` — пусто. */
  value?: number | null;
  /** Новое число; пустой ввод → `null`. Частичный ввод («-», «.», «1e») не эмитится. */
  onChange?: (value: number | null) => void;
  /** Подсказка-тултип у иконки (i) внутри поля. */
  tooltip?: string;
}

/**
 * Числовое поле: stateful-вариант Input с сырым строковым буфером. Буфер удерживает
 * промежуточные/неканонические состояния ввода («1.», «1.50», «0.05», «-», ведущие нули), которые
 * схлопнулись бы при round-trip через `Number(...).toString()` (логика — `input-number-buffer.ts`,
 * его тесты — guard).
 *
 * Контракт уже value-based (`value: number | null`, `onChange(number | null)`), поэтому адаптер не
 * нужен: в форме кладётся в `component` как есть. Ref уходит на `<input>` — базовый `FieldHandle`
 * строит обёртка поля.
 */
const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  { value, onChange, onBlur, min, ...rest },
  ref
) {
  const [rawNumberInput, setRawNumberInput] = React.useState<string | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setRawNumberInput(newValue);
    const minValue = min !== undefined ? Number(min) : undefined;
    const result = resolveEmittedNumber(newValue, minValue);
    // Частичный ввод («-», «.», «1e») не эмитим — поле не откатывается, но буфер хранит набранное.
    if (result.emit) onChange?.(result.value);
  };

  const display = deriveNumberDisplay(rawNumberInput, value);

  return (
    <Input
      ref={ref}
      {...rest}
      type="number"
      value={display}
      min={min}
      onChange={handleInputChange}
      onBlur={onBlur}
    />
  );
});
InputNumber.displayName = 'InputNumber';

export { InputNumber };
