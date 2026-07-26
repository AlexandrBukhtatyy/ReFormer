/**
 * Экспорт схемы (Mode A, спека §10): скачать `JsonFormSchema` как `.json`. Round-trip-принтер
 * (prettier, M2) здесь не нужен — простой `JSON.stringify` с отступом 2.
 *
 * @module reformer-builder/io/export
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

/** Сериализовать схему (2 пробела, финальный перевод строки). */
export function serializeSchema(schema: JsonFormSchema): string {
  return JSON.stringify(schema, null, 2) + '\n';
}

/** Скачать схему как файл (Mode A export). */
export function downloadSchema(schema: JsonFormSchema, filename = 'form.json'): void {
  const blob = new Blob([serializeSchema(schema)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
