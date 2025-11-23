import { useEffect, useState } from 'react';
import type { FieldNode } from '../core/nodes/field-node';
import type { FormValue } from '../core/types';

/**
 * Хук для работы с FieldNode - возвращает состояние поля с подписками на сигналы
 *
 * @example
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
 */
export const useFormControl = (control: FieldNode<FormValue>) => {
  const [value, setValue] = useState(control.value.value);
  const [pending, setPending] = useState(control.pending.value);
  const [disabled, setDisabled] = useState(control.disabled.value);
  const [errors, setErrors] = useState(control.errors.value);
  const [valid, setValid] = useState(control.valid.value);
  const [invalid, setInvalid] = useState(control.invalid.value);
  const [touched, setTouched] = useState(control.touched.value);
  const [shouldShowError, setShouldShowError] = useState(control.shouldShowError.value);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [componentProps, setComponentProps] = useState<Record<string, any>>(
    control.componentProps.value
  );

  // Подписка на сигналы для обновления состояния компонента
  useEffect(() => {
    const unsubscribeValue = control.value.subscribe((state) => setValue(state));
    const unsubscribePending = control.pending.subscribe((state) => setPending(state));
    const unsubscribeDisabled = control.disabled.subscribe((state) => setDisabled(state));
    const unsubscribeErrors = control.errors.subscribe((state) => setErrors(state));
    const unsubscribeValid = control.valid.subscribe((state) => setValid(state));
    const unsubscribeInvalid = control.invalid.subscribe((state) => setInvalid(state));
    const unsubscribeTouched = control.touched.subscribe((state) => setTouched(state));
    const unsubscribeShouldShowError = control.shouldShowError.subscribe((state) =>
      setShouldShowError(state)
    );
    const unsubscribeComponentProps = control.componentProps.subscribe((state) =>
      setComponentProps(state)
    );

    // Очистка подписок при размонтировании компонента
    return () => {
      unsubscribeValue();
      unsubscribeErrors();
      unsubscribePending();
      unsubscribeDisabled();
      unsubscribeValid();
      unsubscribeInvalid();
      unsubscribeTouched();
      unsubscribeShouldShowError();
      unsubscribeComponentProps();
    };
  }, [control]);

  return {
    value,
    pending,
    disabled,
    errors,
    valid,
    invalid,
    touched,
    shouldShowError,
    componentProps,
  };
};

/**
 * Тип для возвращаемого значения useFormControlSignals
 */
// export type FormControlState<T extends FormValue> = ReturnType<typeof useFormControl<T>>;
