/**
 * Типы раздачи файлов с диска (`static.mjs`).
 *
 * Запрос и ответ — `unknown`: модуль берёт у них по два-три члена и одинаково работает
 * с `node:http`, с прослойками dev-сервера и с подделками в тестах.
 *
 * @module bin/static
 */

export const MIME: Readonly<Record<string, string>>;
export const IMMUTABLE_URL_PREFIX: string;
export const CACHE_REVALIDATE: string;
export const CACHE_IMMUTABLE: string;

/** Каталог без хвостового разделителя. */
export function trimTrailingSeparators(dir: string): string;

/** Путь запроса → файл внутри каталога; `null` — путь выходит за каталог или не разбирается. */
export function resolveFsPath(pathname: string, rootDir: string): string | null;

/** Метка версии файла — размер и время изменения. */
export function etagOf(info: { size: number; mtimeMs: number }): string;

/** Называет ли заголовок `If-None-Match` эту метку. */
export function matchesEtag(header: unknown, etag: string): boolean;

/** Отдаёт файл — или «не изменился», если у браузера он уже есть. */
export function sendFile(
  req: unknown,
  res: unknown,
  filePath: string,
  options?: { immutable?: boolean }
): Promise<void>;

/** Отдаёт готовое тело JSON. */
export function sendJson(req: unknown, res: unknown, body: Buffer): void;

/** Короткий текстовый отказ. */
export function sendStatus(res: unknown, status: number, text: string): void;

/** Раздача собранного приложения из каталога. */
export function createStaticHandler(options: {
  rootDir: string;
  indexHtmlPath: string;
}): (req: unknown, res: unknown, pathname: string) => Promise<void>;
