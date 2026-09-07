/**
 * Сборка каталога `CatalogEntry[]` через контракт: поставленный catalog-JSON + синтетические
 * ({@link composeCatalogJson}) → дескриптор кита ({@link toDescriptor}) → записи с `makeNode`
 * ({@link buildCatalogFromJson}). Так источник (клиент ui-kit vs иной) абстрагирован за одной
 * границей (спека §5).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1. Там `buildCatalog()` не только собирал записи, но и ОБЪЯВЛЯЛ активный
 * кит: клал выведенный дескриптор в `kits/active`, откуда его читали модули, которым нельзя было
 * зависеть от `catalog/` (`model/node-kind`, `preview-runtime/render-policy`) — прямая связь дала
 * бы цикл `node-kind → catalog → make-node → node-kind`. Побочный эффект и был причиной, по
 * которой домен трогал состояние.
 *
 * В v2 цикла нет: `lib/form-model/node-kind` и `lib/catalog/make-node` берут множество листьев
 * ПАРАМЕТРОМ (дефолт — `lib/kits/legacy-reformer-ui-kit`), а не через посредника-состояние.
 * Поэтому сборка — чистая функция: дескриптор она ВОЗВРАЩАЕТ вместе с записями, а «какой кит
 * активен сейчас» держит сервис плагина (`plugins/kits/`), который эту функцию и зовёт.
 *
 * @module lib/catalog/catalog
 */

import type { KitDescriptor } from '../kits/types';
import type { CatalogEntry, CatalogJson } from './types';
import { buildCatalogFromJson, composeCatalogJson, type ComponentsFilter } from './contract';
import { toDescriptor } from '../kits/descriptor';

/** Настройки сборки — то, чем клиент может подвинуть состав и раскладку палитры. */
export interface BuildCatalogOptions {
  /** Ограничение набора компонентов и тоглы синтетики. */
  components?: ComponentsFilter;
  /** Переопределения категории палитры по имени компонента (ложатся поверх карты кита). */
  categoryByName?: Record<string, string>;
}

/** Результат сборки: и записи палитры, и дескриптор кита, выведенный из того же каталога. */
export interface BuiltCatalog {
  /** Записи каталога с восстановленным `makeNode`. */
  entries: CatalogEntry[];
  /** Дескриптор активного кита (нужен `class-names`, превью и кодогену). */
  descriptor: KitDescriptor;
  /** Сам каталог-JSON после склейки с синтетикой — источник правды для валидации и диагностики. */
  json: CatalogJson;
}

/**
 * Собрать каталог из поставленного клиентом catalog-JSON (+ синтетические билдера).
 *
 * @param supplied - Каталог источника: клиентский (`--catalog`) либо каталог выбранного кита.
 *   КТО его выбрал — забота вызывающего, домен состояния выбора не видит.
 * @param options - Ограничения набора и переопределения категорий из конфига клиента.
 */
export function buildCatalog(supplied: CatalogJson, options?: BuildCatalogOptions): BuiltCatalog {
  const json = composeCatalogJson(supplied, options?.components);
  const descriptor = toDescriptor(json);
  return {
    entries: buildCatalogFromJson(json, descriptor, options?.categoryByName),
    descriptor,
    json,
  };
}
