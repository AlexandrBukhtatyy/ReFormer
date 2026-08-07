/**
 * Контракт каталога компонентов (спека §5, §15). Билдер ВЛАДЕЕТ JSON Schema контрактом
 * (`component-catalog.schema.json`); клиент (`@reformer/ui-kit`) генерирует под него валидный
 * catalog-JSON (`@reformer/ui-kit/catalog`, команда `generate:catalog`). Здесь: загрузка каталога
 * от клиента ({@link loadCatalogJson}), валидатор против контракта ({@link validateCatalog}) и
 * реконструкция `CatalogEntry[]` с `makeNode` ({@link buildCatalogFromJson}).
 *
 * Категория палитры назначается на загрузке по карте активного кита
 * (`descriptor.palette.categoryByName`; для «неявного кита» это дефолтная карта билдера), поверх
 * которой может лечь клиентский конфиг. Синтетические `$html`/array-записи добавляет билдер
 * (`synthetic-entries`).
 *
 * @module reformer-builder/catalog/contract
 */

import Ajv, { type ValidateFunction } from 'ajv';
import type { ComponentsConfig } from '../config/types';
import { getClientCatalog, getRuntimeConfig } from '../config/state';
import type { CatalogEntry, CatalogJson, CatalogRecord, CatalogRole } from './types';
import { syntheticRecords } from './synthetic-entries';
import { makeNodeFor } from './make-node';
import catalogSchema from './component-catalog.schema.json';
import { toDescriptor } from '../kits/descriptor';
import { getKitOrDefault } from '../kits/registry';
import { getSelectedKitId } from '../kits/selection';
import type { KitDescriptor } from '../kits/types';

/** JSON Schema контракта каталога (draft-07). Владелец — билдер; ui-kit генерирует под неё. */
export const CATALOG_SCHEMA = catalogSchema;

function categoryOf(
  name: string,
  role: CatalogRole,
  categoryByName: Record<string, string>
): string {
  // Клиентский конфиг может доопределить/переопределить категорию по имени (сливается поверх дефолта).
  const override = getRuntimeConfig().palette?.categoryByName?.[name];
  if (override) return override;
  // Typography разбит на отдельные компоненты (TypographyH1…Muted) — собственный раздел «Типографика».
  if (name.startsWith('Typography')) return 'Типографика';
  return categoryByName[name] ?? (role === 'container' ? 'Контейнеры' : 'Прочее');
}

/** Отфильтровать записи по whitelist/blacklist имён из клиентского конфига (по имени компонента). */
function filterComponents(
  records: CatalogRecord[],
  cfg: ComponentsConfig | undefined
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
 * Источник — клиентский каталог (`--catalog` при локальном старте, {@link getClientCatalog}), иначе
 * вшитый `@reformer/ui-kit/catalog`. Конфиг клиента может сузить synthetic-набор и отфильтровать
 * компоненты (include/exclude). Единственная граница источника — смена клиента не трогает остальной код.
 */
export function loadCatalogJson(): CatalogJson {
  const componentsCfg = getRuntimeConfig().components;
  // Приоритет: каталог, переданный клиентом через `--catalog`, иначе каталог ВЫБРАННОГО кита
  // (по умолчанию — вшитый `@reformer/ui-kit`).
  const supplied = getClientCatalog() ?? getKitOrDefault(getSelectedKitId()).catalog;
  const all = [...supplied.components, ...syntheticRecords(componentsCfg?.synthetic)];
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
 */
export function buildCatalogFromJson(
  json: CatalogJson,
  descriptor: KitDescriptor = toDescriptor(json)
): CatalogEntry[] {
  const categoryByName = descriptor.palette.categoryByName;
  return json.components.map((r) => ({
    name: r.name,
    role: r.role,
    // Часть compound'а живёт в категории своего корня (`AlertTitle` — там же, где `Alert`): в общий
    // список палитры она не попадает, но при контекстном показе категория должна совпадать с корнем.
    category: r.category ?? categoryOf(r.compoundParent ?? r.name, r.role, categoryByName),
    propsSchema: r.propsSchema,
    ...(r.variantGroup ? { variantGroup: r.variantGroup } : {}),
    ...(r.variant ? { variant: r.variant } : {}),
    ...(r.compoundParent ? { compoundParent: r.compoundParent } : {}),
    // Поля контракта 2.0 прокидываются только когда кит их реально прислал: для каталога 1.0
    // форма записи остаётся байт-в-байт прежней (закреплено снапшот-тестом эквивалентности).
    ...(r.exportName ? { exportName: r.exportName } : {}),
    ...(r.subpath ? { subpath: r.subpath } : {}),
    makeNode: () => makeNodeFor(r.name, r.role, r.compoundParent),
  }));
}

let validateFn: ValidateFunction | null = null;

/** Провалидировать catalog-JSON против контракта (§5: билдер валидирует поставляемый каталог). */
export function validateCatalog(json: unknown): { valid: boolean; errors: string[] } {
  if (!validateFn) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validateFn = ajv.compile(CATALOG_SCHEMA);
  }
  const valid = validateFn(json);
  const errors = (validateFn.errors ?? []).map((e) =>
    `${e.instancePath || '/'} ${e.message ?? ''}`.trim()
  );
  return { valid: Boolean(valid), errors };
}
