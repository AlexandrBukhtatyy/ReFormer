/** Типы генератора стилей плагина — см. `plugin-styles.mjs`. */

/** Куда пишется таблица — относительно каталога пакета плагина. */
export const PLUGIN_STYLES_FILE: string;

/** Имя npm-скрипта, которым пакет плагина собирает таблицу. */
export const PLUGIN_STYLES_SCRIPT: string;

/** Что генератору сказано сверх исходников плагина. */
export interface PluginStylesOptions {
  /** Каталоги, чьи классы рисует этот плагин (`--with`). */
  readonly extraDirs?: readonly string[];
  /** Плагины Tailwind — именами пакетов (`--plugin`). */
  readonly plugins?: readonly string[];
  /** Файлы постоянных блоков CSS (`--include`). */
  readonly includes?: readonly string[];
}

/** Аргументы запуска; пути разрешены от каталога пакета. */
export function parsePluginStylesArgs(
  argv: readonly string[],
  packageDir: string
): Required<PluginStylesOptions>;

/** Таблица стилей пакета плагина; `rules` — число правил в ней. */
export function pluginStyles(
  packageDir: string,
  options?: PluginStylesOptions
): Promise<{ readonly css: string; readonly rules: number }>;
