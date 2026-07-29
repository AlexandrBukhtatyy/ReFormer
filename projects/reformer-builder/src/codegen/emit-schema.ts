/**
 * Эмиттер `schema.ts` — форма как типизированный `JsonFormSchema`-литерал (без JSON-файла).
 * JSON — валидный TS-литерал; prettier снимет кавычки с ключей.
 *
 * @module reformer-builder/codegen/emit-schema
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

export function emitSchema(schema: JsonFormSchema): string {
  return `// schema.ts — форма как типизированный JsonFormSchema. Регенерируется.

import type { JsonFormSchema } from '@reformer/renderer-json';

export const schema: JsonFormSchema = ${JSON.stringify(schema, null, 2)};
`;
}
