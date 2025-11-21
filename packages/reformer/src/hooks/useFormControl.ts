import { useMemo } from 'react';
import type { FieldNode } from '../core/nodes/field-node';
import type { FormValue } from '../core/types';

/**
 * Хук для работы с FieldNode - возвращает сигналы напрямую
 *
 * Оптимальный способ использования: сигналы можно использовать напрямую в JSX,
 * они автоматически обновляют компонент при изменении.
 *
 * @example
 * ```tsx
 * const { value, errors } = useFormControl(control);
 *
 * return (
 *   <div>
 *     <input value={value.value} onChange={e => control.setValue(e.target.value)} />
 *     {errors.value.length > 0 && <span>{errors.value[0].message}</span>}
 *   </div>
 * );
 * ```
 */
export const useFormControl = <T extends FormValue>(control: FieldNode<T>) => {
  return useMemo(
    () => ({
      value: control.value,
      errors: control.errors,
      pending: control.pending,
      disabled: control.disabled,
      touched: control.touched,
      dirty: control.dirty,
      valid: control.valid,
      invalid: control.invalid,
      shouldShowError: control.shouldShowError,
    }),
    [control]
  );
};

/**
 * Тип для возвращаемого значения useFormControlSignals
 */
export type FormControlState<T extends FormValue> = ReturnType<typeof useFormControl<T>>;
