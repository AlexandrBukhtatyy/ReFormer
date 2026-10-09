/**
 * Типы построителя индекса плагинов приложения (`plugins-index.mjs` — zero-dependency JS без
 * деклараций). Нужны `.ts`-тестам, чтобы импортировать его без implicit-any (TS7016).
 */

/** Индекс каталога плагинов приложения — то же, что читает оболочка. */
export interface PluginsIndex {
  version: number;
  files: string[];
  /** Каталог плагина → ревизия его файлов. Только у живого каталога. */
  revisions?: Record<string, string>;
}

/** Память отпечатков файлов живого каталога: путь → то, по чему отпечаток узнаётся без чтения. */
export type RevisionMemo = Map<string, { size: number; mtimeMs: number; hash: string }>;

export interface PluginsScanOptions {
  /** Каталоги плагинов от корня (`base/files`); без списка в индекс идёт весь каталог. */
  include?: readonly string[];
  /** Память отпечатков: с ней индекс несёт ревизии плагинов. */
  revisions?: RevisionMemo;
}

export interface PluginsScan {
  index: PluginsIndex;
  /** Каталоги из `include`, в корне которых нет манифеста: плагин не собран. */
  missing: string[];
}

/** Версия формата индекса. */
export const PLUGINS_INDEX_VERSION: number;

/** Имя файла индекса внутри каталога плагинов. */
export const PLUGINS_INDEX_FILE: string;

/** Память отпечатков файлов живого каталога — одна на каталог, на всё время работы сервера. */
export function createRevisionMemo(): RevisionMemo;

/** Набор плагинов по названному пути. */
export interface PluginsSet {
  /** Каталог плагинов без хвостового разделителя. */
  dir: string;
  /** Каталоги плагинов набора; без списка — весь каталог. */
  include?: string[];
}

/**
 * Набор плагинов по названному пути: каталог идёт целиком, файл — список набора
 * (`{ root, plugins }`, корень — от каталога файла). Бросает, если пути нет или список не тот.
 */
export function resolvePluginsSet(target: string): PluginsSet;

/** Лежит ли путь от корня каталога плагинов в одном из названных каталогов. */
export function isIncludedPluginPath(path: string, include: readonly string[] | undefined): boolean;

/** Обходит каталог плагинов: индекс и названные, но не собранные плагины. */
export function scanPlugins(rootDir: string, options?: PluginsScanOptions): Promise<PluginsScan>;

/** Обходит каталог плагинов и собирает индекс; каталога нет — пустой индекс. */
export function buildPluginsIndex(
  rootDir: string,
  options?: PluginsScanOptions
): Promise<PluginsIndex>;
