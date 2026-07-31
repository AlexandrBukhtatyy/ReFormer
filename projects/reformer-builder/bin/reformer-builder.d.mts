/**
 * Типы для тестируемых экспортов launcher'а (`reformer-builder.mjs` — zero-dependency JS без
 * деклараций). Позволяет `.ts`-тестам импортировать хелперы без implicit-any (TS7016).
 */

export interface LauncherOpts {
  port: number;
  host: string;
  open: boolean;
  help: boolean;
  version: boolean;
  /** Путь к каталогу компонентов (`--catalog`) или `null` (авто-детект в cwd). */
  catalog: string | null;
  /** Путь к конфигу билдера (`--config`) или `null` (авто-детект в cwd). */
  config: string | null;
}

export interface RuntimeBundleResult {
  payload: { catalog: unknown; config: unknown };
  sources: { catalog: string | null; config: string | null };
}

/** URL раздачи клиентского bundle. */
export const RUNTIME_BUNDLE_URL: string;

export function parseArgs(argv: string[]): LauncherOpts;

export function loadRuntimeBundle(
  opts: { catalog: string | null; config: string | null },
  cwd: string
): Promise<RuntimeBundleResult>;

export function createRequestHandler(
  indexHtmlPath: string,
  runtimeBundleBody: Buffer
): (req: unknown, res: unknown) => Promise<void>;
