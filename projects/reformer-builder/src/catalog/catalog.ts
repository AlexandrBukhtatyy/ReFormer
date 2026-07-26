/**
 * Сборка каталога `CatalogEntry[]` через контракт: клиентский catalog-JSON
 * (`@reformer/ui-kit/catalog`) + синтетические ({@link loadCatalogJson}) → записи с `makeNode`
 * ({@link buildCatalogFromJson}). Так источник (клиент ui-kit vs иной) абстрагирован за одной
 * границей (спека §5).
 *
 * @module reformer-builder/catalog/catalog
 */

import type { CatalogEntry } from './types';
import { buildCatalogFromJson, loadCatalogJson } from './contract';

/** Собрать каталог из поставляемого клиентом catalog-JSON (+ синтетические билдера). */
export function buildCatalog(): CatalogEntry[] {
  return buildCatalogFromJson(loadCatalogJson());
}
