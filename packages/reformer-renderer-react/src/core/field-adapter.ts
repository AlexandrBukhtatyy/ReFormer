/**
 * Применение {@link FieldAdapter} к seam поля — чистая функция (без React), чтобы логику перевода
 * value-based seam в диалект конкретного контрола можно было юнит-тестить без DOM.
 *
 * @module reformer/renderer-react/field-adapter
 */

import type { FieldAdapter } from './types';

const identity = (x: unknown): unknown => x;

/**
 * Строит props контрола под адаптер: убирает `strip`-ключи, кладёт значение в `valueProp`
 * (через `toValue`), вешает `changeProp`, который эмит контрола прогоняет через `fromEmit` и отдаёт
 * value-based `onChange` поля, и пробрасывает blur (`bindBlur` либо `onBlur`).
 *
 * `componentProps` (после `strip`) спредятся ПЕРВЫМИ, поэтому seam (value/change/blur) их перекрывает
 * при совпадении ключей. `control` намеренно НЕ добавляется: сырой контрол его не потребляет.
 *
 * @param adapter - Адаптер контрола (valueProp/changeProp/fromEmit/toValue/bindBlur/strip).
 * @param value - Текущее значение поля.
 * @param onChange - value-based колбэк поля (`(v) => field.setValue(v)`).
 * @param onBlur - blur-колбэк поля (`() => field.markAsTouched()`).
 * @param componentProps - `componentProps` узла (без служебных ключей рендерера).
 * @returns Плоский объект props для спреда в контрол.
 */
export function buildAdaptedFieldProps(
  adapter: FieldAdapter,
  value: unknown,
  onChange: (v: unknown) => void,
  onBlur: () => void,
  componentProps: Record<string, unknown>
): Record<string, unknown> {
  const propsForSpread: Record<string, unknown> = adapter.strip?.length
    ? Object.fromEntries(
        Object.entries(componentProps).filter(([k]) => !adapter.strip!.includes(k))
      )
    : componentProps;

  return {
    ...propsForSpread,
    [adapter.valueProp ?? 'value']: (adapter.toValue ?? identity)(value),
    [adapter.changeProp ?? 'onChange']: (arg: unknown) =>
      onChange((adapter.fromEmit ?? identity)(arg, propsForSpread)),
    ...(adapter.bindBlur ? adapter.bindBlur(onBlur) : { onBlur }),
  };
}
