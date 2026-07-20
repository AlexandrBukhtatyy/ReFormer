import * as React from 'react';

import { Input } from '../base/input-base';
import { type FieldHandle, makeElementFieldHandle } from '@/fields/field-handle';
import { deriveNumberDisplay, resolveEmittedNumber } from './input-number-buffer';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Числовое поле (`type="number"`): stateful-обёртка над pure `Input` с сырым строковым буфером.
 * Буфер удерживает промежуточные/неканонические состояния ввода («1.», «1.50», «0.05», «-», ведущие
 * нули), которые схлопнулись бы при round-trip через `Number(...).toString()`. Логику держим байт-в-байт
 * с v6 (`input-number-buffer.ts` перенесён из carry; его тесты — guard).
 *
 * Value-based контракт seam: `value: number | null`, `onChange(number | null)` — number-буфер живёт здесь,
 * а не в примитиве (примитив остаётся pure), поэтому этот вариант не проходит через generic withFormControl.
 *
 * `forwardRef`: вариант минует HOC, поэтому baseline {@link FieldHandle} собирает сам —
 * тем же {@link makeElementFieldHandle}, что и `withFormControl`.
 */
export const InputNumberField = React.forwardRef<FieldHandle, Record<string, unknown>>(
  function InputNumberField(props, ref) {
    const { value, onChange, onBlur, control: _control, min, ...rest } = props;
    void _control;
    const emit = onChange as ((v: number | null) => void) | undefined;
    const [rawNumberInput, setRawNumberInput] = React.useState<string | null>(null);
    const elRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => makeElementFieldHandle(elRef), []);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setRawNumberInput(newValue);
      const minValue = min !== undefined ? Number(min) : undefined;
      const result = resolveEmittedNumber(newValue, minValue);
      // Частичный ввод («-», «.», «1e») не эмитим — поле не откатывается, но буфер хранит набранное.
      if (result.emit) emit?.(result.value);
    };

    const display = deriveNumberDisplay(rawNumberInput, value as number | null | undefined);

    return (
      <Input
        ref={elRef}
        {...(rest as any)}
        type="number"
        value={display}
        min={min as number | undefined}
        onChange={handleInputChange}
        onBlur={onBlur ? () => (onBlur as () => void)() : undefined}
      />
    );
  }
);
InputNumberField.displayName = 'InputNumberField';
