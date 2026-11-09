/**
 * Адаптер поля — как свести value-based seam формы (`value` + `onChange(value)` + `onBlur`) к
 * контракту конкретного контрола. Чистые данные и чистые функции (без React): один механизм на
 * всех, кто связывает поле с контролом, — `FormField.Control` из `@reformer/cdk` и рендерер
 * `@reformer/renderer-react`.
 *
 * Контрол объявляет свой диалект статикой `reformerAdapter` (см. {@link getFieldAdapter}), поэтому
 * отдельные «field-версии» компонентов не нужны: в `component` поля кладётся сам компонент.
 *
 * @module platforms/react/field-binding
 */

/**
 * Адаптер поля: описывает диалект контрола (`checked`/`onCheckedChange`, `value`/`onValueChange`,
 * DOM-событие в `onChange`, …). Все ключи необязательны — по умолчанию seam проходит как есть.
 *
 * @example Radix Checkbox
 * ```ts
 * const checkedAdapter: FieldAdapter = {
 *   valueProp: 'checked',
 *   changeProp: 'onCheckedChange',
 *   fromEmit: (c) => c === true,
 *   toValue: (v) => v ?? false,
 * };
 * ```
 */
export interface FieldAdapter {
  /** Проп, из которого контрол читает значение (по умолчанию `'value'`). */
  valueProp?: string;
  /** Колбэк, через который контрол эмитит изменение (по умолчанию `'onChange'`). */
  changeProp?: string;
  /**
   * Эмит контрола → значение поля (по умолчанию — как есть). `rest` — прочие props контрола
   * (например, чтобы достать `options` при резолве значения).
   */
  fromEmit?: (arg: unknown, rest: Record<string, unknown>) => unknown;
  /** Значение поля → `valueProp` контрола (коэрсия `null`/`undefined`; по умолчанию — как есть). */
  toValue?: (value: unknown) => unknown;
  /** Проброс blur нестандартным каналом (по умолчанию — `onBlur`). */
  bindBlur?: (onBlur: () => void) => Record<string, unknown>;
  /** Ключи, которые убрать из `componentProps` перед спредом в контрол. */
  strip?: string[];
  /**
   * Передавать ли контролу ноду формы пропом `control` (только рендерер). По умолчанию `false`:
   * issues/touched обслуживает обёртка поля. Ставь `true`, если контрол сам вызывает
   * `useFormControl(control)`.
   */
  passControl?: boolean;
}

/** Компонент, объявивший свой диалект статикой. */
export interface FieldAdapterCarrier {
  reformerAdapter?: FieldAdapter;
}

/**
 * Props, которые адресованы обёртке поля, а не контролу: подпись (`label`), звёздочку
 * обязательности (`required`), описание под полем (`description`) и иконку у подписи
 * (`labelTooltip`) рисует `FormField`. Они приходят в общем мешке `componentProps`, и без среза
 * утекли бы в DOM контрола: `label="Имя"` атрибутом на `<input>`, а нативный `required` включил бы
 * проверку браузера, которая блокирует отправку формы раньше её собственной валидации.
 *
 * Исключение — контрол с inline-подписью ({@link hasInlineLabel}): `label` и `required` он рисует сам.
 */
export const FIELD_WRAPPER_ONLY_PROPS: readonly string[] = [
  'label',
  'description',
  'required',
  'labelTooltip',
];

/** Props обёртки, которые контрол с inline-подписью получает: подпись он рисует рядом с собой. */
const INLINE_LABEL_PROPS: ReadonlySet<string> = new Set(['label', 'required']);

/**
 * Рисует ли контрол подпись сам — рядом с собой (чекбокс, переключатель). Такой компонент
 * объявляет статику `reformerLayout = 'inline-label'`: обёртка поля тогда не рисует подпись
 * сверху, а `label` и `required` отдаёт контролу.
 *
 * @example
 * ```ts
 * CheckboxWithLabel.reformerLayout = 'inline-label';
 * hasInlineLabel(CheckboxWithLabel); // → true
 * ```
 */
export function hasInlineLabel(component: unknown): boolean {
  if (component == null || (typeof component !== 'function' && typeof component !== 'object')) {
    return false;
  }
  return (component as { reformerLayout?: unknown }).reformerLayout === 'inline-label';
}

/**
 * Адаптер, объявленный компонентом статикой `reformerAdapter`, либо `undefined`.
 *
 * @example
 * ```ts
 * Checkbox.reformerAdapter = checkedAdapter;
 * getFieldAdapter(Checkbox); // → checkedAdapter
 * ```
 */
export function getFieldAdapter(component: unknown): FieldAdapter | undefined {
  if (component == null || (typeof component !== 'function' && typeof component !== 'object')) {
    return undefined;
  }
  return (component as FieldAdapterCarrier).reformerAdapter;
}

/** Seam поля: текущее значение и value-based колбэки. */
export interface FieldSeam {
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

const identity = (x: unknown): unknown => x;

/**
 * Props контрола под адаптер: срезает служебные ключи обёртки и `strip` адаптера, кладёт значение
 * в `valueProp` (через `toValue`), вешает `changeProp`, который прогоняет эмит контрола через
 * `fromEmit` в value-based `onChange` поля, и пробрасывает blur (`bindBlur` либо `onBlur`).
 * Без адаптера seam проходит как есть (`value` / `onChange` / `onBlur`).
 *
 * `componentProps` спредятся ПЕРВЫМИ — seam их перекрывает при совпадении ключей.
 *
 * @param adapter - Адаптер контрола или `undefined` (value-based контрол).
 * @param seam - Значение поля и его колбэки.
 * @param componentProps - Прочие props контрола.
 * @param component - Сам контрол. Нужен, чтобы оставить `label` и `required` контролу с
 *   inline-подписью ({@link hasInlineLabel}); без него эти props срезаются у всех.
 * @returns Плоский объект props для спреда в контрол.
 */
export function bindFieldProps(
  adapter: FieldAdapter | undefined,
  seam: FieldSeam,
  componentProps: Record<string, unknown> = {},
  component?: unknown
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...componentProps };
  const inlineLabel = hasInlineLabel(component);
  for (const key of FIELD_WRAPPER_ONLY_PROPS) {
    if (!(inlineLabel && INLINE_LABEL_PROPS.has(key))) delete rest[key];
  }
  for (const key of adapter?.strip ?? []) delete rest[key];

  if (!adapter) {
    return { ...rest, value: seam.value, onChange: seam.onChange, onBlur: seam.onBlur };
  }

  const fromEmit = adapter.fromEmit ?? identity;
  return {
    ...rest,
    [adapter.valueProp ?? 'value']: (adapter.toValue ?? identity)(seam.value),
    [adapter.changeProp ?? 'onChange']: (arg: unknown) => seam.onChange(fromEmit(arg, rest)),
    ...(adapter.bindBlur ? adapter.bindBlur(seam.onBlur) : { onBlur: seam.onBlur }),
  };
}
