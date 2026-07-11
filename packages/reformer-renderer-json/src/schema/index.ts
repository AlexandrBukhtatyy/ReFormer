/**
 * Мета-схема form-DSL (IETF JSON Schema, draft-07) + утилиты расширения именами реестра.
 *
 * - {@link formSchemaMetaSchema} — базовая мета-схема (структура узлов + синтаксис операторов).
 * - {@link buildFormSchemaMetaSchema} — конкретная схема: сужает `$component(...)` до enum имён.
 * - {@link getComponentNames}/{@link getDataSourceNames} — извлечь имена из реестра по типу.
 *
 * Не тянет ajv (лёгкое; ajv — в `validate.ts`/`@reformer/renderer-json/validate`).
 *
 * @module reformer/renderer-json/schema
 */

import metaSchema from './form-schema.schema.json';
import type { ComponentRegistry } from '../registry/types';

/**
 * Базовая мета-схема form-DSL (draft-07): структура узлов + синтаксис операторов, имена компонентов
 * НЕ ограничены (паттерн `$component(...)` открыт). Для сужения до конкретного реестра —
 * {@link buildFormSchemaMetaSchema}. Используется как `$schema` в IDE и как база валидатора.
 *
 * @example Подключить как `$schema` в JSON-файле схемы
 * ```ts
 * // record можно записать в файл и сослаться на него из "$schema" JSON-схемы.
 * formSchemaMetaSchema.$schema; // 'http://json-schema.org/draft-07/schema#'
 * ```
 */
export const formSchemaMetaSchema = metaSchema as Record<string, unknown>;

/**
 * Имена компонентов реестра (тип `component`) — то, что валидно в `$component(...)`.
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив имён компонентов.
 *
 * @example Сузить мета-схему до компонентов реестра
 * ```ts
 * const names = getComponentNames(registry); // ['Input', 'Select', 'Box', ...]
 * const schema = buildFormSchemaMetaSchema({ componentNames: names });
 * ```
 */
export function getComponentNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => registry.get(n)?.type === 'component');
}

/**
 * Имена registry-dataSource (`reg.dataSource`) — то, что валидно в `$dataSource(...)`:
 * options/itemLabel/константы/loading-компоненты.
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив имён источников.
 *
 * @example
 * ```ts
 * getDataSourceNames(registry); // ['LOAN_TYPES', 'GENDERS', 'LoadingState', ...]
 * ```
 */
export function getDataSourceNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => registry.get(n)?.type === 'dataSource');
}

/**
 * Имена функций реестра (`reg.fn`) — то, что валидно в `$fn(...)`: форматтеры/компараторы/itemLabel/
 * обработчики. Отдельно от {@link getDataSourceNames}, поэтому `validateFormSchema` ловит перепутанные
 * `$fn`/`$dataSource`.
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив имён функций.
 */
export function getFnNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => registry.get(n)?.type === 'fn');
}

/**
 * Известные ключи локализации сервиса реестра (`reg.locale` с каталогом) — то, что валидно в
 * `$locale(...)`. `undefined`, если сервис не зарегистрирован или задан голым резолвером без `keys`
 * (тогда `validateFormSchema` мягко пропускает проверку ключей, как для `$model`-путей).
 *
 * @param registry - Реестр (см. {@link defineRegistry}).
 * @returns Массив ключей либо `undefined`.
 */
export function getLocaleKeys(registry: ComponentRegistry): readonly string[] | undefined {
  return registry.getLocale?.()?.keys;
}

/**
 * Конкретная мета-схема: базовая + (если заданы `componentNames`) сужение `$component(...)` до
 * enum допустимых значений (`["$component(Input)", "$component(Select)", …]`). `$dataSource`-имена
 * JSON Schema'й не покрыть (вложены в произвольный componentProps) — их проверяет рекурсивный обход
 * в `validateFormSchema`.
 *
 * enum, а не regex-`pattern`: ajv перечисляет допустимые имена в тексте ошибки, IDE даёт
 * автодополнение по значениям, а имена не нужно экранировать под regex (напр. `$fieldWrapper`).
 *
 * @example
 * ```ts
 * const schema = buildFormSchemaMetaSchema({ componentNames: getComponentNames(registry) });
 * ```
 */
export function buildFormSchemaMetaSchema(opts?: {
  componentNames?: string[];
}): Record<string, unknown> {
  const schema = JSON.parse(JSON.stringify(metaSchema)) as {
    definitions: { componentOp: { pattern?: string; enum?: string[] } };
  };
  const names = opts?.componentNames;
  if (names && names.length > 0) {
    const op = schema.definitions.componentOp;
    delete op.pattern;
    op.enum = names.map((n) => `$component(${n})`);
  }
  return schema as unknown as Record<string, unknown>;
}
