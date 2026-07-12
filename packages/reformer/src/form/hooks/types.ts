import type { ValidationError } from '../types/index';

/**
 * Состояние поля формы, возвращаемое хуком {@link useFormControl} для {@link FieldNode}.
 *
 * Содержит реактивные данные поля: значение, состояние валидации, флаги взаимодействия
 * и пользовательские props для компонентов.
 *
 * @typeParam T - Тип значения поля (string, number, boolean и т.д.)
 *
 * @example Базовое использование
 * ```tsx
 * interface Props {
 *   control: FieldNode<string>;
 * }
 *
 * function TextField({ control }: Props) {
 *   const state = useFormControl(control);
 *
 *   return (
 *     <div>
 *       <input
 *         value={state.value}
 *         disabled={state.disabled}
 *         onChange={e => control.setValue(e.target.value)}
 *       />
 *       {state.shouldShowError && state.errors[0] && (
 *         <span className="error">{state.errors[0].message}</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useFormControl} - хук для получения состояния
 * @see {@link ArrayControlState} - состояние для массивов
 *
 * @group Types
 */
export interface FieldControlState<T> {
  /**
   * Текущее значение поля.
   *
   * @example
   * ```tsx
   * const { value } = useFormControl(emailField);
   * console.log(value); // "user@example.com"
   * ```
   */
  value: T;

  /**
   * Флаг асинхронной валидации или загрузки.
   * `true` когда выполняется асинхронный валидатор.
   *
   * @example
   * ```tsx
   * const { pending } = useFormControl(usernameField);
   *
   * return (
   *   <div>
   *     <input {...props} />
   *     {pending && <Spinner size="small" />}
   *   </div>
   * );
   * ```
   */
  pending: boolean;

  /**
   * Флаг отключения поля.
   * `true` когда поле недоступно для редактирования.
   *
   * @example
   * ```tsx
   * const { disabled, value } = useFormControl(field);
   *
   * return (
   *   <input
   *     value={value}
   *     disabled={disabled}
   *     className={disabled ? 'opacity-50' : ''}
   *   />
   * );
   * ```
   */
  disabled: boolean;

  /**
   * Массив ошибок валидации.
   * Пустой массив означает отсутствие ошибок.
   *
   * @example
   * ```tsx
   * const { errors } = useFormControl(field);
   *
   * return (
   *   <ul className="error-list">
   *     {errors.map((error, i) => (
   *       <li key={i}>{error.message}</li>
   *     ))}
   *   </ul>
   * );
   * ```
   */
  errors: ValidationError[];

  /**
   * Флаг валидности поля.
   * `true` когда поле прошло все валидации (errors.length === 0).
   *
   * @example
   * ```tsx
   * const { valid } = useFormControl(field);
   *
   * return (
   *   <input className={valid ? 'border-green' : 'border-gray'} />
   * );
   * ```
   */
  valid: boolean;

  /**
   * Флаг невалидности поля.
   * `true` когда есть ошибки валидации (errors.length > 0).
   * Противоположность {@link valid}.
   *
   * @example
   * ```tsx
   * const { invalid } = useFormControl(field);
   *
   * return (
   *   <input
   *     aria-invalid={invalid}
   *     className={invalid ? 'border-red' : ''}
   *   />
   * );
   * ```
   */
  invalid: boolean;

  /**
   * Флаг взаимодействия с полем.
   * `true` после того как поле потеряло фокус (blur) хотя бы один раз.
   *
   * @example
   * ```tsx
   * const { touched, invalid } = useFormControl(field);
   *
   * // Показываем ошибку только после взаимодействия
   * const showError = touched && invalid;
   * ```
   */
  touched: boolean;

  /**
   * Флаг для отображения ошибки.
   * Комбинация touched && invalid - удобный shortcut для UI.
   *
   * @example
   * ```tsx
   * const { shouldShowError, errors } = useFormControl(field);
   *
   * return (
   *   <div>
   *     <input {...props} />
   *     {shouldShowError && (
   *       <span className="error">{errors[0]?.message}</span>
   *     )}
   *   </div>
   * );
   * ```
   */
  shouldShowError: boolean;

  /**
   * Пользовательские props для передачи в UI-компоненты.
   * Устанавливаются через {@link FieldNode.setComponentProps}.
   *
   * @example
   * ```tsx
   * // Установка props
   * field.setComponentProps({
   *   placeholder: 'Enter email...',
   *   maxLength: 100,
   *   autoComplete: 'email'
   * });
   *
   * // Использование в компоненте
   * const { componentProps, value } = useFormControl(field);
   *
   * return (
   *   <input
   *     value={value}
   *     placeholder={componentProps.placeholder}
   *     maxLength={componentProps.maxLength}
   *     autoComplete={componentProps.autoComplete}
   *   />
   * );
   * ```
   */
  componentProps: Record<string, unknown>;

