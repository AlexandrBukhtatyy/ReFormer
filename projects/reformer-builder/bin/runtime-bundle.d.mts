/**
 * Типы чтения и раздачи конфига уровня запуска (`runtime-bundle.mjs`).
 *
 * @module bin/runtime-bundle
 */

export type ConfigFileResult =
  | { ok: true; config: unknown }
  | { ok: false; reason: 'missing' | 'unreadable' | 'invalid'; message: string };

/** URL раздачи конфига запуска. */
export const RUNTIME_BUNDLE_URL: string;

/** Путь конфига в каталоге запуска, если его не назвали явно. */
export const DEFAULT_CONFIG_FILE: string;

/** Читает и разбирает файл конфига; отказ — значением. */
export function readConfigFile(path: string): Promise<ConfigFileResult>;

/** Конфиг для dev-сервера: отказ не роняет сервер, а уходит в `report`. */
export function readConfigForDevServer(options: {
  file: string;
  explicit: boolean;
  report: (message: string) => void;
}): Promise<unknown>;

/** Тело ответа по адресу конфига: конфиг и то, что сервер сообщает о себе сверх него. */
export function runtimeBundleBody(config: unknown, extra?: Record<string, unknown>): Buffer;
