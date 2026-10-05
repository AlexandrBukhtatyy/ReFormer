/**
 * Типы построителя индекса плагинов приложения (`plugins-index.mjs` — zero-dependency JS без
 * деклараций). Нужны `.ts`-тестам, чтобы импортировать его без implicit-any (TS7016).
 */

/** Индекс каталога плагинов приложения — то же, что читает оболочка. */
export interface PluginsIndex {
  version: number;
  files: string[];
}

/** Версия формата индекса. */
export const PLUGINS_INDEX_VERSION: number;

/** Имя файла индекса внутри каталога плагинов. */
export const PLUGINS_INDEX_FILE: string;

/** Обходит каталог плагинов и собирает индекс; каталога нет — пустой индекс. */
export function buildPluginsIndex(rootDir: string): Promise<PluginsIndex>;
