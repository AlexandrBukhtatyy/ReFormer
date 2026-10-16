import type { FormArray, FormControl, ValidationIssue } from '../../../form/types/index';
import { isFormArray } from '../../../form/type-guards';
import type { FieldControlState, ArrayControlState } from './types';
import {
  useSignalSubscription,
  type SignalConfig,
  type ExtractSignalValues,
} from './useSignalSubscription';

/** @internal */
function useFieldControl<T>(control: FormControl<T>): FieldControlState<T> {
  const signals = {
    value: control.value,
    disabled: control.disabled,
    issues: control.issues,
    pending: control.pending,
    valid: control.valid,
    invalid: control.invalid,
    touched: control.touched,
    dirty: control.dirty,
    shouldShowError: control.shouldShowError,
    shouldShowIssues: control.shouldShowIssues,
    componentProps: control.componentProps,
  };

  const configs: SignalConfig<keyof typeof signals>[] = [
    { key: 'value' },
    { key: 'disabled' },
    { key: 'issues', useShallowArrayEqual: true },
    { key: 'pending' },
    { key: 'valid' },
    { key: 'invalid' },
    { key: 'touched' },
    { key: 'dirty' },
    { key: 'shouldShowError' },
    { key: 'shouldShowIssues' },
    // `updateComponentProps` всегда отдаёт новый объект: те же значения поле не перерисовывают.
    { key: 'componentProps', useShallowObjectEqual: true },
  ];

  const buildSnapshot = (values: ExtractSignalValues<typeof signals>): FieldControlState<T> => ({
    value: values.value as T,
    pending: values.pending as boolean,
    disabled: values.disabled as boolean,
    issues: values.issues as ValidationIssue[],
    valid: values.valid as boolean,
    invalid: values.invalid as boolean,
    touched: values.touched as boolean,
    dirty: values.dirty as boolean,
    shouldShowError: values.shouldShowError as boolean,
    shouldShowIssues: values.shouldShowIssues as boolean,
    componentProps: values.componentProps as Record<string, unknown>,
  });

  return useSignalSubscription(signals, configs, buildSnapshot, control);
}

/** @internal */
function useArrayControl<T extends object>(control: FormArray<T>): ArrayControlState<T> {
  // Длина — из значения: `value` — массив значений строк, он и так в подписке.
  const signals = {
    value: control.value,
    issues: control.issues,
    ownIssues: control.ownIssues,
    pending: control.pending,
    valid: control.valid,
    invalid: control.invalid,
    touched: control.touched,
    dirty: control.dirty,
    disabled: control.disabled,
  };

  const configs: SignalConfig<keyof typeof signals>[] = [
    { key: 'value' },
    { key: 'issues', useShallowArrayEqual: true },
    { key: 'ownIssues', useShallowArrayEqual: true },
    { key: 'pending' },
    { key: 'valid' },
    { key: 'invalid' },
    { key: 'touched' },
    { key: 'dirty' },
    { key: 'disabled' },
  ];

  const buildSnapshot = (values: ExtractSignalValues<typeof signals>): ArrayControlState<T> => ({
    value: values.value as T[],
    length: (values.value as T[]).length,
    pending: values.pending as boolean,
    issues: values.issues as ValidationIssue[],
    ownIssues: values.ownIssues as ValidationIssue[],
    valid: values.valid as boolean,
    invalid: values.invalid as boolean,
    touched: values.touched as boolean,
    dirty: values.dirty as boolean,
    disabled: values.disabled as boolean,
  });

  return useSignalSubscription(signals, configs, buildSnapshot, control);
}

/**
 * @internal Ветка `control === undefined`: вызывает тот же набор хуков, что
 * `useFieldControl`/`useArrayControl` (useSignalSubscription с пустым набором сигналов), чтобы
 * число/порядок хуков не менялись при переходе control `undefined ↔ node` (Rules of Hooks).
 *
 * Построители снапшота — обычные функции, без `useCallback`: у трёх веток одна позиция хука, и
 * мемоизированный построитель прежней ветки достался бы новой (поле → массив дало бы снапшот
 * без `length`). Идентичность построителя не важна — `useSignalSubscription` держит его в ref.
 */
function useEmptyControl(): ArrayControlState<object> {
  const buildSnapshot = (): ArrayControlState<object> => ({
    value: [],
    length: 0,
    pending: false,
    issues: [],
    ownIssues: [],
    valid: true,
    invalid: false,
    touched: false,
    dirty: false,
    disabled: false,
  });
  return useSignalSubscription({}, [], buildSnapshot);
}

