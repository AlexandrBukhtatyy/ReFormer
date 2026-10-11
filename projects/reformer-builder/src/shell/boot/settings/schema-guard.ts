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
 * ## Схема прежнего формата переводится здесь
 *
 * Плагин вправе принести схему прежнего формата (`value` / `array`, шаги в пропсах): она написана
 * давно и лежит в его коде. Единая сборка такой документ не собирает, поэтому он переводится в
 * формат 2 на входе — один раз на объект вклада. Один раз не ради скорости: проверка зовётся на
 * каждый кадр, а форма настроек пересобирается на смену ссылки схемы, и новый объект на каждый
 * вызов отнимал бы фокус у поля на первом же символе.
 *
 * @module shell/boot/settings/schema-guard
 */

import { migrateJsonSchema, type JsonFormSchema } from '@reformer/renderer-json';

/** Вклад плагина → его схема в формате 2. */
const migrated = new WeakMap<object, JsonFormSchema>();

/** Похоже ли значение на схему формы. `null` — не похоже, показывать нечего. */
export function asFormSchema(value: unknown): JsonFormSchema | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as { root?: unknown };
  if (typeof candidate.root !== 'object' || candidate.root === null) return null;

  const known = migrated.get(value);
  if (known !== undefined) return known;
  // Схема формата 2 возвращается той же ссылкой; прежняя — переведённой копией.
  const schema = migrateJsonSchema(value);
  migrated.set(value, schema);
  return schema;
}