  /**
   * Флаг изменения поля.
   * `true` когда значение поля отличается от начального.
   *
   * Реактивный аналог `control.dirty` — паритет с {@link ArrayControlState.dirty}.
   *
   * @example
   * ```tsx
   * const { dirty } = useFormControl(field);
   *
   * return dirty ? <span className="badge">Изменено</span> : null;
   * ```
   */
  dirty: boolean;
}

/**
 * Состояние массива формы, возвращаемое хуком {@link useFormControl} для {@link ArrayNode}.
 *
 * Содержит реактивные данные массива: значения элементов, длину, состояние валидации
 * и флаги взаимодействия.
 *
 * @typeParam T - Тип элемента массива (обычно объект с полями формы)
 *
 * @example Список с динамическим добавлением
 * ```tsx
 * interface Phone {
 *   type: string;
 *   number: string;
 * }
 *
 * interface Props {
 *   control: ArrayNode<Phone>;
 * }
 *
 * function PhoneList({ control }: Props) {
 *   const { length, valid } = useFormControl(control);
 *
 *   return (
 *     <div>
 *       {control.map((item, index) => (
 *         <PhoneItem
 *           key={item.id}
 *           control={item}
 *           onRemove={() => control.remove(index)}
 *         />
 *       ))}
 *
 *       {length === 0 && <p>No phones added</p>}
 *
 *       <button onClick={() => control.push({ type: 'mobile', number: '' })}>
 *         Add Phone
 *       </button>
 *
 *       {!valid && <p className="error">Please fix phone errors</p>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useFormControl} - хук для получения состояния
 * @see {@link FieldControlState} - состояние для полей
 *
 * @group Types
 */
export interface ArrayControlState<T> {
  /**
   * Массив текущих значений всех элементов.
   *
   * @example
   * ```tsx
   * const { value } = useFormControl(phonesArray);
   * console.log(value);
   * // [{ type: 'mobile', number: '+1234567890' }, { type: 'home', number: '+0987654321' }]
   * ```
   */
  value: T[];

  /**
   * Количество элементов в массиве.
   * Эквивалентно value.length, но оптимизировано для реактивности.
   *
   * @example
   * ```tsx
   * const { length } = useFormControl(itemsArray);
   *
   * return (
   *   <div>
   *     <span>Items: {length}</span>
   *     {length >= 10 && <span>Maximum reached</span>}
   *   </div>
   * );
   * ```
   */
  length: number;

  /**
   * Флаг асинхронной валидации.
   * `true` когда выполняется асинхронный валидатор массива или любого элемента.
   */
  pending: boolean;

  /**
   * Массив ошибок валидации уровня массива.
   * Не включает ошибки отдельных элементов.
   *
   * @example
   * ```tsx
   * // Валидатор массива
   * validators.apply(phonesArray, {
   *   validator: (phones) => phones.length >= 1,
   *   message: 'At least one phone required'
   * });
   *
   * // В компоненте
   * const { errors } = useFormControl(phonesArray);
   * // errors содержит ошибку "At least one phone required" если массив пуст
   * ```
   */
  errors: ValidationError[];

  /**
   * Флаг валидности массива и всех его элементов.
   * `true` только когда массив и все вложенные элементы валидны.
   */
  valid: boolean;

  /**
   * Флаг невалидности.
   * `true` когда есть ошибки в массиве или любом элементе.
   */
  invalid: boolean;

  /**
   * Флаг взаимодействия.
   * `true` после взаимодействия с любым элементом массива.
   */
  touched: boolean;

  /**
   * Флаг изменения.
   * `true` когда значение массива отличается от начального.
   *
   * @example
   * ```tsx
   * const { dirty } = useFormControl(itemsArray);
   *
   * return (
   *   <div>
   *     {dirty && <span>* Unsaved changes</span>}
   *     <button disabled={!dirty}>Save</button>
   *   </div>
   * );
   * ```
   */
  dirty: boolean;

  /**
   * Флаг отключения массива.
   * `true` когда массив отключён (`ArrayNode.disable()`), в том числе через
   * распространение disable от родительской группы.
   *
   * Используйте для отключения UI-действий добавления/удаления, когда массив
   * структурно неизменяем.
   *
   * @example
   * ```tsx
   * const { disabled } = useFormControl(itemsArray);
   *
   * return <button disabled={disabled} onClick={() => control.push()}>Add</button>;
   * ```
   */
  disabled: boolean;
}
