/**
 * Пользовательские операторы поведения кредитной формы: обычные функции поверх встроенных
 * операторов `@reformer/core/behaviors`.
 */

import { onChange, type ReadonlySignal } from '@reformer/core/behaviors';

/** Нода-поле с динамическими опциями (Select и подобные). */
interface OptionsTarget {
  reset(): void;
  updateComponentProps(props: Record<string, unknown>): void;
}

/** Нода-массив, которую можно очистить. */
interface Clearable {
  clear(): void;
}

/**
 * Подгружать опции поля при изменении источника. Ответ на устаревшее значение источника
 * отбрасывается: `signal` отменяется, когда источник меняется снова.
 *
 * @example
 * loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });
 */
export function loadOptionsOn<TValue, TOption>(
  source: ReadonlySignal<TValue>,
  target: OptionsTarget,
  fetcher: (value: TValue, signal: AbortSignal) => Promise<{ data: TOption[] }>,
  options: { debounce?: number; resetTarget?: boolean } = {}
): void {
  const { debounce = 300, resetTarget = false } = options;
  onChange(
    source,
    async (value, { signal }) => {
      if (resetTarget) target.reset();
      if (!value) {
        target.updateComponentProps({ options: [] });
        return;
      }
      try {
        const { data } = await fetcher(value, signal);
        if (!signal.aborted) target.updateComponentProps({ options: data });
      } catch {
        if (!signal.aborted) target.updateComponentProps({ options: [] });
      }
    },
    { debounce }
  );
}

/** Очистить массив-ноду при снятии булева флага. */
export function clearWhenOff(flag: ReadonlySignal<boolean>, array: Clearable): void {
  onChange(flag, (enabled) => {
    if (!enabled) array.clear();
  });
}
