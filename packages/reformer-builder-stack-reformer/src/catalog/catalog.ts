/**
 * Сборка каталога `CatalogEntry[]` через контракт: поставленный catalog-JSON + синтетические
 * ({@link composeCatalogJson}) → дескриптор кита (`toDescriptor` SDK) → записи с `makeNode`
 * ({@link buildCatalogFromJson}). Так источник (клиент ui-kit vs иной) абстрагирован за одной
 * границей (спека §5).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1. Там `buildCatalog()` не только собирал записи, но и ОБЪЯВЛЯЛ активный
 * кит: клал выведенный дескриптор в `kits/active`, откуда его читали модули, которым нельзя было
 * зависеть от `catalog/` (`model/node-kind`, `preview-runtime/render-policy`) — прямая связь дала
 * бы цикл `node-kind → catalog → make-node → node-kind`. Побочный эффект и был причиной, по
 * которой домен трогал состояние.
 *
 * В v2 цикла нет: `form-model/node-kind` и `catalog/make-node` берут множество листьев
 * ПАРАМЕТРОМ (запасное — `kits/defaults`), а не через посредника-состояние. Поэтому сборка —
 * чистая функция: дескриптор она ВОЗВРАЩАЕТ вместе с записями, а «какой кит активен сейчас»
 * держит служба китов (возможность `reformer.kit.catalog` SDK).
 *
 * ## Проекция для читателей службы
 *
 * Служба китов нейтральна: она отдаёт СЫРОЙ каталог кита, а записи палитры с `makeNode`
 * и синтетикой — забота ReFormer. Плагины стека получают их {@link projectCatalog}: та же
 * сборка, но запомненная по каталогу, потому что её зовут из отрисовки на каждый кадр,
 * а `useSyncExternalStore` требует одну и ту же ссылку, пока кит не сменился.
 *
 * @module @reformer/builder-stack-reformer/catalog/catalog
 */

import { toDescriptor, type KitDescriptor } from '@reformer/builder-plugin-api';
import type { CatalogEntry, CatalogJson } from './types';
import { buildCatalogFromJson, composeCatalogJson, type ComponentsFilter } from './contract';

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

/** Записи пустого каталога. Одна замороженная ссылка на всех: снимок обязан быть стабилен. */
const NO_ENTRIES: CatalogEntry[] = [];
Object.freeze(NO_ENTRIES);

/** Проекции по каталогу. Слабые ключи: каталог, который служба отпустила, уходит вместе с ними. */
const projections = new WeakMap<CatalogJson, BuiltCatalog>();

/**
 * Каталог кита глазами ReFormer — {@link buildCatalog}, запомненный по идентичности каталога.
 *
 * Один и тот же каталог даёт одну и ту же проекцию (те же ссылки на записи и дескриптор), новый —
 * новую. Служба китов меняет каталог-объект ровно тогда, когда сменился кит или доехал его
 * каталог, — поэтому снимки читателей стабильны между сменами без собственного кэша.
 *
 * **Каталог без записей — пустая проекция**, а не «синтетика билдера без записей кита»: пока
 * каталог ленивого кита в пути, служба отдаёт его шапку без записей, и каталог из одних
 * `$html`/`FormArray` был бы непуст для валидатора — тот пометил бы неизвестным каждый компонент
 * открытой формы. Пустой отключает проверку имён целиком, пока сравнивать не с чем.
 */
export function projectCatalog(supplied: CatalogJson): BuiltCatalog {
  const known = projections.get(supplied);
  if (known !== undefined) return known;
  const projection: BuiltCatalog =
    supplied.components.length === 0
      ? { entries: NO_ENTRIES, descriptor: toDescriptor(supplied), json: supplied }
      : buildCatalog(supplied);
  projections.set(supplied, projection);
  return projection;
}
