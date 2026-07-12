import { useCallback } from 'react';
import type { FieldNode } from '../nodes/field-node';
import type { ArrayNode } from '../nodes/array-node';
import type { FormValue, ValidationError } from '../types/index';
import type { FieldControlState, ArrayControlState } from './types';
import {
  useSignalSubscription,
  type SignalConfig,
  type ExtractSignalValues,
} from './useSignalSubscription';

/** @internal */
function useFieldControl<T extends FormValue>(control: FieldNode<T>): FieldControlState<T> {
  const signals = {
    value: control.value,
    disabled: control.disabled,
    errors: control.errors,
    pending: control.pending,
    valid: control.valid,
    invalid: control.invalid,
    touched: control.touched,
    dirty: control.dirty,
    shouldShowError: control.shouldShowError,
    componentProps: control.componentProps,
  };

  const configs: SignalConfig<keyof typeof signals>[] = [
    { key: 'value' },
    { key: 'disabled' },
    { key: 'errors', useShallowArrayEqual: true },
    { key: 'pending' },
    { key: 'valid' },
    { key: 'invalid' },
    { key: 'touched' },
    { key: 'dirty' },
    { key: 'shouldShowError' },
    { key: 'componentProps' },
  ];

  const buildSnapshot = useCallback(
    (values: ExtractSignalValues<typeof signals>): FieldControlState<T> => ({
      value: values.value as T,
      pending: values.pending as boolean,
      disabled: values.disabled as boolean,
      errors: values.errors as ValidationError[],
      valid: values.valid as boolean,
      invalid: values.invalid as boolean,
      touched: values.touched as boolean,
      dirty: values.dirty as boolean,
      shouldShowError: values.shouldShowError as boolean,
      componentProps: values.componentProps as Record<string, unknown>,
    }),
    []
  );

  return useSignalSubscription(signals, configs, buildSnapshot, control);
}

/** @internal */
function useArrayControl<T extends object>(control: ArrayNode<T>): ArrayControlState<T> {
  const signals = {
    value: control.value,
    length: control.length,
    errors: control.errors,
    pending: control.pending,
    valid: control.valid,
    invalid: control.invalid,
    touched: control.touched,
    dirty: control.dirty,
    disabled: control.disabled,
  };

  const configs: SignalConfig<keyof typeof signals>[] = [
    { key: 'value' },
    { key: 'length' },
    { key: 'errors', useShallowArrayEqual: true },
    { key: 'pending' },
    { key: 'valid' },
    { key: 'invalid' },
    { key: 'touched' },
    { key: 'dirty' },
    { key: 'disabled' },
  ];

  const buildSnapshot = useCallback(
    (values: ExtractSignalValues<typeof signals>): ArrayControlState<T> => ({
      value: values.value as T[],
      length: values.length as number,
      pending: values.pending as boolean,
      errors: values.errors as ValidationError[],
      valid: values.valid as boolean,
      invalid: values.invalid as boolean,
      touched: values.touched as boolean,
      dirty: values.dirty as boolean,
      disabled: values.disabled as boolean,
    }),
    []
  );

  return useSignalSubscription(signals, configs, buildSnapshot, control);
}

/**
 * @internal Ветка `control === undefined`: вызывает тот же набор хуков, что
 * `useFieldControl`/`useArrayControl` (useCallback + useSignalSubscription с пустым набором сигналов),
 * чтобы число/порядок хуков не менялись при переходе control `undefined ↔ node` (Rules of Hooks).
 */
function useEmptyControl(): ArrayControlState<object> {
  const buildSnapshot = useCallback(
    (): ArrayControlState<object> => ({
      value: [],
      length: 0,
      pending: false,
      errors: [],
      valid: true,
      invalid: false,
      touched: false,
      dirty: false,
      disabled: false,
    }),
    []
  );
  return useSignalSubscription({}, [], buildSnapshot);
}

/**
 * React-хук для подписки на состояние {@link ArrayNode}.
 *
 * @typeParam T - Тип элемента массива
 * @param control - ArrayNode или undefined
 * @returns Состояние массива {@link ArrayControlState}
 *
 * @group React Hooks
 */
export function useFormControl<T extends object>(
  control: ArrayNode<T> | undefined
): ArrayControlState<T>;

/**
 * React-хук для подписки на состояние {@link FieldNode}.
 *
 * @typeParam T - Тип значения поля
 * @param control - FieldNode для подписки
 * @returns Состояние поля {@link FieldControlState}
 *
 * @group React Hooks
 */
export function useFormControl<T extends FormValue>(control: FieldNode<T>): FieldControlState<T>;

