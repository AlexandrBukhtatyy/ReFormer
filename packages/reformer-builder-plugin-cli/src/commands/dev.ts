/**
 * `reformer-plugin dev --project <каталог>`: сборка прямо в каталог плагинов открытого проекта
 * и пересборка на каждое сохранение.
 *
 * Пишет в `<проект>/.ui_builder/plugins/<id>/` — туда, где загрузчик оболочки плагин и найдёт.
 * Отдельного подкаталога «для разработки» нет: загрузчик считает плагином каждый
 * подкаталог каталога плагинов, и `development/` стал бы плагином с именем `development`.
 *
 * Перезагрузку делает оболочка, а не CLI: плагин, помеченный в списке «в разработке», перечитывается
 * при возврате фокуса в окно (`shell/platform/plugin/dev-watch`). Так правка во внешнем редакторе
 * доходит до билдера без канала между ними — File System Access наблюдать за файлами не даёт.
 *
 * Наблюдение — `fs.watch` с `recursive`, поэтому Node не ниже 20. Каталоги `node_modules`, вывода
 * и скрытые не наблюдаются: сборка сама пишет файлы, и реакция на свою же запись зациклила бы её.
 *
 * @module @reformer/builder-plugin-cli/commands/dev
 */

import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import { PLUGIN_CATALOG_DIR, PLUGIN_MANIFEST_FILE } from '@reformer/builder-plugin-api/tooling';

import { buildPlugin, type BuildResult } from './build.js';

export interface DevOptions {
  /** Каталог исходников плагина. */
  readonly dir: string;
  /** Корень проекта билдера, в котором плагин будет подхвачен. */
  readonly project: string;
  /** Пауза после последнего изменения перед пересборкой, мс. */
  readonly debounceMs?: number;
  /** Вызывается после каждой сборки, первой — сразу. */
  readonly onBuild: (result: BuildResult) => void;
}

export interface DevSession {
  /** Первая сборка: завершается, когда её результат уже отдан в `onBuild`. */
  readonly ready: Promise<void>;
  close(): void;
}

const IGNORED = new Set(['node_modules', 'dist']);

/** Каталог вывода для плагина в проекте. `id` читается из манифеста на каждой сборке. */
async function outDirFor(dir: string, project: string): Promise<string | undefined> {
  try {
    const text = await readFile(join(dir, PLUGIN_MANIFEST_FILE), 'utf8');
    const id = (JSON.parse(text) as { id?: unknown }).id;
    return typeof id === 'string' && id !== '' ? join(project, PLUGIN_CATALOG_DIR, id) : undefined;
  } catch {
    return undefined;
  }
}

export function startDev(options: DevOptions): DevSession {
  const dir = resolve(options.dir);
  const project = resolve(options.project);
  const debounceMs = options.debounceMs ?? 100;

  let running: Promise<void> = Promise.resolve();
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  // Сборки строго по одной: изменение во время сборки не теряется, а откладывает ещё одну.
  const rebuild = (): Promise<void> => {
    if (pending) return running;
    pending = true;
    running = running.then(async () => {
      pending = false;
      if (closed) return;
      // Без манифеста (или без id) каталог вывода не вычислить — сборка сама объяснит почему.
      const outDir = (await outDirFor(dir, project)) ?? join(dir, 'dist');
      options.onBuild(await buildPlugin({ dir, outDir }));
    });
    return running;
  };

  const ready = rebuild();

  const watcher: FSWatcher = watch(dir, { recursive: true }, (_, filename) => {
    if (filename === null) return;
    const first = filename.split(sep)[0] ?? '';
    if (first.startsWith('.') || IGNORED.has(first)) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), debounceMs);
  });

  return {
    ready,
    close() {
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      watcher.close();
    },
  };
}
