/**
 * Индекс каталога плагинов приложения: пути всех его файлов от корня каталога.
 *
 * Оболочка читает плагины приложения по HTTP, а «список каталога» по HTTP не спросить —
 * поэтому список файлов приезжает одним файлом, `plugins/index.json`. Строит его этот модуль,
 * один на всех, кто отдаёт плагины приложения: лаунчер (каталог из `--plugins`, на лету),
 * плагин Vite в приложении (`vite/plugin.mjs`, на лету) и сбор для поставки
 * (`scripts/collect-application-plugins.mjs`, файлом в `dist/plugins/`).
 *
 * Раскладку индекс НЕ знает: это плоский список файлов. Что из них плагин, что каталог домена,
 * а что исходники пакета — решает загрузчик оболочки, тот же, что читает каталог проекта.
 * Отфильтровано только то, что загрузчик отбрасывает не глядя:
 *
 * - `node_modules` и имена с точки (`.shared`, `.gitignore`) — иначе индекс живого каталога
 *   разрабатываемых пакетов рос бы на десятки тысяч путей;
 * - подкаталог плагина со своим манифестом — исходники пакета (`src/`) или его сборка для
 *   поставки (`dist/`). Плагину, собранному в корень своего каталога, они не нужны, а у большого
 *   плагина это сотни путей.
 *
 * ## Набор называет тот, кто разворачивает
 *
 * Каталог может нести больше плагинов, чем положено приложению: каталог проекта-образца —
 * все плагины разом, а билдеру, встроенному в приложение, не нужны те, которыми форму рисует
 * он сам. Список `include` оставляет в индексе только названные каталоги плагинов.
 *
 * ## Живой каталог называет ревизии
 *
 * Каталог, собранный для поставки, не меняется, и индекс у него — файл. Живой каталог
 * (`--plugins` лаунчера, плагин Vite над каталогом разрабатываемых плагинов) пересобирают под
 * работающим приложением. Его индекс несёт ещё и РЕВИЗИЮ каждого плагина — отпечаток
 * содержимого его файлов: оболочка перечитывает индекс по возврату фокуса и перезагружает
 * плагины, чья ревизия изменилась (`platform/plugin/application/live`).
 *
 * Отпечаток — по содержимому, а не по времени правки: полная пересборка каталога переписывает
 * каждый файл, и по времени перезагружались бы все плагины разом, хотя поменялся один.
 * Читать содержимое на каждый запрос было бы дорого, поэтому между запросами живёт память
 * ({@link createRevisionMemo}): файл перечитывается, только если изменились его размер или
 * время правки.
 *
 * Zero-dependency и обычным JS: модуль едет в опубликованном пакете рядом с лаунчером.
 *
 * @module bin/plugins-index
 */

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { trimTrailingSeparators } from './static.mjs';

/** Версия формата индекса — та же, что читает оболочка (`platform/plugin/application/files`). */
export const PLUGINS_INDEX_VERSION = 1;

/** Имя файла индекса внутри каталога плагинов. */
export const PLUGINS_INDEX_FILE = 'index.json';

/** Манифест плагина: каталог, в корне которого он лежит, — плагин. */
const MANIFEST_FILE = 'manifest.json';

/** Каталоги, в которые загрузчик не заглядывает. */
const SKIPPED_DIRS = ['node_modules'];

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Сколько знаков отпечатка идёт в индекс: ревизии сравнивают на равенство, а не проверяют. */
const REVISION_LENGTH = 16;

/** Отпечаток файла, которого не оказалось на месте: обход застал пересборку. */
const ABSENT = '-';

/**
 * Память отпечатков файлов живого каталога — одна на каталог, на всё время работы сервера.
 *
 * @returns {Map<string, { size: number, mtimeMs: number, hash: string }>}
 */
export function createRevisionMemo() {
  return new Map();
}

/** Отпечаток содержимого файла; из памяти — пока размер и время правки прежние. */
async function fingerprint(rootDir, path, memo) {
  try {
    const file = join(rootDir, path);
    const { size, mtimeMs } = await stat(file);
    const known = memo.get(path);
    if (known !== undefined && known.size === size && known.mtimeMs === mtimeMs) return known.hash;
    const hash = createHash('sha1')
      .update(await readFile(file))
      .digest('hex');
    memo.set(path, { size, mtimeMs, hash });
    return hash;
  } catch {
    // Файл исчез между обходом и чтением. Ревизия плагина всё равно изменится — следующий
    // обход увидит его уже целым.
    memo.delete(path);
    return ABSENT;
  }
}

/**
 * Ревизии плагинов по списку «плагин → его файлы».
 *
 * @param {string} rootDir
 * @param {ReadonlyMap<string, readonly string[]>} owned
 * @param {Map<string, { size: number, mtimeMs: number, hash: string }>} memo
 * @returns {Promise<Record<string, string>>}
 */
async function revisionsOf(rootDir, owned, memo) {
  const seen = new Set();
  const revisions = {};
  for (const [plugin, paths] of owned) {
    const digest = createHash('sha1');
    for (const path of paths) {
      seen.add(path);
      digest.update(`${path}\0${await fingerprint(rootDir, path, memo)}\n`);
    }
    revisions[plugin] = digest.digest('hex').slice(0, REVISION_LENGTH);
  }
  // Удалённые файлы из памяти уходят: каталог живёт дольше любого из них.
  for (const path of memo.keys()) if (!seen.has(path)) memo.delete(path);
  return revisions;
}

