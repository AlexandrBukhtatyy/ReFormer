/**
 * Эмиттеры документа формы (`schema/form.schema.json`) — форма как JSON-DSL, каноничное имя
 * слоя рендера (`@reformer/mcp` docs/llms/06-form-directory-layout.md), — и файлов схемы шагов.
 *
 * Расширение выбрано осознанно, и канон требует именно осознанного выбора. Дефолт канона —
 * `form.schema.ts` с `defineJsonSchema<T>`: этот хелпер типизирует литерал против модели,
 * поэтому опечатка в `$model(personalData.frstName)` становится ошибкой КОМПИЛЯЦИИ. С чистым
 * `.json` этой проверки нет и подхватить её больше некому.
 *
 * Билдер платит эту цену ради round-trip: экспортированная форма открывается обратно в редакторе
 * схемы. С `.ts` экспорт стал бы дверью в одну сторону. Цена названа в сгенерированном README —
 * чтобы выбор доехал и до того, кто получит пример.
 *
 * Визард, разбитый по шагам, печатается разбитым: корень — скелет со ссылками
 * `{ "$ref": "./steps/<шаг>/form.schema.json" }`, шаги — каждый в свой файл (`ctx.composition`).
 * Ссылка относительна корневого документа, поэтому файлы шагов лежат рядом с ним:
 * `schema/steps/<шаг>/form.schema.json`.
 *
 * @module plugins/reformer/core/codegen/emit/schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { EmitContext } from '../context';

/** Маркер мета-схемы: app-level файл рядом с базовым реестром renderer-json. */
const SCHEMA_MARKER = './form-schema.schema.json';

function printJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function emitSchema(ctx: EmitContext): string {
  const source = ctx.composition?.skeleton ?? ctx.schema;
  // `format` из исходника не берём: документ билдера — всегда формата 2 (`normalize`).
  const {
    $schema,
    format: _format,
    version,
    ...rest
  } = source as JsonFormSchema & {
    $schema?: string;
    version?: string;
  };
  // Порядок ключей осознанный: `$schema`, `format` и `version` — шапка файла, дальше тело схемы.
  const out = { $schema: $schema ?? SCHEMA_MARKER, format: 2, version: version ?? '1.0', ...rest };
  return printJson(out);
}

/**
 * Файл схемы шага (`schema/steps/<шаг>/form.schema.json`) — цель, размноженная по шагам.
 *
 * @throws Error если шаг не вынесен: такой цели здесь быть не должно (её `applies` это отсекает).
 */
export function emitStepSchema(ctx: EmitContext): string {
  const ref = ctx.step?.schemaRef ?? null;
  const part = ref === null ? undefined : ctx.composition?.parts.get(ref);
  if (part === undefined) {
    throw new Error(`emitStepSchema: шаг «${ctx.step?.title ?? '?'}» не вынесен в свой файл`);
  }
  return printJson(part);
}
