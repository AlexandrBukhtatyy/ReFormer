/**
 * Compound-компоненты: корень (`Alert`) и его части (`AlertTitle`, `AlertDescription`). Части
 * приходят из каталога с полем `compoundParent` (генерирует `@reformer/ui-kit`), здесь — производные
 * запросы для палитры, инспектора и превью.
 *
 * Зачем: корень compound'а собирается ТОЛЬКО из своих частей. У `Alert` корень — grid
 * `grid-cols-[0_1fr]`, поэтому голый `text` становится анонимным grid item в колонке нулевой ширины
 * и рассыпается по одному слову в строке. Правильное содержимое — `AlertTitle`/`AlertDescription`
 * (у них `col-start-2`).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1. Там каждая функция звала мемоизированный синглтон `getCatalog()` —
 * то есть читала «каталог, собранный для текущего кита». В v2 собранный каталог передаётся
 * ПАРАМЕТРОМ: держать его — работа сервиса плагина, домен только считает по нему производные.
 *
 * @module lib/catalog/compound
 */

import type { CatalogEntry } from './types';

/** Части по корню: `Alert` → `[AlertTitle, AlertDescription]` (в порядке каталога). */
export function partsOf(catalog: readonly CatalogEntry[], parentName: string): CatalogEntry[] {
  return catalog.filter((e) => e.compoundParent === parentName);
}

/** Имена частей корня — для подсказок инспектора и тестов. */
export function partNamesOf(catalog: readonly CatalogEntry[], parentName: string): string[] {
  return partsOf(catalog, parentName).map((e) => e.name);
}

/** Корень compound'а по имени части: `AlertTitle` → `Alert`; для не-частей — `undefined`. */
export function compoundParentOf(
  catalog: readonly CatalogEntry[],
  name: string
): string | undefined {
  return catalog.find((e) => e.name === name)?.compoundParent;
}

/** Запись каталога — часть compound'а (в общий список палитры такие не идут). */
export function isCompoundPart(entry: Pick<CatalogEntry, 'compoundParent'>): boolean {
  return entry.compoundParent !== undefined;
}

/** Есть ли у компонента части (он же — корень compound'а). */
export function hasParts(catalog: readonly CatalogEntry[], name: string): boolean {
  return catalog.some((e) => e.compoundParent === name);
}
