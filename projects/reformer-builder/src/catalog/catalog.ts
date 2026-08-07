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
import { toDescriptor } from '../kits/descriptor';
import { setActiveDescriptor } from '../kits/active';

/**
 * Собрать каталог из поставляемого клиентом catalog-JSON (+ синтетические билдера).
 *
 * Здесь же определяется активный кит: дескриптор выводится из того же каталога и кладётся в
 * `kits/active`, откуда его читают модули, которым нельзя зависеть от `catalog/` (`model/node-kind`,
 * `preview-runtime/render-policy`) — прямая связь дала бы цикл
 * `node-kind → catalog → make-node → node-kind`.
 */
export function buildCatalog(): CatalogEntry[] {
  const json = loadCatalogJson();
  const descriptor = toDescriptor(json);
  setActiveDescriptor(descriptor);
  return buildCatalogFromJson(json, descriptor);
}
