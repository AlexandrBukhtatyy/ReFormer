/**
 * Типы для тестируемых экспортов лаунчера (`reformer-builder.mjs` — zero-dependency JS без
 * деклараций). Позволяют `.ts`-тестам импортировать хелперы без implicit-any (TS7016).
 */

export interface LauncherOpts {
  port: number;
  host: string;
  open: boolean;
  help: boolean;
  version: boolean;
  /** Путь к конфигу билдера (`--config`) или `null` (авто-детект `.ui_builder/config.json` в cwd). */
  config: string | null;
  /** Каталог плагинов приложения (`--plugins`) или `null` — раздаётся `dist/plugins`. */
  plugins: string | null;
}

export interface RuntimeBundleResult {
  payload: { config: unknown };
  sources: { config: string | null };
}

/** URL раздачи конфига запуска. */
export const RUNTIME_BUNDLE_URL: string;

/** Адрес каталога плагинов приложения, со слэшами по краям. */
export const PLUGINS_URL_PREFIX: string;

export function parseArgs(argv: string[]): LauncherOpts;

export function loadRuntimeBundle(
  opts: { config: string | null },
  cwd: string
): Promise<RuntimeBundleResult>;

export function createRequestHandler(
  indexHtmlPath: string,
  runtimeBundleBody: Buffer,
  options?: { pluginsDir?: string | null; rootDir?: string }
): (req: unknown, res: unknown) => Promise<void>;
