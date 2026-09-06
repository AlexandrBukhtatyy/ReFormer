/**
 * Проверка схемы, пришедшей от плагина, перед отрисовкой.
 *
 * Проверка СТРУКТУРНАЯ и дешёвая: объект, версия, корень. Полный валидатор
 * (`@reformer/renderer-json/validate` поверх ajv) сюда не зовётся намеренно — он асинхронный
 * и весит сотню килобайт, а карточке нужен синхронный ответ на каждый кадр. Настоящую
 * непригодность всё равно поймает сборка формы: она обёрнута и показывает отказ словами.
 *
 * Смысл этой проверки в другом — не пустить в рендерер то, что схемой не является вовсе
 * (число, строка, `null`, объект без корня). Такой вклад — это ошибка автора плагина,
 * и ответить на неё надо «настроек нет», а не стеной текста из недр конвертера.
 *
 * @module shell/boot/settings/schema-guard
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

/** Похоже ли значение на схему формы. `null` — не похоже, показывать нечего. */
export function asFormSchema(value: unknown): JsonFormSchema | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as { root?: unknown };
  if (typeof candidate.root !== 'object' || candidate.root === null) return null;
  return value as JsonFormSchema;
}
