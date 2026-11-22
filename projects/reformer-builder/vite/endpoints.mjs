/**
 * Адреса билдера на dev-сервере приложения — решение «кто отвечает на запрос», без Vite.
 *
 * Билдер, встроенный в приложение, живёт под одним префиксом его dev-сервера. Под ним три
 * вещи, и у каждой свой источник:
 *
 * ```text
 * /__reformer-builder/runtime.json   конфиг запуска из каталога приложения
 * /__reformer-builder/plugins/*      плагины приложения: индекс на лету и файлы с диска
 * /__reformer-builder/*              интерфейс билдера — исходники или готовая сборка
 * ```
 *
 * Обработчик стоит ПЕРЕД собственными прослойками dev-сервера и отвечает только на адреса
 * с префиксом; остальное — приложение. Модуль чистый: чтение конфига и раздача интерфейса
 * приходят параметрами, поэтому проверяется он поддельными запросом и ответом.
 *
 * Обычным JS и без зависимостей, как лаунчер: его грузит `vite.config` приложения.
 *
 * @module vite/endpoints
 */

import { servePluginsDir } from '../bin/plugins-serve.mjs';
import { RUNTIME_BUNDLE_URL, runtimeBundleBody } from '../bin/runtime-bundle.mjs';
import { sendJson } from '../bin/static.mjs';

/** Префикс билдера на dev-сервере приложения — тот же, под которым SPA ищет конфиг запуска. */
export const BUILDER_URL_PREFIX = '/__reformer-builder/';

/** Каталог плагинов приложения под префиксом — `plugins/` от базового адреса сборки. */
const PLUGINS_URL = `${BUILDER_URL_PREFIX}plugins/`;

/** Адрес без хвостового слэша: от него не разрешаются относительные пути сборки. */
const BARE_PREFIX = BUILDER_URL_PREFIX.slice(0, -1);

/**
 * Что сервер сообщает оболочке о себе сверх конфига.
 *
 * `embedded` — билдер открыт рядом с приложением и делит с ним источник: оболочка не вправе
 * сносить хранилище источника и знает, что рядом есть приложение для превью. Признак ставит
 * сервер, а не страница: по тому, в рамке ли документ, судить нельзя — тот же адрес можно
 * открыть вкладкой.
 */
const SERVER_FACTS = Object.freeze({ embedded: true });

/**
 * @param {{
 *   readConfig: () => Promise<unknown>,
 *   plugins: {
 *     dir: string,
 *     include?: readonly string[],
 *     revisions?: Map<string, { size: number, mtimeMs: number, hash: string }>,
 *   } | null,
 *   onMissingPlugins?: (plugins: readonly string[]) => void,
 *   ui: (req: unknown, res: unknown, next: (error?: unknown) => void) => void,
 * }} options
 * `readConfig` — конфиг запуска либо `null`; `plugins` — каталог плагинов приложения на
 * диске (с `revisions` — живой: индекс несёт ревизии плагинов), `null` — плагины лежат внутри
 * того, что отдаёт `ui`; `ui` — интерфейс билдера.
 * @returns {(req: any, res: any, next: (error?: unknown) => void) => void}
 */
export function createBuilderEndpoints(options) {
  const respond = async (req, res, next) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0].split('#')[0];

    if (pathname === BARE_PREFIX) {
      res.writeHead(302, { Location: BUILDER_URL_PREFIX + url.slice(BARE_PREFIX.length) });
      res.end();
      return;
    }
    if (!pathname.startsWith(BUILDER_URL_PREFIX)) {
      next();
      return;
    }

    const readOnly = req.method === 'GET' || req.method === 'HEAD';
    if (pathname === RUNTIME_BUNDLE_URL) {
      if (!readOnly) return methodNotAllowed(res);
      sendJson(req, res, runtimeBundleBody(await options.readConfig(), SERVER_FACTS));
      return;
    }
    if (options.plugins !== null && pathname.startsWith(PLUGINS_URL)) {
      if (!readOnly) return methodNotAllowed(res);
      await servePluginsDir(req, res, pathname.slice(PLUGINS_URL.length), {
        dir: options.plugins.dir,
        include: options.plugins.include,
        revisions: options.plugins.revisions,
        onMissing: options.onMissingPlugins,
      });
      return;
    }
    options.ui(req, res, next);
  };

  return (req, res, next) => {
    respond(req, res, next).catch(next);
  };
}

function methodNotAllowed(res) {
  res.writeHead(405, { Allow: 'GET, HEAD' });
  res.end('Method Not Allowed');
}
