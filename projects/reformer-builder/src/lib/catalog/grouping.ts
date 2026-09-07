/**
 * Группировка каталога по категориям палитры: порядок разделов (из конфига клиента, иначе дефолт)
 * и отображаемая подпись записи. Общая для палитры (§8) и модалки быстрого добавления — разделы в
 * обоих местах идут одинаково.
 *
 * Порядок разделов приходит ПАРАМЕТРОМ (в v1 читался из `config/state.getRuntimeConfig()`):
 * конфиг клиента — состояние приложения, домену оно не видно.
 *
 * @module lib/catalog/grouping
 */

import type { CatalogEntry } from './types';

/** Порядок разделов по умолчанию (дизайн-макет палитры). */
export const DEFAULT_CATEGORY_ORDER = [
  'HTML', // всегда первый (в палитре свёрнут по умолчанию — см. DEFAULT_COLLAPSED)
  'Типографика', // всегда второй (тоже свёрнут по умолчанию)
  'Поля ввода',
  'Выбор и переключатели',
  'Контейнеры',
  'Действия',
  'Отображение',
  'Массив',
  // Синтетические `Wizard` + `Step` (см. `synthetic-entries`). Без строки здесь раздел считался
  // незнакомым и уезжал в хвост — ниже «Прочее», хотя это структура формы, соседняя с «Массивом».
  'Мастер',
  'Оверлеи',
  'Навигация',
  'Чат',
  'Прочее',
];

/** Раздел для записей без `category`. */
export const FALLBACK_CATEGORY = 'Прочее';

/** Порядок разделов палитры: из конфига клиента, иначе дефолтный. */
export function categoryOrder(order?: readonly string[]): string[] {
  return order && order.length ? [...order] : DEFAULT_CATEGORY_ORDER;
}

/** Тег из синтетического HTML-имени: `$html(div)` → `div`; для остальных — `null`. */
export function htmlTag(name: string): string | null {
  return name.startsWith('$html(') && name.endsWith(')') ? name.slice('$html('.length, -1) : null;
}

/** Отображаемая подпись: у HTML-элементов — просто имя тега (без обёртки `$html(...)`). */
export function displayName(entry: CatalogEntry): string {
  return htmlTag(entry.name) ?? entry.name;
}

/**
 * Разложить записи по категориям в порядке {@link categoryOrder}; незнакомые категории — в хвост,
 * в порядке первого появления. Порядок записей внутри раздела сохраняется.
 *
 * @param entries - Записи каталога.
 * @param order - Порядок разделов из конфига клиента; без него — {@link DEFAULT_CATEGORY_ORDER}.
 */
export function groupByCategory(
  entries: readonly CatalogEntry[],
  order?: readonly string[]
): Array<[string, CatalogEntry[]]> {
  const map = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    const c = e.category ?? FALLBACK_CATEGORY;
    const list = map.get(c) ?? [];
    list.push(e);
    map.set(c, list);
  }
  const sections = categoryOrder(order);
  const known = sections
    .filter((c) => map.has(c))
    .map((c) => [c, map.get(c)!] as [string, CatalogEntry[]]);
  const rest = [...map.keys()]
    .filter((c) => !sections.includes(c))
    .map((c) => [c, map.get(c)!] as [string, CatalogEntry[]]);
  return [...known, ...rest];
}
