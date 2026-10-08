/**
 * Объявления для `source-resolve.mjs` — конфиги сборки пишутся на TypeScript.
 *
 * @module vite/source-resolve
 */

/** Рантаймы, которым на странице положена одна копия. */
export const BUILDER_DEDUPE: readonly string[];

/** Вход библиотеки — билдер, встроенный в приложение. */
export const BUILDER_ENTRY: string;

/** Псевдонимы исходников билдера: спецификатор → путь. Порядок ключей значим. */
export function builderSourceAliases(): Record<string, string>;

/** Раздел `resolve` для приложения, в которое встроен билдер. */
export function builderHostResolve(): {
  dedupe: string[];
  alias: Record<string, string>;
};
