/**
 * Раздача файлов с диска — общее у всех, кто отдаёт билдер по HTTP.
 *
 * Таких двое: лаунчер (`./reformer-builder.mjs`, свой сервер над `dist/`) и плагин Vite
 * (`../vite/plugin.mjs`, билдер под префиксом на dev-сервере приложения). Раздают они одно
 * и то же и по одним правилам — защита от выхода за каталог, метка версии, «не изменился», —
 * поэтому правила живут здесь, а не в лаунчере: его нельзя импортировать, не запустив сервер.
 *
 * Модуль без побочных действий: ничего не читает при импорте и процесс не завершает.
 * Zero-dependency и обычным JS — едет в опубликованном пакете рядом с лаунчером.
 *
 * @module bin/static
 */

import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Каталог без хвостового разделителя: иначе `rootDir + sep` даёт двойной слэш и проверка
 * границы каталога в {@link resolveFsPath} никогда не совпадает (все запросы → 400).
 */
export function trimTrailingSeparators(dir) {
  return dir.replace(/[\\/]+$/, '');
}

/** Резолв запрошенного пути в файл внутри каталога с защитой от path-traversal. */
export function resolveFsPath(pathname, rootDir) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const rel = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = join(rootDir, rel);
  if (full !== rootDir && !full.startsWith(rootDir + sep)) return null;
  return full;
}

/**
 * Чанки оболочки: Vite кладёт их в `assets/` под именем с хэшем содержимого, поэтому под одним
 * именем содержимое не меняется никогда — браузер вправе не спрашивать о них вовсе.
 */
export const IMMUTABLE_URL_PREFIX = '/assets/';
export const CACHE_REVALIDATE = 'no-cache';
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Метка версии файла — размер и время изменения.
 *
 * Не хэш содержимого: ради него файл пришлось бы прочитать, а метка нужна именно затем, чтобы
 * НЕ читать. Совпадение размера в пределах одной отметки времени у изменившегося файла на
 * нынешних файловых системах не встречается.
 */
export function etagOf(info) {
  return `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
}

/** Заголовок `If-None-Match` называет эту метку: списком, слабой формой или звёздочкой. */
export function matchesEtag(header, etag) {
  if (typeof header !== 'string' || header === '') return false;
  return header
    .split(',')
    .map((item) => item.trim().replace(/^W\//, ''))
    .some((item) => item === '*' || item === etag);
}

/**
 * Отдаёт файл — или «не изменился», если у браузера он уже есть.
 *
 * Оболочка запрашивает файлы плагинов с `cache: 'no-cache'`: каждый запуск спрашивает сервер
 * заново. Без метки версии ответом было полное тело — мегабайты на каждый запуск; с ней тот же
 * вопрос стоит одного `stat` и пустого ответа 304.
 */
export async function sendFile(req, res, filePath, options = {}) {
  const info = await stat(filePath);
  const etag = etagOf(info);
  const headers = {
    ETag: etag,
    'Cache-Control': options.immutable === true ? CACHE_IMMUTABLE : CACHE_REVALIDATE,
  };
  if (matchesEtag(req.headers?.['if-none-match'], etag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const body = await readFile(filePath);
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': body.length });
  res.end(body);
}

/** Отдаёт готовое тело JSON; его всегда переспрашивают. */
export function sendJson(req, res, body) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': CACHE_REVALIDATE,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

/** Короткий текстовый отказ. */
export function sendStatus(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

/**
 * Раздача собранного приложения из каталога: файл по адресу, страница приложения на адрес
 * каталога и на навигационный маршрут.
 *
 * @param {{ rootDir: string, indexHtmlPath: string }} options
 * @returns {(req: unknown, res: unknown, pathname: string) => Promise<void>}
 */
export function createStaticHandler({ rootDir, indexHtmlPath }) {
  return async (req, res, pathname) => {
    const target = resolveFsPath(pathname === '/' ? '/index.html' : pathname, rootDir);
    if (target === null) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    try {
      const info = await stat(target);
      if (info.isDirectory()) {
        const dirIndex = join(target, 'index.html');
        try {
          await stat(dirIndex);
          await sendFile(req, res, dirIndex);
          return;
        } catch {
          await sendFile(req, res, indexHtmlPath);
          return;
        }
      }
      // Навсегда кэшируется только сам файл по адресу с хэшем; `index.html` и всё прочее
      // переспрашиваются каждый раз — иначе новая сборка не доехала бы до человека.
      await sendFile(req, res, target, { immutable: pathname.startsWith(IMMUTABLE_URL_PREFIX) });
    } catch {
      // Файла нет. Реальный отсутствующий ассет (есть расширение) → 404.
      // Навигационный маршрут (без расширения) → SPA-fallback на index.html.
      if (extname(pathname)) {
        sendStatus(res, 404, 'Not Found');
      } else {
        try {
          await sendFile(req, res, indexHtmlPath);
        } catch {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      }
    }
  };
}
