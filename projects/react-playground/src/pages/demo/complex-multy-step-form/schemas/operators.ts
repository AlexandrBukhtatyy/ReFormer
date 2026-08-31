/**
 * Пользовательские операторы поведения для кредитной формы.
 *
 * Демонстрируют открытость контракта `@reformer/core/behaviors`: оператор — обычная функция,
 * которая комбинирует встроенные операторы (они сами регистрируются в активной схеме). На месте
 * вызова такой оператор неотличим от встроенного.
 */

import { onChange, type ReadonlySignal } from '@reformer/core/behaviors';

/** Нода-поле с динамическими опциями (Select и т.п.). */
interface OptionsTarget {
  reset(): void;
  updateComponentProps(props: Record<string, unknown>): void;
}

/** Нода-массив, которую можно очистить. */
interface Clearable {
  clear(): void;
}

/**
 * Подгружать опции поля при изменении источника (с debounce и опциональным сбросом цели).
 *
 * @example
 * loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });
 */
export function loadOptionsOn<TValue, TOption>(
  source: ReadonlySignal<TValue>,
  target: OptionsTarget,
  fetcher: (value: TValue) => Promise<{ data: TOption[] }>,
  options: { debounce?: number; resetTarget?: boolean } = {}
): void {
  const { debounce = 300, resetTarget = false } = options;
  onChange(
    source,
    async (value) => {
      if (resetTarget) target.reset();
      if (!value) {
        target.updateComponentProps({ options: [] });
        return;
      }
      try {
        const { data } = await fetcher(value);
        target.updateComponentProps({ options: data });
      } catch {
        target.updateComponentProps({ options: [] });
      }
    },
    { debounce }
  );
}

/** Очистить массив-ноду при снятии булева флага. */
export function clearWhenOff(flag: ReadonlySignal<boolean>, array: Clearable): void {
  onChange(flag, (on) => {
    if (!on) array.clear();
  });
}
