import { useEffect, useState } from 'react';
import type { FieldNode } from '../core/nodes/field-node';
import type { ArrayNode } from '../core/nodes/array-node';
import type { FormValue, ValidationError, FormFields } from '../core/types';

// ============================================================================
// Типы возвращаемых значений
// ============================================================================

interface FieldControlState<T> {
  value: T;
  pending: boolean;
  disabled: boolean;
  errors: ValidationError[];
  valid: boolean;
  invalid: boolean;
  touched: boolean;
  shouldShowError: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps: Record<string, any>;
}

interface ArrayControlState<T> {
  value: T[];
  length: number;
  pending: boolean;
  errors: ValidationError[];
  valid: boolean;
  invalid: boolean;
  touched: boolean;
  dirty: boolean;
}

// ============================================================================
// Перегрузки функции
// ============================================================================

/**
 * Хук для работы с ArrayNode - возвращает состояние массива с подписками на сигналы
 */
export function useFormControl<T extends FormFields>(
  control: ArrayNode<T> | undefined
): ArrayControlState<T>;

/**
 * Хук для работы с FieldNode - возвращает состояние поля с подписками на сигналы
 */
export function useFormControl<T extends FormValue>(control: FieldNode<T>): FieldControlState<T>;

/**
 * Хук для работы с FieldNode или ArrayNode - возвращает состояние с подписками на сигналы
 *
 * @example FieldNode
 * ```tsx
 * const { value, errors, componentProps } = useFormControl(control);
 *
 * return (
 *   <div>
 *     <input value={value} onChange={e => control.setValue(e.target.value)} />
 *     {errors.length > 0 && <span>{errors[0].message}</span>}
 *   </div>
 * );
 * ```
 *
 * @example ArrayNode
 * ```tsx
 * const { length } = useFormControl(arrayControl);
 *
 * return (
 *   <div>
 *     {arrayControl.map((item, index) => (
 *       <ItemComponent key={item.id || index} control={item} />
 *     ))}
 *     {length === 0 && <span>Список пуст</span>}
 *   </div>
 * );
 * ```
 */
export function useFormControl(
  control: FieldNode<FormValue> | ArrayNode<FormFields> | undefined
): FieldControlState<FormValue> | ArrayControlState<FormFields> {
  // Определяем тип контрола по наличию специфичных свойств
  const isArrayNode = control && 'length' in control && 'map' in control;

  // ============================================================================
  // State для ArrayNode
  // ============================================================================
  const [length, setLength] = useState(isArrayNode ? control.length.value : 0);
  const [arrayValue, setArrayValue] = useState<FormFields[]>(
    isArrayNode ? control.value.value : []
  );
  const [dirty, setDirty] = useState(isArrayNode ? control.dirty.value : false);

  // ============================================================================
  // State для FieldNode
  // ============================================================================
  const [fieldValue, setFieldValue] = useState(
    !isArrayNode && control ? (control as FieldNode<FormValue>).value.value : undefined
  );
  const [disabled, setDisabled] = useState(
    !isArrayNode && control ? (control as FieldNode<FormValue>).disabled.value : false
  );
  const [shouldShowError, setShouldShowError] = useState(
    !isArrayNode && control ? (control as FieldNode<FormValue>).shouldShowError.value : false
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [componentProps, setComponentProps] = useState<Record<string, any>>(
    !isArrayNode && control ? (control as FieldNode<FormValue>).componentProps.value : {}
  );

  // ============================================================================
  // Общий state
  // ============================================================================
  const [pending, setPending] = useState(control?.pending.value ?? false);
  const [errors, setErrors] = useState<ValidationError[]>(control?.errors.value ?? []);
  const [valid, setValid] = useState(control?.valid.value ?? true);
  const [invalid, setInvalid] = useState(control?.invalid.value ?? false);
  const [touched, setTouched] = useState(control?.touched.value ?? false);

  // ============================================================================
  // Подписки
  // ============================================================================
  useEffect(() => {
    if (!control) return;

    const unsubscribers: Array<() => void> = [];

    // Общие подписки
    unsubscribers.push(control.pending.subscribe(setPending));
    unsubscribers.push(control.errors.subscribe(setErrors));
    unsubscribers.push(control.valid.subscribe(setValid));
    unsubscribers.push(control.invalid.subscribe(setInvalid));
    unsubscribers.push(control.touched.subscribe(setTouched));

    if (isArrayNode) {
      // ArrayNode подписки
      const arrayControl = control as ArrayNode<FormFields>;
      unsubscribers.push(arrayControl.length.subscribe(setLength));
      unsubscribers.push(arrayControl.value.subscribe(setArrayValue));
      unsubscribers.push(arrayControl.dirty.subscribe(setDirty));
    } else {
      // FieldNode подписки
      const fieldControl = control as FieldNode<FormValue>;
      unsubscribers.push(fieldControl.value.subscribe(setFieldValue));
      unsubscribers.push(fieldControl.disabled.subscribe(setDisabled));
      unsubscribers.push(fieldControl.shouldShowError.subscribe(setShouldShowError));
      unsubscribers.push(fieldControl.componentProps.subscribe(setComponentProps));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [control, isArrayNode]);

  // ============================================================================
  // Возврат результата
  // ============================================================================
  if (isArrayNode) {
    return {
      value: arrayValue,
      length,
      pending,
      errors,
      valid,
      invalid,
      touched,
      dirty,
    } as ArrayControlState<FormFields>;
  }

  return {
    value: fieldValue,
    pending,
    disabled,
    errors,
    valid,
    invalid,
    touched,
    shouldShowError,
    componentProps,
  } as FieldControlState<FormValue>;
}
