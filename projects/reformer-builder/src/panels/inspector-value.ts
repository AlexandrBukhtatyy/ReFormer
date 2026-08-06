/**
 * Нормализация значений, вводимых в инспекторе, перед записью в `componentProps`. Отдельный модуль
 * (не внутри `Inspector.tsx`) — файл с компонентами не должен экспортировать не-компоненты
 * (fast-refresh), а эти функции нужны и тестам.
 *
 * Общая политика: «не задано» — это ОТСУТСТВИЕ ключа (`undefined`), а не `''`. Пустая строка в
 * схеме — мусор, а для `enum` ещё и невалидное значение (пустой строки нет ни в одном `enum`
 * каталога, гейт валидации её отвергает).
 *
 * @module reformer-builder/panels/inspector-value
 */

/**
 * Строка из number-инпута → значение пропа. Всё, что не конечное число (пустая строка, промежуточные
 * `-`/`1e`, мусор), даёт `undefined` — ключ удаляется. РАНЬШЕ нечисловой ввод писался в схему
 * строкой (`maxFiles: "1e5"`), и валидация падала на «must be number».
 */
export function toNumberValue(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** Пустой выбор/ввод → `undefined` (ключ удаляется из `componentProps`). */
export function blankToUndefined(raw: string): string | undefined {
  return raw === '' ? undefined : raw;
}
