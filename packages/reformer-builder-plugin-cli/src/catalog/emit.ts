/**
 * Сборка и сериализация каталога: фиксированный порядок ключей, форматирование.
 *
 * Детерминизм — свойство генератора, а не удача: два прогона на одних типах обязаны дать
 * байт-в-байт один файл, иначе `--check` и ревью тонули бы в перестановках. Поэтому порядок
 * ключей задан здесь списками, записи и пропсы отсортированы по кодовым точкам (а не
 * `localeCompare`, зависящим от машины), а описания не переносятся из прошлой версии файла.
 *
 * Форматирование — prettier кита, если он разрешается из его каталога: репозиторий, где
 * `lint-staged` прогоняет prettier по JSON, иначе спорил бы с генератором на каждом коммите.
 * Нет prettier — `JSON.stringify` с отступом в два пробела. `--check` сравнивает разобранный
 * JSON, поэтому форматирование на проверку не влияет.
 *
 * @module @reformer/builder-plugin-cli/catalog/emit
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CatalogJson } from '@reformer/builder-plugin-api';

import { compareCodePoints } from './policy.js';

type JsonObject = { [key: string]: unknown };

/** Каталог, как его пишет генератор: контракт плюс ссылка на схему. */
export type GeneratedCatalog = CatalogJson & { $schema?: string };

const CATALOG_KEYS = ['$schema', 'version', 'kit', 'components'];

const KIT_KEYS = [
  'id',
  'label',
  'package',
  'version',
  'peerRanges',
  'infra',
  'adapters',
  'palette',
  'styles',
  'codegen',
  'renderers',
];

const RECORD_KEYS = [
  'name',
  'role',
  'category',
  'exportName',
  'subpath',
  'compoundParent',
  'variantGroup',
  'variant',
  'palette',
  'preview',
  'leaf',
  'classGroups',
  'propsSchema',
];

const PROPS_SCHEMA_KEYS = [
  'type',
  'additionalProperties',
  'properties',
  'x-runtimeProps',
  'x-inherits',
];

const PROP_KEYS = [
  'type',
  'enum',
  'items',
  'properties',
  'required',
  'additionalProperties',
  'default',
  'minimum',
  'maximum',
  'description',
  'x-messageKey',
  'x-doc',
];

const DOC_KEYS = ['group', 'type', 'kind', 'default', 'description'];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Ключи из списка — в его порядке, остальные — по кодовым точкам. */
export function orderKeys(value: JsonObject, order: readonly string[]): JsonObject {
  const out: JsonObject = {};
  for (const key of order) if (value[key] !== undefined) out[key] = value[key];
  for (const key of Object.keys(value).sort(compareCodePoints)) {
    if (!order.includes(key) && value[key] !== undefined) out[key] = value[key];
  }
  return out;
}

/** Схема одного пропа в каноническом порядке ключей (рекурсивно — `items`, `properties`). */
export function orderPropSchema(schema: JsonObject): JsonObject {
  const ordered = orderKeys(schema, PROP_KEYS);
  if (isObject(ordered['x-doc'])) ordered['x-doc'] = orderKeys(ordered['x-doc'], DOC_KEYS);
  if (isObject(ordered.items)) ordered.items = orderPropSchema(ordered.items);
  if (isObject(ordered.properties)) {
    ordered.properties = Object.fromEntries(
      Object.entries(ordered.properties).map(([key, value]) => [
        key,
        isObject(value) ? orderPropSchema(value) : value,
      ])
    );
  }
  return ordered;
}

/** `propsSchema` записи: ключи по порядку, пропсы по кодовым точкам имени. */
function orderPropsSchema(schema: JsonObject): JsonObject {
  const ordered = orderKeys(schema, PROPS_SCHEMA_KEYS);
  if (isObject(ordered.properties)) {
    ordered.properties = Object.fromEntries(
      Object.keys(ordered.properties)
        .sort(compareCodePoints)
        .map((key) => {
          const value = (ordered.properties as JsonObject)[key];
          return [key, isObject(value) ? orderPropSchema(value) : value];
        })
    );
  }
  if (isObject(ordered['x-runtimeProps'])) {
    ordered['x-runtimeProps'] = Object.fromEntries(
      Object.entries(ordered['x-runtimeProps']).map(([key, value]) => [
        key,
        isObject(value) ? orderKeys(value, DOC_KEYS) : value,
      ])
    );
  }
  return ordered;
}

/** Собирает каталог в каноническом порядке ключей; записи — по кодовым точкам имени. */
export function assembleCatalog(input: {
  readonly schemaRef?: string;
  readonly version: string;
  readonly kit: JsonObject;
  readonly components: readonly JsonObject[];
}): GeneratedCatalog {
  const components = [...input.components]
    .sort((a, b) => compareCodePoints(String(a.name), String(b.name)))
    .map((record) => {
      const ordered = orderKeys(record, RECORD_KEYS);
      if (isObject(ordered.propsSchema))
        ordered.propsSchema = orderPropsSchema(ordered.propsSchema);
      return ordered;
    });
  return orderKeys(
    {
      $schema: input.schemaRef,
      version: input.version,
      kit: orderKeys(input.kit, KIT_KEYS),
      components,
    },
    CATALOG_KEYS
  ) as unknown as GeneratedCatalog;
}

/** Минимум API prettier, которым пользуется генератор. */
interface PrettierApi {
  format(source: string, options: Record<string, unknown>): Promise<string> | string;
  resolveConfig(file: string): Promise<Record<string, unknown> | null>;
}

/**
 * Текст каталога: prettier кита (если разрешается из `dir`) или `JSON.stringify`. В конце —
 * перевод строки.
 */
export async function serializeCatalog(
  catalog: GeneratedCatalog,
  options: { readonly dir: string; readonly outFile: string; readonly prettier?: boolean }
): Promise<string> {
  const json = `${JSON.stringify(catalog, null, 2)}\n`;
  if (options.prettier === false) return json;
  const prettier = await loadPrettier(options.dir);
  if (prettier === undefined) return json;
  try {
    const config = (await prettier.resolveConfig(options.outFile)) ?? {};
    return await prettier.format(json, { ...config, parser: 'json', filepath: options.outFile });
  } catch {
    return json;
  }
}

async function loadPrettier(dir: string): Promise<PrettierApi | undefined> {
  try {
    const resolved = createRequire(join(dir, '__reformer-catalog__.js')).resolve('prettier');
    const module = (await import(pathToFileURL(resolved).href)) as Partial<PrettierApi> & {
      default?: Partial<PrettierApi>;
    };
    const api = typeof module.format === 'function' ? module : module.default;
    return api !== undefined &&
      typeof api.format === 'function' &&
      typeof api.resolveConfig === 'function'
      ? (api as PrettierApi)
      : undefined;
  } catch {
    return undefined;
  }
}
