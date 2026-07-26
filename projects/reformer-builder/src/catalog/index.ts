/**
 * Слой `catalog/` — каталог компонентов для палитры и инспектора. Строится по контракту (§5):
 * `defaultPropSchemas` → каталог-JSON → `CatalogEntry[]`. Внешний валидированный catalog-JSON
 * подменяет источник за той же границей.
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
export {
  CATALOG_SCHEMA,
  buildCatalogJson,
  buildCatalogFromJson,
  validateCatalog,
} from './contract';

let cache: CatalogEntry[] | null = null;

/** Каталог (мемо): строится один раз. */
export function getCatalog(): CatalogEntry[] {
  return (cache ??= buildCatalog());
}

/** Запись каталога по имени компонента. */
export function getCatalogEntry(name: string): CatalogEntry | undefined {
  return getCatalog().find((e) => e.name === name);
}
