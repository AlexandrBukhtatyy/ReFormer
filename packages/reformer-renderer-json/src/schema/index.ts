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

/** Базовая мета-схема form-DSL (draft-07): структура + синтаксис операторов, имена не ограничены. */
export const formSchemaMetaSchema = metaSchema as Record<string, unknown>;

/** Имена компонентов реестра (`reg.field`/`reg.container`). */
export function getComponentNames(registry: ComponentRegistry): string[] {
  return registry.names().filter((n) => {
    const t = registry.get(n)?.type;
    return t === 'field' || t === 'container';
  });
}

/** Имена registry-dataSource (`reg.dataSource`): options/itemLabel/константы/loading-компоненты. */
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
