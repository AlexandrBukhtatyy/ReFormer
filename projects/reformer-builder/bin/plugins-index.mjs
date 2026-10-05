/**
 * Индекс каталога плагинов приложения: пути всех его файлов от корня каталога.
 *
 * Оболочка читает плагины приложения по HTTP, а «список каталога» по HTTP не спросить —
 * поэтому список файлов приезжает одним файлом, `plugins/index.json`. Строит его этот модуль,
 * один на всех, кто отдаёт плагины приложения: лаунчер (каталог из `--plugins`, на лету)
 * и сбор для поставки (`scripts/collect-application-plugins.mjs`, файлом в `dist/plugins/`).
 *
 * Раскладку индекс НЕ знает: это плоский список файлов. Что из них плагин, что каталог домена,
 * а что исходники пакета — решает загрузчик оболочки, тот же, что читает каталог проекта.
 * Отфильтровано только то, что загрузчик отбрасывает не глядя: `node_modules` и имена
 * с точки (`.shared`, `.gitignore`) — иначе индекс живого каталога разрабатываемых пакетов
 * рос бы на десятки тысяч путей.
 *
 * Zero-dependency и обычным JS: модуль едет в опубликованном пакете рядом с лаунчером.
 *
 * @module bin/plugins-index
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Версия формата индекса — та же, что читает оболочка (`platform/plugin/application/files`). */
export const PLUGINS_INDEX_VERSION = 1;

/** Имя файла индекса внутри каталога плагинов. */
export const PLUGINS_INDEX_FILE = 'index.json';

/** Каталоги, в которые загрузчик не заглядывает. */
const SKIPPED_DIRS = ['node_modules'];

/**
 * Обходит каталог плагинов и собирает индекс.
 *
 * Каталога нет — пустой индекс, а не отказ: отсутствие плагинов приложения — обычное состояние.
 * Порядок путей детерминирован (по имени): индекс для поставки не должен меняться от прогона
 * к прогону.
 *
 * @param {string} rootDir каталог плагинов приложения
 * @returns {Promise<{ version: number, files: string[] }>}
 */
export async function buildPluginsIndex(rootDir) {
  const files = [];
  const walk = async (relative) => {
    let entries;
    try {
      entries = await readdir(join(rootDir, relative), { withFileTypes: true });
    } catch (error) {
      if (relative === '' && error?.code === 'ENOENT') return;
      throw error;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.includes(entry.name)) await walk(path);
        continue;
      }
      // Сам индекс в себя не попадает: в собранном каталоге он лежит рядом с плагинами.
      if (entry.isFile() && path !== PLUGINS_INDEX_FILE) files.push(path);
    }
  };
  await walk('');
  return { version: PLUGINS_INDEX_VERSION, files };
}
