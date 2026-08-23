/**
 * Корпус знаний из `node_modules` ОТКРЫТОГО ПРОЕКТА, а не из сборки билдера.
 *
 * Зачем, если артефакт уже вшит. Вшитый описывает версии, с которыми собран билдер; у
 * пользователя в проекте стоят свои. Разъезд не гипотетический: билдер публикуется отдельно от
 * библиотек и живёт дольше любой их версии, а справка, рассказывающая про API, которого в его
 * `node_modules` нет, хуже отсутствующей — она выглядит достоверно.
 *
 * Именно поэтому MCP-сервер читает индекс У ПАКЕТА, а не из своего `dist`
 * (`core/index/merge.ts`). Здесь то же свойство восстанавливается для браузера: File System
 * Access уже даёт доступ к папке проекта — за схемами форм, — и `node_modules` в ней та же.
 *
 * Всё или ничего по пакетам: берутся ровно те `@reformer/*`, что нашлись в проекте. Смешивать
 * их с вшитыми нельзя — получился бы корпус, которого не существует ни у кого: часть API из
 * одной версии, часть из другой.
 *
 * @module reformer-builder/agent/knowledge/project-source
 */

import { KNOWN_PACKAGES } from '@reformer/mcp/dist/core/docs/packages.js';
import {
  BUNDLE_SCHEMA_VERSION,
  type DocsBundle,
  type IndexBundle,
} from '@reformer/mcp/dist/core/bundle.js';

/** Что нашлось в проекте. `null` — `@reformer/*` там нет вовсе (открыт не тот каталог). */
export interface ProjectBundles {
  index: IndexBundle;
  docs: DocsBundle;
  /** Пакет → версия из найденного индекса. Показывается в ответе: чьи это знания. */
  versions: Record<string, string>;
}

/** Спуститься по пути каталогов; `null` — какого-то звена нет. */
async function dirAt(
  root: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle | null> {
  let cur = root;
  for (const s of segments) {
    try {
      cur = await cur.getDirectoryHandle(s);
    } catch {
      return null;
    }
  }
  return cur;
}

async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(name);
    return await (await handle.getFile()).text();
  } catch {
    return null;
  }
}

/**
 * Прочитать корпус из `node_modules` проекта.
 *
 * Читается один раз на открытую папку — вызывающий обязан кэшировать: это около 2.8 МБ через
 * File System Access, и делать это на каждый вопрос агента незачем.
 */
export async function readProjectBundles(
  root: FileSystemDirectoryHandle
): Promise<ProjectBundles | null> {
  const nodeModules = await dirAt(root, ['node_modules']);
  if (!nodeModules) return null;

  const index: IndexBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const docs: DocsBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const versions: Record<string, string> = {};

  for (const pkg of KNOWN_PACKAGES) {
    // Путь — по ИМЕНИ пакета (`node_modules/@reformer/core`), а не по имени каталога монорепо:
    // у потребителя нет ни `packages/`, ни его раскладки.
    const dir = await dirAt(nodeModules, pkg.split('/'));
    if (!dir) continue;

    const rawIndex = await readText(dir, 'llms-index.json');
    if (!rawIndex) continue;

    try {
      const parsed = JSON.parse(rawIndex);
      index.packages[pkg] = parsed;
      if (typeof parsed?.version === 'string') versions[pkg] = parsed.version;
    } catch {
      // Битый индекс — как отсутствующий: лучше не знать про пакет, чем знать неверно.
      continue;
    }

    const text = await readText(dir, 'llms.txt');
    if (text) docs.packages[pkg] = text;
  }

  return Object.keys(index.packages).length > 0 ? { index, docs, versions } : null;
}
