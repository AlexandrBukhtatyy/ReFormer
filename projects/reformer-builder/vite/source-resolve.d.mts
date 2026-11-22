/**
 * Объявления для `source-resolve.mjs` — конфиги сборки пишутся на TypeScript.
 *
 * @module vite/source-resolve
 */

/** Рантаймы, которым на странице положена одна копия. */
export const BUILDER_DEDUPE: readonly string[];

/** Псевдонимы исходников билдера: спецификатор → путь. Порядок ключей значим. */
export function builderSourceAliases(): Record<string, string>;
