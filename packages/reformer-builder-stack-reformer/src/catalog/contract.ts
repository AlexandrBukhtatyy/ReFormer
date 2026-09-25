/**
 * Каталог кита глазами стека ReFormer. Сам контракт (`component-catalog.schema.json`, типы,
 * дескриптор, проверка) — в SDK `@reformer/builder-plugin-api`: кит общий для всех стеков. Здесь —
 * то, что из каталога следует для ReFormer: склейка с синтетикой билдера
 * ({@link composeCatalogJson}) и реконструкция `CatalogEntry[]` с `makeNode`
 * ({@link buildCatalogFromJson}).
 *
 * Категория палитры назначается на загрузке по карте кита (`descriptor.palette.categoryByName` —
 * её объявляет сам кит), поверх которой может лечь клиентский конфиг. Синтетические
 * `$html`/array-записи добавляет билдер (`synthetic-entries`).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1. Там функция называлась `loadCatalogJson()` и САМА добывала источник:
 * читала `config/state.getClientCatalog()`, а иначе брала каталог выбранного кита
 * (`kits/registry` + `kits/selection` + `localStorage`). Это состояние приложения, и домену его
 * знать нельзя — источник и конфиг теперь ПАРАМЕТРЫ, а выбор источника остаётся вызывающему
 * (плагин `plugins/kits/registry/`). Отсюда и другое имя: «compose», а не «load» — функция ничего не
 * загружает, она склеивает поставленное с синтетикой билдера.
 *
 * @module @reformer/builder-stack-reformer/catalog/contract
 */

import type { PropsSchema } from '@reformer/ui-kit/meta';
import { toDescriptor, type KitDescriptor } from '@reformer/builder-plugin-api';
import type { CatalogEntry, CatalogJson, CatalogRecord, CatalogRole } from './types';
import { syntheticRecords, type SyntheticOptions } from './synthetic-entries';
import { makeNodeFor } from './make-node';

/**
 * Ограничение набора компонентов — СОБСТВЕННЫЙ входной контракт каталога (в v1 это был
 * `ComponentsConfig` из `config/types`, см. заметку об источнике в шапке модуля). Секция
 * `components` клиентского конфига структурно совпадает и подставляется без адаптера.
 */
export interface ComponentsFilter {
  /** Whitelist по имени: если задан — в каталоге остаются только эти компоненты. */
  include?: string[];
  /** Blacklist по имени: перечисленные компоненты убираются из каталога. */
  exclude?: string[];
  /** Тоглы синтетических записей билдера. */
  synthetic?: SyntheticOptions;
}

function categoryOf(
  name: string,
  role: CatalogRole,
  categoryByName: Record<string, string>,
  overrides: Record<string, string> | undefined
): string {
  // Клиентский конфиг может доопределить/переопределить категорию по имени (сливается поверх дефолта).
  const override = overrides?.[name];
  if (override) return override;
  // Typography разбит на отдельные компоненты (TypographyH1…Muted) — собственный раздел «Типографика».
  if (name.startsWith('Typography')) return 'Типографика';
  return categoryByName[name] ?? (role === 'container' ? 'Контейнеры' : 'Прочее');
}

/** Отфильтровать записи по whitelist/blacklist имён из клиентского конфига (по имени компонента). */
function filterComponents(
  records: CatalogRecord[],
  cfg: ComponentsFilter | undefined
): CatalogRecord[] {
  let out = records;
  if (cfg?.include && cfg.include.length) {
    const inc = new Set(cfg.include);
    out = out.filter((r) => inc.has(r.name));
  }
  if (cfg?.exclude && cfg.exclude.length) {
    const exc = new Set(cfg.exclude);
    out = out.filter((r) => !exc.has(r.name));
  }
  return out;
}

/**
 * Каталог-JSON: источник компонентов + синтетические записи билдера (`$html`/array/wizard).
 * Конфиг клиента может сузить synthetic-набор и отфильтровать компоненты (include/exclude).
 * Единственная граница источника — смена клиента не трогает остальной код.
 *
 * @param supplied - Каталог, поставленный источником: клиентский (`--catalog` при локальном
 *   старте) либо каталог выбранного кита. КТО его выбрал — забота вызывающего (см. шапку модуля).
 * @param componentsCfg - Ограничения набора из конфига клиента.
 */
