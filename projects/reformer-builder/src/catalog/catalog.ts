/**
 * Сборка каталога `CatalogEntry[]` через контракт: `defaultPropSchemas` → каталог-JSON
 * ({@link buildCatalogJson}) → записи с `makeNode` ({@link buildCatalogFromJson}). Так источник
 * (прямой импорт vs внешний catalog-JSON) абстрагирован за одной границей (спека §5).
 *
 * @module reformer-builder/catalog/catalog
 */

import type { CatalogEntry } from './types';
import { buildCatalogFromJson, buildCatalogJson } from './contract';

/** Собрать каталог из дефолтного источника (`defaultPropSchemas` + синтетические). */
export function buildCatalog(): CatalogEntry[] {
  return buildCatalogFromJson(buildCatalogJson());
}
