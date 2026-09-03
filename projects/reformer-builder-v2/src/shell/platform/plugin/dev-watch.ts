/**
 * Наблюдатель за плагинами «в разработке»: правка файлов — перезагрузка без команды.
 *
 * File System Access наблюдения за файлами не даёт, и решение «не заводить ни опроса,
 * ни локального процесса» здесь не пересматривается. Вместо наблюдения — два события,
 * которые у приложения уже есть:
 *
 * - **сохранение из встроенного редактора** — пакет {@link WorkspaceDidChange} с типом
 *   `saved`: файл только что уехал в источник, и загрузчик прочитает его новым;
 * - **возврат фокуса в окно** — тот же жест, которым рабочая область ловит расхождение
 *   открытых документов (`../workspace/merge/divergence`): человек уходил в другой
 *   инструмент — почти всегда править файлы. По возврату сверяются ревизии `stat`
 *   всех файлов наблюдаемых плагинов со снимком, сделанным при прошлой загрузке.
 *
 * ## Кого наблюдаем
 *
 * Только помеченных {@link ProjectPluginCatalog.setDev} — и только в состояниях `enabled`
 * и `failed`. Включённый перезагружается ({@link ProjectPluginCatalog.reload}); упавший
 * ПОДНИМАЕТСЯ заново ({@link ProjectPluginCatalog.enable}) — включённость с него снимала
 * машина из-за ошибки, а не человек, и правка файла — ровно тот повторный жест, которого
 * каталог ждёт. Выключенного человеком не трогаем: `dev` — не второй способ сказать «включи».
 *
 * Это не противоречит правилу «упавший при активации не поднимается сам»: то правило — про
 * автоповтор при ЗАПУСКЕ, превращающий сломанный плагин в невыключаемый. Здесь повтор
 * происходит только в ответ на ИЗМЕНЕНИЕ файлов, то есть на действие человека.
 *
 * ## Почему снимок ревизий, а не время
 *
 * Ревизия источника — непрозрачный маркер, сравнимый только на равенство (контракт Source).
 * Снимок делается после каждой (пере)загрузки и после смены проекта; расхождение хотя бы
 * одного файла — сигнал перезагрузить. Сравнение «новее» не вычисляется никогда.
 *
 * @module shell/platform/plugin/dev-watch
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import { parseResourceId } from '@/shell/platform/primitives/resource';
import type { EventBus } from '@/shell/platform/primitives/event';
import type { Source } from '@/shell/platform/source/types';
import { WorkspaceDidChange } from '@/shell/platform/workspace/workspace';
import { PLUGIN_CATALOG_DIR } from './loader';
import type { ProjectPluginCatalog, ProjectPluginEntry } from './catalog';

/** Как часто разрешено проверять по фокусу. То же значение, что у расхождения документов. */
const DEFAULT_FOCUS_INTERVAL_MS = 1000;

/**
 * Потолок файлов на снимок одного плагина.
 *
 * Выше лимита загрузчика (200 файлов КОДА): снимок считает все файлы, включая манифест,
 * стили и словари. Перебор сверх потолка молча отбрасывается — каталог такого размера
 * загрузчик всё равно отвергнет, а наблюдателю важно не зависнуть на чужом дереве.
 */
const DEFAULT_STAT_LIMIT = 300;

interface ListenerTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface PluginDevWatchDeps {
  readonly catalog: Pick<ProjectPluginCatalog, 'list' | 'subscribe' | 'reload' | 'enable'>;
  /** Источник открытого проекта. `null` — проекта нет, наблюдать нечего. */
  readonly source: () => Source | null;
  /** Шина приложения: по ней приходит `WorkspaceDidChange` (сохранение из редактора). */
  readonly events?: Pick<EventBus, 'on'>;
  /** Окно и документ для событий фокуса. Без них работает только триггер сохранения. */
  readonly window?: ListenerTarget;
  readonly document?: ListenerTarget & { visibilityState?: string };
  /** Каталог плагинов в проекте. Параметр — ради тестов, как у загрузчика. */
  readonly dir?: string;
  readonly minIntervalMs?: number;
  readonly statLimit?: number;
  readonly now?: () => number;
}

