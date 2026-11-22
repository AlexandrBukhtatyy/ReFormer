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

/** Нода, которую можно вернуть к значению. */
interface Resettable<T> {
  reset(value?: T): void;
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

/**
 * Сбросить ноду к пустому значению, когда булев флаг СНИМАЮТ: на переходе `true → false`, а не
 * «пока флаг снят».
 *
 * Под флагом значение копируется из другого поля (`copyFrom`), и снятый флаг уносит копию:
 * человек вводит своё с чистого поля. Сброс по условию не годится — при снятом флаге поле правят
 * руками, и он стирал бы ввод. Начальное значение флага переходом не считается: открытая заявка
 * сохранённых данных не теряет.
 *
 * @example
 * resetOnUnset(model.$.sameEmail, form.emailAdditional, () => '');
 */
export function resetOnUnset<T>(
  flag: ReadonlySignal<boolean>,
  target: Resettable<T>,
  empty: () => T
): void {
  let previous = flag.value;
  onChange(flag, (on) => {
    if (previous && !on) target.reset(empty());
    previous = on;
  });
}

/** Очистить массив-ноду при снятии булева флага. */
export function clearWhenOff(flag: ReadonlySignal<boolean>, array: Clearable): void {
  onChange(flag, (enabled) => {
    if (!enabled) array.clear();
  });
}
