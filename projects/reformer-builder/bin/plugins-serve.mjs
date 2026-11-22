/**
 * Раздача каталога плагинов приложения с диска: индекс на лету и файлы по адресу.
 *
 * Так плагины отдают те, у кого каталог лежит на диске: лаунчер с флагом `--plugins` и плагин
 * Vite в приложении. Индекс строится на каждый запрос — набор плагинов меняют, не перезапуская
 * сервер. С памятью отпечатков (`revisions`) индекс несёт ещё и ревизии плагинов: по ним
 * оболочка перезагружает пересобранный плагин сама, по возврату фокуса; без неё свежая сборка
 * видна после перезагрузки страницы.
 *
 * Zero-dependency и обычным JS: модуль едет в опубликованном пакете рядом с лаунчером.
 *
 * @module bin/plugins-serve
 */

import { stat } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { isIncludedPluginPath, PLUGINS_INDEX_FILE, scanPlugins } from './plugins-index.mjs';
import { resolveFsPath, sendFile, sendJson, sendStatus } from './static.mjs';

/**
 * Адрес каталога плагинов приложения (каталог — APPLICATION_ROOT_DIR из
 * shell/platform/plugin/application/files): SPA читает оттуда индекс и файлы плагинов.
 */
export const PLUGINS_URL_PREFIX = '/plugins/';

/**
 * Отвечает на запрос внутри каталога плагинов.
 *
 * Отсутствующий файл — честный 404 без SPA-fallback: страница приложения вместо кода плагина
 * исполнилась бы как код и упала бы невнятной синтаксической ошибкой.
 *
 * @param {unknown} req
 * @param {unknown} res
 * @param {string} inside путь внутри каталога плагинов, без ведущего слэша
 * @param {{
 *   dir: string,
 *   include?: readonly string[],
 *   revisions?: Map<string, { size: number, mtimeMs: number, hash: string }>,
 *   onMissing?: (plugins: readonly string[]) => void,
 * }} options `dir` — каталог без хвостового разделителя; `include` — каталоги плагинов,
 * которые отдаются; `revisions` — память отпечатков живого каталога (`createRevisionMemo`);
 * `onMissing` — названные, но не собранные плагины (на каждый запрос индекса)
 */
export async function servePluginsDir(req, res, inside, options) {
  if (inside === PLUGINS_INDEX_FILE) {
    const { index, missing } = await scanPlugins(options.dir, {
      include: options.include,
      revisions: options.revisions,
    });
    if (missing.length > 0) options.onMissing?.(missing);
    sendJson(req, res, Buffer.from(JSON.stringify(index)));
    return;
  }
  const target = resolveFsPath(inside, options.dir);
  if (target === null) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  // Чего нет в индексе, того нет и по адресу: набор плагинов — одно решение, а не два.
  // Сверяется уже разрешённый путь: адрес с `..` внутри каталога плагинов набор не обходит.
  const resolved = relative(options.dir, target).split(sep).join('/');
  if (!isIncludedPluginPath(resolved, options.include)) {
    sendStatus(res, 404, 'Not Found');
    return;
  }
  try {
    if (!(await stat(target)).isFile()) throw new Error('не файл');
    await sendFile(req, res, target);
  } catch {
    sendStatus(res, 404, 'Not Found');
  }
}
