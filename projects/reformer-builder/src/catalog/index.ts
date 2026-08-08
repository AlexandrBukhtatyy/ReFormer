/**
 * Слой `catalog/` — каталог компонентов для палитры и инспектора. Строится по контракту (§5):
 * клиентский catalog-JSON (`@reformer/ui-kit/catalog`, генерируется под контракт билдера) →
 * `CatalogEntry[]`. Смена клиента подменяет источник за той же границей.
 *
 * @module reformer-builder/catalog
 */

import type { CatalogEntry } from './types';
import { buildCatalog } from './catalog';

export * from './types';
export * from './role';
export * from './widgets';
export { buildCatalog } from './catalog';
export { makeNodeFor } from './make-node';
export { syntheticRecords } from './synthetic-entries';
export { HTML_TAG_SPECS, htmlTagSpec, htmlPropsSchema } from './html-tags';
export type { HtmlTagSpec, HtmlContent } from './html-tags';
export { CATALOG_SCHEMA, loadCatalogJson, buildCatalogFromJson, validateCatalog } from './contract';
// compound.ts читает готовый каталог через getCatalog() (ниже) — только внутри функций, поэтому
// взаимная ссылка index ↔ compound на инициализацию модулей не влияет.
export { partsOf, partNamesOf, compoundParentOf, isCompoundPart, hasParts } from './compound';
// class-names.ts — та же взаимная ссылка index ↔ модуль, что и у compound: getCatalog() вызывается
// только внутри функций, на инициализацию модулей это не влияет.
export { classNamesFor, suggestClasses, resetClassNamesCache } from './class-names';
export {
  DEFAULT_CATEGORY_ORDER,
  FALLBACK_CATEGORY,
  categoryOrder,
  groupByCategory,
  displayName,
  htmlTag,
} from './grouping';
// Шаблоны композиций — чистые фабрики узлов (каталог не читают), поэтому живут рядом с makeNodeFor.
export { COMPOUND_TEMPLATES, hasCompoundTemplate } from './make-node';

let cache: CatalogEntry[] | null = null;

/** Каталог (мемо): строится один раз. */
export function getCatalog(): CatalogEntry[] {
  return (cache ??= buildCatalog());
}

/** Запись каталога по имени компонента. */
export function getCatalogEntry(name: string): CatalogEntry | undefined {
  return getCatalog().find((e) => e.name === name);
}