/** Снимок помнит, у КАКОГО источника снят: смена проекта делает его недействительным. */
interface Snapshot {
  readonly source: Source;
  readonly revisions: ReadonlyMap<string, string | undefined>;
}

const watched = (entry: ProjectPluginEntry): boolean =>
  entry.dev && (entry.state === 'enabled' || entry.state === 'failed');

export function createPluginDevWatch(deps: PluginDevWatchDeps): Disposable {
  const dir = deps.dir ?? PLUGIN_CATALOG_DIR;
  const interval = deps.minIntervalMs ?? DEFAULT_FOCUS_INTERVAL_MS;
  const statLimit = deps.statLimit ?? DEFAULT_STAT_LIMIT;
  const now = deps.now ?? ((): number => Date.now());

  const snapshots = new Map<string, Snapshot>();
  /**
   * Снимки, которые уже делаются. Заказ у ТОГО ЖЕ источника переиспользует работу; заказ
   * у другого (проект сменился, пока снимали) — встаёт в цепочку следом. Без привязки
   * к источнику повторный заказ вернул бы чужой снимок, и смена проекта осталась бы
   * с ревизиями прежнего.
   */
  const capturing = new Map<string, { source: Source; job: Promise<void> }>();
  /** Перезагрузки в полёте: `true` — за время работы пришёл ещё один повод. */
  const reloading = new Map<string, boolean>();
  let disposed = false;

  /**
   * Обходит каталог плагина и снимает ревизии всех файлов.
   *
   * Все файлы, а не только код: манифест, стили и словари меняют плагин так же, как `main.ts`.
   * Порядок обхода детерминирован сортировкой — источник не обещает порядка листинга.
   */
  const readRevisions = async (
    source: Source,
    pluginId: string
  ): Promise<ReadonlyMap<string, string | undefined> | null> => {
    const revisions = new Map<string, string | undefined>();
    const queue: string[] = [''];
    try {
      while (queue.length > 0) {
        const relative = queue.shift() as string;
        const base = relative === '' ? `${dir}/${pluginId}` : `${dir}/${pluginId}/${relative}`;
        const entries = [...(await source.list(base))].sort((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        );
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
          if (entry.kind === 'directory') {
            if (entry.name === 'node_modules') continue;
            queue.push(path);
            continue;
          }
          if (revisions.size >= statLimit) return revisions;
          const stat = await source.stat(`${dir}/${pluginId}/${path}`);
          revisions.set(path, stat?.revision);
        }
      }
    } catch {
      // Каталога больше нет или источник закрылся: снимка нет, решает следующий обход.
      return null;
    }
    return revisions;
  };

  const sameRevisions = (
    a: ReadonlyMap<string, string | undefined>,
    b: ReadonlyMap<string, string | undefined>
  ): boolean => {
    if (a.size !== b.size) return false;
    for (const [path, revision] of a) {
      if (!b.has(path) || b.get(path) !== revision) return false;
    }
    return true;
  };

  const capture = (pluginId: string): Promise<void> => {
    const source = deps.source();
    if (source === null) return Promise.resolve();
    const existing = capturing.get(pluginId);
    if (existing?.source === source) return existing.job;
    const job = (existing?.job ?? Promise.resolve())
      .then(() => readRevisions(source, pluginId))
      .then((revisions) => {
        if (disposed) return;
        // Пока снимали, источник мог смениться ещё раз: устаревший снимок не записывается —
        // его перезапишет тот, кто стоит в цепочке следом.
        if (deps.source() !== source) return;
        if (revisions === null) snapshots.delete(pluginId);
        else snapshots.set(pluginId, { source, revisions });
      })
      .finally(() => {
        if (capturing.get(pluginId)?.job === job) capturing.delete(pluginId);
      });
    capturing.set(pluginId, { source, job });
    return job;
  };

  /**
   * Перезагрузка с коалесценцией: поводы, пришедшие во время работы, схлопываются в один
   * повторный заход. Снимок обновляется ПОСЛЕ каждой попытки — и удачной, и неудачной:
   * иначе неисправленный файл поднимал бы перезагрузку на каждый возврат фокуса.
   */
  const requestReload = (pluginId: string): void => {
    if (reloading.has(pluginId)) {
      reloading.set(pluginId, true);
      return;
    }
    reloading.set(pluginId, false);
    const run = async (): Promise<void> => {
      do {
        reloading.set(pluginId, false);
        const entry = deps.catalog.list().find((item) => item.id === pluginId);
        if (entry === undefined || !watched(entry)) break;
        // Упавшего каталог перезагрузкой не включает — его поднимает `enable`, тем же жестом,
        // которым это сделал бы человек из палитры.
        if (entry.state === 'failed') await deps.catalog.enable(pluginId);
        else await deps.catalog.reload(pluginId);
        await capture(pluginId);
      } while (reloading.get(pluginId) === true && !disposed);
      reloading.delete(pluginId);
    };
    void run().catch((error: unknown) => {
      reloading.delete(pluginId);
      console.error(`[plugins] авто-перезагрузка «${pluginId}» не удалась`, error);
    });
  };

  /** Сверяет наблюдаемых со снимками. Совпадающие обходы схлопываются, как у расхождения. */
  let checking: Promise<void> | null = null;
  const check = (): Promise<void> => {
    if (checking !== null) return checking;
    const source = deps.source();
    const ids = deps.catalog
      .list()
      .filter(watched)
      .map((entry) => entry.id);
    if (source === null || ids.length === 0) return Promise.resolve();
    checking = Promise.all(
      ids.map(async (pluginId) => {
        const snapshot = snapshots.get(pluginId);
        if (snapshot === undefined || snapshot.source !== source) {
          // Базы для сравнения нет (плагин только что стал наблюдаемым или проект сменился):
          // этот обход только снимает базу, перезагружать не с чем сравнивать.
          await capture(pluginId);
          return;
        }
        const current = await readRevisions(source, pluginId);
        if (current === null || disposed) return;
        if (!sameRevisions(snapshot.revisions, current)) requestReload(pluginId);
      })
    )
      .then(() => undefined)
      .finally(() => {
        checking = null;
      });
    return checking;
  };

  // ── Триггер: возврат фокуса ────────────────────────────────────────────────────────────
  let lastCheck = Number.NEGATIVE_INFINITY;
  const onFocus = (): void => {
    const at = now();
    if (at - lastCheck < interval) return;
    lastCheck = at;
    void check();
  };
  const onVisible = (): void => {
    if (deps.document?.visibilityState === 'hidden') return;
    onFocus();
  };
  deps.window?.addEventListener('focus', onFocus);
  deps.document?.addEventListener('visibilitychange', onVisible);

  // ── Триггер: сохранение из встроенного редактора ──────────────────────────────────────
  const prefix = `${dir}/`;
  const savesSubscription = deps.events?.on(WorkspaceDidChange, (event) => {
    const touched = new Set<string>();
    for (const change of event.changes) {
      if (change.type !== 'saved') continue;
      let path: string;
      try {
        path = parseResourceId(change.id).path;
      } catch {
        continue;
      }
      if (!path.startsWith(prefix)) continue;
      const pluginId = path.slice(prefix.length).split('/')[0];
      if (pluginId !== undefined && pluginId !== '') touched.add(pluginId);
    }
    if (touched.size === 0) return;
    const entries = deps.catalog.list();
    for (const pluginId of touched) {
      const entry = entries.find((item) => item.id === pluginId);
      if (entry !== undefined && watched(entry)) requestReload(pluginId);
    }
  });

  // ── Снимки следуют за списком: пометили или включили — снята база, сняли — забыта ─────
  const syncSnapshots = (): void => {
    const current = new Set<string>();
    for (const entry of deps.catalog.list()) {
      if (!watched(entry)) continue;
      current.add(entry.id);
      const snapshot = snapshots.get(entry.id);
      if (snapshot === undefined || snapshot.source !== deps.source()) void capture(entry.id);
    }
    for (const pluginId of [...snapshots.keys()]) {
      if (!current.has(pluginId)) snapshots.delete(pluginId);
    }
  };
  const catalogSubscription = deps.catalog.subscribe(syncSnapshots);
  syncSnapshots();

  return toDisposable(() => {
    disposed = true;
    deps.window?.removeEventListener('focus', onFocus);
    deps.document?.removeEventListener('visibilitychange', onVisible);
    savesSubscription?.dispose();
    catalogSubscription.dispose();
    snapshots.clear();
    reloading.clear();
  });
}
