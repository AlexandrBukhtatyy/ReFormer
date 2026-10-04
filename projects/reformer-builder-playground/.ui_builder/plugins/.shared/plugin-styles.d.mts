/** Типы генератора стилей плагина — см. `plugin-styles.mjs`. */

/** Куда пишется таблица — относительно каталога пакета плагина. */
export const PLUGIN_STYLES_FILE: string;

/** Имя npm-скрипта, которым пакет плагина собирает таблицу. */
export const PLUGIN_STYLES_SCRIPT: string;

/** Аргументы запуска: каталоги `--with`, разрешённые от каталога пакета. */
export function parsePluginStylesArgs(argv: readonly string[], packageDir: string): string[];

/** Таблица недостающих утилит пакета плагина; `rules` — число правил-утилит в ней. */
export function pluginStyles(
  packageDir: string,
  extraDirs?: readonly string[]
): Promise<{ readonly css: string; readonly rules: number }>;