/**
 * React-хук для подписки на состояние {@link FormArray}.
 *
 * @typeParam T - Тип элемента массива
 * @param control - FormArray или undefined
 * @returns Состояние массива {@link ArrayControlState}
 *
 * @group React Hooks
 */
export function useFormControl<T extends object>(
  control: FormArray<T> | undefined
): ArrayControlState<T>;

/**
 * React-хук для подписки на состояние {@link FormControl}.
 *
 * @typeParam T - Тип значения поля
 * @param control - FormControl для подписки
 * @returns Состояние поля {@link FieldControlState}
 *
 * @group React Hooks
 */
export function useFormControl<T>(control: FormControl<T>): FieldControlState<T>;

/**
 * React-хук для подписки на состояние формы (FormControl или FormArray).
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
 * свойствам состояния (value, issues, touched и т.д.).
 *
 * Для подписки только на значение используйте {@link useFormControlValue} -
 * это предотвратит лишние ре-рендеры при изменении других свойств.
 *
 * @typeParam T - Тип значения (для FormControl) или элемента (для FormArray)
 * @param control - FormControl, FormArray или undefined
 * @returns Объект состояния {@link FieldControlState} или {@link ArrayControlState}
 *
 * @example Текстовое поле с валидацией
 * ```tsx
 * import { useFormControl, useIssueMessage } from '@reformer/core/react';
 * import type { FormControl } from '@reformer/core';
 *
 * interface TextFieldProps {
 *   control: FormControl<string>;
 *   label: string;
 * }
 *
 * function TextField({ control, label }: TextFieldProps) {
 *   const {
 *     value,
 *     disabled,
 *     shouldShowError,
 *     shouldShowIssues,
 *     issues,
 *     pending
 *   } = useFormControl(control);
 *   // Текст ошибки даёт резолвер: у правил без своего сообщения `message` пуст.
 *   const message = useIssueMessage();
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
 *       {shouldShowIssues && issues[0] && (
 *         <span className="error" role="alert">
 *           {message(issues[0])}
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
 *   control: FormControl<boolean>;
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
 * control.updateComponentProps({
 *   label: 'Accept terms and conditions',
 *   hint: 'Required to continue'
 * });
 * ```
 *
 * @example Select с динамическими опциями
 * ```tsx
 * interface SelectProps {
 *   control: FormControl<string>;
 * }
 *
 * function Select({ control }: SelectProps) {
 *   const { value, disabled, componentProps, shouldShowIssues, issues } = useFormControl(control);
 *   const message = useIssueMessage(); // из '@reformer/core/react'
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
 *       {shouldShowIssues && <span className="error">{message(issues[0])}</span>}
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
 *   control: FormArray<Address>;
 * }
 *
 * function AddressList({ control }: AddressListProps) {
 *   const { length, valid, dirty, issues } = useFormControl(control);
 *   const message = useIssueMessage(); // из '@reformer/core/react'
 *
 *   const handleAdd = () => {
 *     control.push({ street: '', city: '' });
 *   };
 *
 *   const handleRemove = (index: number) => {
 *     control.removeAt(index);
 *   };
 *
 *   return (
 *     <div className="address-list">
 *       <div className="header">
 *         <h3>Addresses ({length})</h3>
 *         {dirty && <span className="badge">Modified</span>}
 *       </div>
 *
 *       {issues.length > 0 && (
 *         <div className="array-issues">
 *           {issues.map((issue) => <p key={issue.code}>{message(issue)}</p>)}
 *         </div>
 *       )}
 *
 *       {control.map((item, index) => (
 *         <AddressItem
 *           key={control.keyAt(index)}
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
 *         <p className="warning">Please fix issues before submitting</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Условный рендеринг с undefined
 * ```tsx
 * interface FormProps {
 *   optionalField?: FormArray<string>;
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
 * @see {@link FieldControlState} - тип состояния для FormControl
 * @see {@link ArrayControlState} - тип состояния для FormArray
 *
 * @group React Hooks
 */
export function useFormControl(
  control: FormControl<unknown> | FormArray<object> | undefined
): FieldControlState<unknown> | ArrayControlState<object> {
  // Rules of Hooks: каждая ветка вызывает ОДИНАКОВУЮ последовательность хуков
  // (useSignalSubscription), поэтому переключение control между undefined / полем / массивом
  // НЕ меняет число/порядок хуков (иначе React крашит «Rendered more hooks than previous render»).
  if (!control) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useEmptyControl();
  }

  if (isFormArray(control)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useArrayControl(control);
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useFieldControl(control);
}
