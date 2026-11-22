/**
 * Индекс файлов источника — для поиска в пикере вложений ассистента.
 *
 * Пикер ищет по имени на каждую букву, а служба источника отдаёт каталог по уровню: без индекса
 * каждый запрос обходил бы проект заново. Индекс строится одним обходом в ширину, с потолком
 * записей и глубины, и не заходит в зависимости, сборку и скрытые каталоги — там человек файлы
 * для ассистента не ищет, а обход их стоил бы больше всего проекта.
 *
 * Устаревает индекс по трём поводам: сменился проект, рабочая копия сообщила о записи (так
 * обычно появляются новые файлы) и прошло время — папку на диске правят и мимо билдера, а
 * следить за ней File System Access не умеет.
 *
 * @module plugins/base/files/assistant/source-index
 */

import type {
  AssistantResourceEntry,
  Disposable,
  ResourceId,
  WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import { idOfPath, type SourceAccess } from './source-errors';
import { baseName, deniedReason, dirName, skippedInWalk, uriOfPath } from './source-uri';

/** Сколько найденного отдавать пикеру. */
const SEARCH_LIMIT = 20;

export interface SourceIndexOptions {
  readonly access: SourceAccess;
  /** Сообщения рабочей копии о записях — повод перестроить индекс. */
  readonly changes?: Pick<WorkspaceFilesService, 'onDidChange'>;
  /** Сколько индекс живёт без повода, мс. */
  readonly ttlMs?: number;
  /** Потолок файлов индекса. */
  readonly limit?: number;
  /** Потолок глубины обхода. */
  readonly depth?: number;
  /** Часы — подменяются в тестах. */
  readonly now?: () => number;
}

export interface SourceIndex extends Disposable {
  /** Файлы, похожие на запрос; пустой запрос — файлы верхних уровней. */
  search(query: string, signal: AbortSignal): Promise<readonly AssistantResourceEntry[]>;
  /** Забыть построенное: следующий поиск обойдёт проект заново. */
  invalidate(): void;
}

interface Built {
  readonly root: ResourceId;
  readonly at: number;
  readonly paths: readonly string[];
}

export function createSourceIndex(options: SourceIndexOptions): SourceIndex {
  const { access } = options;
  const ttl = options.ttlMs ?? 30_000;
  const limit = options.limit ?? 5000;
  const maxDepth = options.depth ?? 8;
  const now = options.now ?? Date.now;

  let built: Built | null = null;
  let building: Promise<Built | null> | null = null;

  /**
   * Обход в ширину: файлы ближе к корню находятся раньше, и потолок срезает глубину, а не
   * половину верхнего уровня. Каталог, который не прочитался, пропускается — индекс неполон,
   * но поиск по остальному работает.
   */
  const build = async (root: ResourceId, signal: AbortSignal): Promise<Built> => {
    const paths: string[] = [];
    const queue: { readonly path: string; readonly depth: number }[] = [{ path: '', depth: 0 }];
    while (queue.length > 0 && paths.length < limit && !signal.aborted) {
      const dir = queue.shift();
      if (dir === undefined) break;
      const id = idOfPath(access, dir.path);
      if (id === null) break;
      const listed = await access.source.list(id, { signal });
      if (!listed.ok) continue;
      for (const ref of listed.value) {
        if (ref.kind === 'directory') {
          if (dir.depth + 1 < maxDepth && !skippedInWalk(ref.name)) {
            queue.push({ path: ref.path, depth: dir.depth + 1 });
          }
        } else if (deniedReason(ref.path) === null && paths.length < limit) {
          paths.push(ref.path);
        }
      }
    }
    return { root, at: now(), paths };
  };

  const current = (signal: AbortSignal): Promise<Built | null> => {
    const root = access.files.projectRoot();
    if (root === null) return Promise.resolve(null);
    if (built !== null && built.root === root && now() - built.at < ttl) {
      return Promise.resolve(built);
    }
    // Параллельные запросы ждут один обход, а не заводят по своему.
    building ??= build(root, signal).then(
      (result) => {
        building = null;
        // Обход, прерванный остановкой, неполон — запоминать его нельзя.
        if (!signal.aborted) built = result;
        return result;
      },
      (error: unknown) => {
        building = null;
        throw error;
      }
    );
    return building;
  };

  const subscription = options.changes?.onDidChange(() => {
    built = null;
  });

  return {
    async search(query, signal) {
      const index = await current(signal);
      if (index === null) return [];
      const wanted = query.trim().toLowerCase();
      const ranked =
        wanted === ''
          ? [...index.paths].sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b))
          : index.paths
              .map((path) => ({ path, score: scoreOf(path.toLowerCase(), wanted) }))
              .filter((entry) => entry.score !== null)
              .sort(
                (a, b) =>
                  (a.score ?? 0) - (b.score ?? 0) ||
                  a.path.length - b.path.length ||
                  a.path.localeCompare(b.path)
              )
              .map((entry) => entry.path);
      return ranked.slice(0, SEARCH_LIMIT).map((path) => ({
        uri: uriOfPath(path),
        name: baseName(path),
        ...(dirName(path) !== '' ? { description: dirName(path) } : {}),
      }));
    },
    invalidate() {
      built = null;
    },
    dispose() {
      subscription?.dispose();
    },
  };
}

/** Глубина пути: сколько каталогов над файлом. */
function depthOf(path: string): number {
  return path.split('/').length;
}

/**
 * Насколько путь подходит под запрос: меньше — лучше, `null` — не подходит. Начало имени файла
 * важнее вхождения в имя, вхождение в имя — важнее вхождения в путь, а буквы запроса по порядку
 * где-то в пути — последний шанс опечатке.
 */
function scoreOf(path: string, wanted: string): number | null {
  const name = baseName(path);
  if (name.startsWith(wanted)) return 0;
  if (name.includes(wanted)) return 1;
  if (path.includes(wanted)) return 2;
  let at = 0;
  for (const char of path) {
    if (char === wanted[at]) at += 1;
    if (at === wanted.length) return 3;
  }
  return null;
}
