/**
 * Привязка поля к контролу в React. Диалект контрола (`reformerAdapter`), срез служебных props и
 * управляемая привязка — общие для всех слоёв представления и лежат в `render/field-adapter`; этот
 * модуль добавляет к ним неуправляемую привязку: значение пишется прямо в DOM-элемент через `ref`.
 *
 * Один механизм на всех, кто связывает поле с контролом в React, — `FormField.Control` из
 * `@reformer/cdk` и рендерер `@reformer/renderer-react`.
 *
 * @module platforms/react/field-binding
 */

import {
  bindControlledSeam,
  controlPropsOf,
  type FieldAdapter,
  type FieldSeam,
} from '../../../render/field-adapter';
import { NOT_RENDERED, uncontrolledRef } from './uncontrolled';

export {
  FIELD_WRAPPER_ONLY_PROPS,
  getFieldAdapter,
  hasInlineLabel,
} from '../../../render/field-adapter';
export type { FieldAdapter, FieldAdapterCarrier, FieldSeam } from '../../../render/field-adapter';

const identity = (x: unknown): unknown => x;

/** Проп начального значения нативного элемента по `valueProp` адаптера. */
const DEFAULT_PROPS: Readonly<Record<string, string>> = {
  value: 'defaultValue',
  checked: 'defaultChecked',
};

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
  const rest = controlPropsOf(adapter, componentProps, component);

  if (adapter?.uncontrolled === true && seam.control !== undefined) {
    // Значение — в DOM через ref; начальное — пропом `default*`, без подписки на значение.
    const fromEmit = adapter.fromEmit ?? identity;
    const defaultProp = DEFAULT_PROPS[adapter.valueProp ?? 'value'];
    const initial = seam.control.value.peek();
    return {
      ...rest,
      ...(defaultProp !== undefined
        ? { [defaultProp]: (adapter.toValue ?? identity)(initial) }
        : {}),
      [adapter.changeProp ?? 'onChange']: (arg: unknown) => seam.onChange(fromEmit(arg, rest)),
      ...(adapter.bindBlur ? adapter.bindBlur(seam.onBlur) : { onBlur: seam.onBlur }),
      ref: uncontrolledRef(
        seam.control,
        adapter,
        rest,
        defaultProp !== undefined ? initial : NOT_RENDERED,
        seam.watch
      ),
    };
  }
  return bindControlledSeam(adapter, seam, rest);
}
