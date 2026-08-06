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
 * @module reformer-builder/catalog/compound
 */

import { getCatalog } from './index';
import type { CatalogEntry } from './types';

/** Части по корню: `Alert` → `[AlertTitle, AlertDescription]` (в порядке каталога). */
export function partsOf(parentName: string): CatalogEntry[] {
  return getCatalog().filter((e) => e.compoundParent === parentName);
}

/** Имена частей корня — для подсказок инспектора и тестов. */
export function partNamesOf(parentName: string): string[] {
  return partsOf(parentName).map((e) => e.name);
}

/** Корень compound'а по имени части: `AlertTitle` → `Alert`; для не-частей — `undefined`. */
export function compoundParentOf(name: string): string | undefined {
  return getCatalog().find((e) => e.name === name)?.compoundParent;
}

/** Запись каталога — часть compound'а (в общий список палитры такие не идут). */
export function isCompoundPart(entry: Pick<CatalogEntry, 'compoundParent'>): boolean {
  return entry.compoundParent !== undefined;
}

/** Есть ли у компонента части (он же — корень compound'а). */
export function hasParts(name: string): boolean {
  return getCatalog().some((e) => e.compoundParent === name);
}
