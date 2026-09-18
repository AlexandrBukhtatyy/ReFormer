/**
 * Что в экспортах точки входа считается плагином.
 *
 * Одно правило на загрузчик оболочки и сборку плагина (`reformer-plugin build` проверяет
 * собранный `main.js` им же): сборка, признающая плагином то, что загрузчик отвергнет
 * с `not-a-plugin`, выпускала бы плагин, который не грузится.
 *
 * @module @reformer/builder-plugin-api/plugin/plugin-exports
 */

import type { Plugin } from './types.js';

/** Похоже ли значение на плагин. Больше рантайму знать о нём нечего. */
function asPlugin(value: unknown): Plugin | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as { id?: unknown; activate?: unknown };
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') return undefined;
  if (typeof candidate.activate !== 'function') return undefined;
  return value as Plugin;
}

/**
 * Достаёт плагин из экспортов точки входа.
 *
 * Две формы, потому что их две в жизни: `module.exports = definePlugin(...)` у собранного
 * `main.js` и `export default definePlugin(...)` у `main.ts`, который транспилируется
 * в `exports.default`. Требовать одну из них значило бы отвергать половину рабочих плагинов
 * ради формальности.
 */
export function pluginFromExports(exports: unknown): Plugin | undefined {
  const direct = asPlugin(exports);
  if (direct !== undefined) return direct;
  if (typeof exports === 'object' && exports !== null) {
    return asPlugin((exports as { default?: unknown }).default);
  }
  return undefined;
}
