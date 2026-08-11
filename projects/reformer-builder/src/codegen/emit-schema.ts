/**
 * Эмиттер `renderer.schema.json` — форма как JSON-DSL, каноничное имя слоя рендера
 * (см. `@reformer/mcp` docs/llms/06-form-directory-layout.md). Именно JSON, а не TS-литерал:
 * так экспортированный пример открывается обратно в canvas билдера, а его набор файлов совпадает
 * с тем, что отдают встроенные шаблоны.
 *
 * `$schema`/`version` проставляются, если их не было в схеме из canvas: по маркеру в `$schema`
 * дискавери даёт бейдж `high` (`io/discovery.ts`).
 *
 * @module reformer-builder/codegen/emit-schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

/** Маркер мета-схемы: app-level файл рядом с базовым реестром renderer-json. */
const SCHEMA_MARKER = './form-schema.schema.json';

export function emitSchema(schema: JsonFormSchema): string {
  const { $schema, version, ...rest } = schema as JsonFormSchema & {
    $schema?: string;
    version?: string;
  };
  // Порядок ключей осознанный: `$schema` и `version` — шапка файла, дальше тело схемы.
  const out = { $schema: $schema ?? SCHEMA_MARKER, version: version ?? '1.0', ...rest };
  return JSON.stringify(out, null, 2) + '\n';
}