export function composeCatalogJson(
  supplied: CatalogJson,
  componentsCfg?: ComponentsFilter
): CatalogJson {
  const synthetic = syntheticRecords(componentsCfg?.synthetic);
  // Синтетическая запись выигрывает у одноимённой клиентской: `FormArray` у билдера — это
  // array-узел (role `array`, свои props повторяющегося блока), а у кита так называется обычный
  // React-компонент. Пока кит не поставлял его в каталоге, столкновения не было; теперь, когда он
  // описывает все свои экспорты, дубль имени надо снимать здесь — иначе array-узел подменяется
  // контейнером и ломается тип узла, а не только палитра.
  const syntheticNames = new Set(synthetic.map((r) => r.name));
  // `palette: false` — кит прислал запись ради полноты метаданных (props для документации, MCP и
  // инспектора), но размещаемым узлом она не является: порталы, оверлеи, провайдеры, части
  // form-control'ов. Отсеиваем на границе источника, чтобы дальше по коду каталог означал ровно
  // «то, что можно поставить в форму» — как и было до того, как кит начал описывать все экспорты.
  const placeable = supplied.components.filter(
    (r) => r.palette !== false && !syntheticNames.has(r.name)
  );
  const all = [...placeable, ...synthetic];
  return {
    version: supplied.version,
    components: filterComponents(all, componentsCfg),
    // Блок `kit` кита пробрасываем дальше: из него `toDescriptor` соберёт дескриптор.
    ...(supplied.kit ? { kit: supplied.kit } : {}),
  };
}

/**
 * Реконструировать `CatalogEntry[]` из каталога-JSON (категория палитры + восстановление `makeNode`).
 *
 * Дескриптор кита по умолчанию выводится из самого каталога — так карта категорий приходит от кита,
 * а не из захардкоженной таблицы билдера.
 *
 * @param json - Каталог-JSON (обычно результат {@link composeCatalogJson}).
 * @param descriptor - Дескриптор кита; по умолчанию выводится из самого каталога.
 * @param categoryOverrides - Переопределения категории от клиента (в v1 читались из
 *   `config/state.getRuntimeConfig().palette.categoryByName`).
 */
export function buildCatalogFromJson(
  json: CatalogJson,
  descriptor: KitDescriptor = toDescriptor(json),
  categoryOverrides?: Record<string, string>
): CatalogEntry[] {
  const categoryByName = descriptor.palette.categoryByName;
  // Листья активного кита узел-по-умолчанию берёт из дескриптора, а не из состояния. Композиции
  // compound'ов кит пока не поставляет — действуют встроенные шаблоны билдера.
  const kit = { leafComponents: descriptor.leafComponents };
  return json.components.map((r) => ({
    name: r.name,
    role: r.role,
    // Часть compound'а живёт в категории своего корня (`AlertTitle` — там же, где `Alert`): в общий
    // список палитры она не попадает, но при контекстном показе категория должна совпадать с корнем.
    category:
      r.category ??
      categoryOf(r.compoundParent ?? r.name, r.role, categoryByName, categoryOverrides),
    // Граница «данные снаружи»: контракт SDK описывает схему пропсов открыто (форму задаёт кит),
    // а инспектор ReFormer читает её словарём `@reformer/ui-kit/meta` — сужение здесь, в одном месте.
    propsSchema: r.propsSchema as PropsSchema,
    ...(r.variantGroup ? { variantGroup: r.variantGroup } : {}),
    ...(r.variant ? { variant: r.variant } : {}),
    ...(r.compoundParent ? { compoundParent: r.compoundParent } : {}),
    // Поля контракта 2.0 прокидываются только когда кит их реально прислал: для каталога 1.0
    // форма записи остаётся байт-в-байт прежней (закреплено снапшот-тестом эквивалентности).
    ...(r.exportName ? { exportName: r.exportName } : {}),
    ...(r.subpath ? { subpath: r.subpath } : {}),
    makeNode: () => makeNodeFor(r.name, r.role, r.compoundParent, kit),
  }));
}