/**
 * React-хук для подписки на состояние формы (FieldNode или ArrayNode).
 *
 * Обеспечивает реактивную связь между состоянием формы и React-компонентами.
 * Использует `useSyncExternalStore` для оптимальной интеграции с React 18+
 * и Concurrent Mode.
 *
 * ## Основные возможности
 *
 * - **Автоматическая подписка** на все сигналы контрола
 * - **Оптимизация ре-рендеров** - компонент обновляется только при реальных изменениях
 * - **Поддержка SSR** через `useSyncExternalStore`
 * - **Типобезопасность** - возвращаемый тип зависит от типа контрола
 *
 * ## Когда использовать
 *
 * Используйте `useFormControl` когда компоненту нужен доступ к нескольким
 * свойствам состояния (value, errors, touched и т.д.).
 *
 * Для подписки только на значение используйте {@link useFormControlValue} -
 * это предотвратит лишние ре-рендеры при изменении других свойств.
 *
 * @typeParam T - Тип значения (для FieldNode) или элемента (для ArrayNode)
 * @param control - FieldNode, ArrayNode или undefined
 * @returns Объект состояния {@link FieldControlState} или {@link ArrayControlState}
 *
 * @example Текстовое поле с валидацией
 * ```tsx
 * import { useFormControl } from '@reformer/core';
 * import type { FieldNode } from '@reformer/core';
 *
 * interface TextFieldProps {
 *   control: FieldNode<string>;
 *   label: string;
 * }
 *
 * function TextField({ control, label }: TextFieldProps) {
 *   const {
 *     value,
 *     disabled,
 *     shouldShowError,
 *     errors,
 *     pending
 *   } = useFormControl(control);
 *
 *   return (
 *     <div className="field">
 *       <label>{label}</label>
 *
 *       <div className="input-wrapper">
 *         <input
 *           type="text"
 *           value={value}
 *           disabled={disabled}
 *           onChange={e => control.setValue(e.target.value)}
 *           onBlur={() => control.markAsTouched()}
 *           aria-invalid={shouldShowError}
 *         />
 *         {pending && <Spinner />}
 *       </div>
 *
 *       {shouldShowError && errors[0] && (
 *         <span className="error" role="alert">
 *           {errors[0].message}
 *         </span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Checkbox с использованием componentProps
 * ```tsx
 * interface CheckboxProps {
 *   control: FieldNode<boolean>;
 * }
 *
 * function Checkbox({ control }: CheckboxProps) {
 *   const { value, disabled, componentProps } = useFormControl(control);
 *
 *   return (
 *     <label className="checkbox">
 *       <input
 *         type="checkbox"
 *         checked={value}
 *         disabled={disabled}
 *         onChange={e => control.setValue(e.target.checked)}
 *       />
 *       <span>{componentProps.label}</span>
 *       {componentProps.hint && (
 *         <small>{componentProps.hint}</small>
 *       )}
 *     </label>
 *   );
 * }
 *
 * // Использование
 * control.setComponentProps({
 *   label: 'Accept terms and conditions',
 *   hint: 'Required to continue'
 * });
 * ```
 *
 * @example Select с динамическими опциями
 * ```tsx
 * interface SelectProps {
 *   control: FieldNode<string>;
 * }
 *
 * function Select({ control }: SelectProps) {
 *   const { value, disabled, componentProps, shouldShowError, errors } = useFormControl(control);
 *   const options = componentProps.options as Array<{ value: string; label: string }>;
 *
 *   return (
 *     <div>
 *       <select
 *         value={value}
 *         disabled={disabled}
 *         onChange={e => control.setValue(e.target.value)}
 *         onBlur={() => control.markAsTouched()}
 *       >
 *         <option value="">Select...</option>
 *         {options?.map(opt => (
 *           <option key={opt.value} value={opt.value}>
 *             {opt.label}
 *           </option>
 *         ))}
 *       </select>
 *       {shouldShowError && <span className="error">{errors[0]?.message}</span>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Динамический массив элементов
 * ```tsx
 * interface Address {
 *   street: string;
 *   city: string;
 * }
 *
 * interface AddressListProps {
 *   control: ArrayNode<Address>;
 * }
 *
 * function AddressList({ control }: AddressListProps) {
 *   const { length, valid, dirty, errors } = useFormControl(control);
 *
 *   const handleAdd = () => {
 *     control.push({ street: '', city: '' });
 *   };
 *
 *   const handleRemove = (index: number) => {
 *     control.remove(index);
 *   };
 *
 *   return (
 *     <div className="address-list">
 *       <div className="header">
 *         <h3>Addresses ({length})</h3>
 *         {dirty && <span className="badge">Modified</span>}
 *       </div>
 *
 *       {errors.length > 0 && (
 *         <div className="array-errors">
 *           {errors.map((e, i) => <p key={i}>{e.message}</p>)}
 *         </div>
 *       )}
 *
 *       {control.map((item, index) => (
 *         <AddressItem
 *           key={item.id}
 *           control={item}
 *           onRemove={() => handleRemove(index)}
 *         />
 *       ))}
 *
 *       {length === 0 && (
 *         <p className="empty">No addresses added yet</p>
 *       )}
 *
 *       <button
 *         onClick={handleAdd}
 *         disabled={length >= 5}
 *       >
 *         Add Address
 *       </button>
 *
 *       {!valid && (
 *         <p className="warning">Please fix errors before submitting</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Условный рендеринг с undefined
 * ```tsx
 * interface FormProps {
 *   optionalField?: ArrayNode<string>;
 * }
 *
 * function Form({ optionalField }: FormProps) {
 *   // При undefined возвращается дефолтное состояние
 *   const { length } = useFormControl(optionalField);
 *
 *   if (!optionalField) {
 *     return null;
 *   }
 *
 *   return <div>Items: {length}</div>;
 * }
 * ```
 *
 * @see {@link useFormControlValue} - для подписки только на значение
 * @see {@link FieldControlState} - тип состояния для FieldNode
 * @see {@link ArrayControlState} - тип состояния для ArrayNode
 *
 * @group React Hooks
 */
export function useFormControl(
  control: FieldNode<FormValue> | ArrayNode<object> | undefined
): FieldControlState<FormValue> | ArrayControlState<object> {
  const isArrayNode = control && 'length' in control && 'map' in control;

  // Rules of Hooks: каждая ветка вызывает ОДИНАКОВУЮ последовательность хуков (useCallback +
  // useSignalSubscription), поэтому переключение control между undefined / FieldNode / ArrayNode
  // НЕ меняет число/порядок хуков (иначе React крашит «Rendered more hooks than previous render»).
  if (!control) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useEmptyControl();
  }

  if (isArrayNode) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useArrayControl(control as ArrayNode<object>);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useFieldControl(control as FieldNode<FormValue>);
}
