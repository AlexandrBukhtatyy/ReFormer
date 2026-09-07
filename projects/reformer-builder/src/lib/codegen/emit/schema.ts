/**
 * Эмиттер `renderer.schema.json` — форма как JSON-DSL, каноничное имя слоя рендера
 * (`@reformer/mcp` docs/llms/06-form-directory-layout.md §1).
 *
 * Расширение выбрано осознанно, и канон требует именно осознанного выбора. Дефолт канона —
 * `renderer.schema.ts` с `defineJsonSchema<T>`: этот хелпер типизирует литерал против модели,
 * поэтому опечатка в `$model(personalData.frstName)` становится ошибкой КОМПИЛЯЦИИ. С чистым
 * `.json` этой проверки нет и подхватить её больше некому.
 *
 * Билдер платит эту цену ради round-trip: экспортированная форма открывается обратно в редакторе
 * схемы. С `.ts` экспорт стал бы дверью в одну сторону. Цена названа в сгенерированном README —
 * чтобы выбор доехал и до того, кто получит пример.
 *
 * @module lib/codegen/emit/schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { EmitContext } from '../context';

/** Маркер мета-схемы: app-level файл рядом с базовым реестром renderer-json. */
const SCHEMA_MARKER = './form-schema.schema.json';

export function emitSchema(ctx: EmitContext): string {
  const { $schema, version, ...rest } = ctx.schema as JsonFormSchema & {
    $schema?: string;
    version?: string;
  };
  // Порядок ключей осознанный: `$schema` и `version` — шапка файла, дальше тело схемы.
  const out = { $schema: $schema ?? SCHEMA_MARKER, version: version ?? '1.0', ...rest };
  return `${JSON.stringify(out, null, 2)}\n`;
}
