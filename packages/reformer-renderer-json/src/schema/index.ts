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
 * Имена компонентов реестра (тип `field` или `container`) — то, что валидно в `$component(...)`.
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
  return registry.names().filter((n) => {
    const t = registry.get(n)?.type;
    return t === 'field' || t === 'container';
  });
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

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Конкретная мета-схема: базовая + (если заданы `componentNames`) сужение паттерна `$component(...)`
 * до enum имён (`^\$component\((Input|Select|…)\)$`). `$dataSource`-имена JSON Schema'й не покрыть
 * (вложены в произвольный componentProps) — их проверяет рекурсивный обход в `validateFormSchema`.
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
    definitions: { componentOp: { pattern: string } };
  };
  const names = opts?.componentNames;
  if (names && names.length > 0) {
    const alt = names.map(escapeRe).join('|');
    schema.definitions.componentOp.pattern = `^\\$component\\((${alt})\\)$`;
  }
  return schema as unknown as Record<string, unknown>;
}
