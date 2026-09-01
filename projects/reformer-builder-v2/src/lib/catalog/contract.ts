/**
 * Контракт каталога компонентов (спека §5, §15). Билдер ВЛАДЕЕТ JSON Schema контрактом
 * (`component-catalog.schema.json`); клиент (`@reformer/ui-kit`) генерирует под него валидный
 * catalog-JSON (`@reformer/ui-kit/catalog`, команда `generate:catalog`). Здесь: сборка каталога из
 * поставленного источника ({@link composeCatalogJson}), валидатор против контракта
 * ({@link validateCatalog}) и реконструкция `CatalogEntry[]` с `makeNode`
 * ({@link buildCatalogFromJson}).
 *
 * Категория палитры назначается на загрузке по карте активного кита
 * (`descriptor.palette.categoryByName`; для «неявного кита» это дефолтная карта билдера), поверх
 * которой может лечь клиентский конфиг. Синтетические `$html`/array-записи добавляет билдер
 * (`synthetic-entries`).
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1. Там функция называлась `loadCatalogJson()` и САМА добывала источник:
 * читала `config/state.getClientCatalog()`, а иначе брала каталог выбранного кита
 * (`kits/registry` + `kits/selection` + `localStorage`). Это состояние приложения, и домену его
 * знать нельзя — источник и конфиг теперь ПАРАМЕТРЫ, а выбор источника остаётся вызывающему
 * (плагин `plugins/kits/`). Отсюда и другое имя: «compose», а не «load» — функция ничего не
 * загружает, она склеивает поставленное с синтетикой билдера.
 *
 * @module lib/catalog/contract
 */

import type { CatalogEntry, CatalogJson, CatalogRecord, CatalogRole } from './types';
import { syntheticRecords, type SyntheticOptions } from './synthetic-entries';
import { makeNodeFor } from './make-node';
import { toDescriptor } from '../kits/descriptor';
import type { KitDescriptor } from '../kits/types';

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
  // Листья и композиции активного кита узел-по-умолчанию берёт из дескриптора, а не из состояния.
  const kit = {
    leafComponents: descriptor.leafComponents,
    compoundTemplates: descriptor.compoundTemplates,
  };
  return json.components.map((r) => ({
    name: r.name,
    role: r.role,
    // Часть compound'а живёт в категории своего корня (`AlertTitle` — там же, где `Alert`): в общий
    // список палитры она не попадает, но при контекстном показе категория должна совпадать с корнем.
    category:
      r.category ??
      categoryOf(r.compoundParent ?? r.name, r.role, categoryByName, categoryOverrides),
    propsSchema: r.propsSchema,
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

/** Итог проверки каталога: годен ли и что именно не так. */
export interface CatalogCheck {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Проверка каталога-JSON против контракта. Синхронная — движок уже загружен. */
export type CatalogValidator = (json: unknown) => CatalogCheck;

/**
 * Загруженный движок и скомпилированная схема. Одна на приложение: компиляция схемы стоит
 * заметно дороже самой проверки, а схема не меняется.
 */
let loading: Promise<CatalogValidator> | null = null;

/**
 * Загрузить проверку каталога.
 *
 * Асинхронная, потому что ajv и схема грузятся **лениво**, и это не оптимизация про запас:
 * статический импорт клал в главный чанк `117.8 кБ` ради функции, которую не звала ни одна
 * строка продакшн-кода — только тесты. Замерено, а не предположено.
 *
 * Проверка нужна там, где каталог пришёл ИЗВНЕ: сторонний кит поставляет свой JSON, и до
 * сборки записей его надо сверить с контрактом. Встроенный кит проверен своей сборкой,
 * поэтому на горячем пути открытия проекта этого нет.
 *
 * Повторный вызов отдаёт ту же работу: параллельные вызовы не заведут двух движков.
 */
export async function loadCatalogValidator(): Promise<CatalogValidator> {
  loading ??= (async (): Promise<CatalogValidator> => {
    const [{ default: Ajv }, schema] = await Promise.all([
      import('ajv'),
      import('./component-catalog.schema.json'),
    ]);
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile((schema.default ?? schema) as object);
    return (json: unknown): CatalogCheck => {
      const valid = validate(json);
      const errors = (validate.errors ?? []).map((e) =>
        `${e.instancePath || '/'} ${e.message ?? ''}`.trim()
      );
      return { valid: Boolean(valid), errors };
    };
  })();
  return loading;
}