/**
 * Набор плагинов по названному пути: каталог идёт целиком, файл — это список набора.
 *
 * Список (`application-plugins.json`) называет корень каталога плагинов и каталоги плагинов
 * в нём. `root` считается от каталога самого списка: список может лежать где угодно, и «где
 * плагины» он называет относительно себя.
 *
 * Синхронно: набор называют при запуске сервера, и отказ обязан остановить запуск, а не
 * первый запрос.
 *
 * @param {string} target абсолютный путь каталога плагинов либо файла списка
 * @returns {{ dir: string, include?: string[] }} `dir` — без хвостового разделителя
 */
export function resolvePluginsSet(target) {
  if (statSync(target).isDirectory()) return { dir: trimTrailingSeparators(target) };
  const list = JSON.parse(readFileSync(target, 'utf8'));
  if (typeof list?.root !== 'string' || !Array.isArray(list.plugins)) {
    throw new Error(`«${target}» должен называть «root» и список «plugins»`);
  }
  return {
    dir: trimTrailingSeparators(resolve(dirname(target), list.root)),
    include: list.plugins,
  };
}

/** Каталог плагина из списка — без слэшей по краям и с прямым разделителем. */
const normalizeInclude = (path) => path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

/**
 * Лежит ли путь от корня каталога плагинов в одном из названных каталогов.
 *
 * @param {string} path путь с разделителем `/`
 * @param {readonly string[] | undefined} include
 */
export function isIncludedPluginPath(path, include) {
  if (include === undefined) return true;
  return include.some((dir) => {
    const plugin = normalizeInclude(dir);
    return path === plugin || path.startsWith(`${plugin}/`);
  });
}

/**
 * Обходит каталог плагинов: индекс и названные, но не собранные плагины.
 *
 * Каталога нет — пустой индекс, а не отказ: отсутствие плагинов приложения — обычное состояние.
 * Порядок путей детерминирован (по имени): индекс для поставки не должен меняться от прогона
 * к прогону.
 *
 * Плагин для ревизии — каталог, названный в `include`, а без списка — верхний каталог
 * с манифестом. Это тот же каталог, который назовёт плагином загрузчик оболочки; раскладку
 * (плагин верхнего уровня, каталог домена) индекс по-прежнему не знает.
 *
 * @param {string} rootDir каталог плагинов приложения
 * @param {{
 *   include?: readonly string[],
 *   revisions?: Map<string, { size: number, mtimeMs: number, hash: string }>,
 * }} [options] `include` — каталоги плагинов от корня (`base/files`); без него в индекс идёт
 * весь каталог. `revisions` — память отпечатков ({@link createRevisionMemo}): с ней индекс
 * несёт ревизии плагинов, без неё каталог считается неизменным
 * @returns {Promise<{
 *   index: { version: number, files: string[], revisions?: Record<string, string> },
 *   missing: string[],
 * }>} `missing` — каталоги из `include`, в корне которых нет манифеста: плагин не собран
 */
export async function scanPlugins(rootDir, options = {}) {
  const files = [];
  const missing = [];
  /** Плагин → его файлы: из них считается ревизия. */
  const owned = new Map();

  /**
   * @param {string | null} owner плагин, которому принадлежат файлы каталога; `null` — пока
   * ничей (каталог домена)
   * @returns {Promise<boolean>} есть ли в каталоге манифест
   */
  const walk = async (relative, insidePlugin, tolerateAbsent, owner) => {
    let entries;
    try {
      entries = await readdir(join(rootDir, relative), { withFileTypes: true });
    } catch (error) {
      if (tolerateAbsent && error?.code === 'ENOENT') return false;
      throw error;
    }
    const hasManifest = entries.some((entry) => entry.isFile() && entry.name === MANIFEST_FILE);
    // Свой манифест внутри плагина — другое дерево (исходники, сборка для поставки).
    if (insidePlugin && hasManifest) return true;
    const plugin = owner ?? (hasManifest && relative !== '' ? relative : null);
    entries.sort(byName);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.includes(entry.name))
          await walk(path, insidePlugin || hasManifest, false, plugin);
        continue;
      }
      // Сам индекс в себя не попадает: в собранном каталоге он лежит рядом с плагинами.
      if (!entry.isFile() || path === PLUGINS_INDEX_FILE) continue;
      files.push(path);
      if (plugin === null) continue;
      const paths = owned.get(plugin);
      if (paths === undefined) owned.set(plugin, [path]);
      else paths.push(path);
    }
    return hasManifest;
  };

  if (options.include === undefined) {
    await walk('', false, true, null);
  } else {
    const plugins = [...new Set(options.include.map(normalizeInclude))].sort();
    for (const plugin of plugins) {
      // Названный плагин получает ревизию, даже когда файлов у него нет: каталог появится —
      // ревизия изменится, и оболочка поднимет плагин без перезагрузки страницы.
      owned.set(plugin, []);
      // Несобранный плагин в индекс всё равно идёт: оболочка назовёт его в списке плагинов
      // с причиной. Здесь он запоминается, чтобы о нём сказал и сервер.
      if (!(await walk(plugin, false, true, plugin))) missing.push(plugin);
    }
  }
  const index = { version: PLUGINS_INDEX_VERSION, files };
  if (options.revisions !== undefined) {
    index.revisions = await revisionsOf(rootDir, owned, options.revisions);
  }
  return { index, missing };
}

/**
 * Индекс каталога плагинов — см. {@link scanPlugins}.
 *
 * @param {string} rootDir каталог плагинов приложения
 * @param {Parameters<typeof scanPlugins>[1]} [options]
 * @returns {Promise<{ version: number, files: string[], revisions?: Record<string, string> }>}
 */
export async function buildPluginsIndex(rootDir, options = {}) {
  return (await scanPlugins(rootDir, options)).index;
}
