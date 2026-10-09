/**
 * Наблюдатель за ЖИВЫМ каталогом плагинов приложения: плагин пересобрали — он перезагружен.
 *
 * Слой приложения обычно неизменен: его положили рядом со сборкой, и наблюдать там нечего.
 * Но каталог бывает живым — каталог разрабатываемых плагинов, который сервер отдаёт с диска.
 * Так устроен билдер, встроенный в приложение внутри монорепозитория: стандартные плагины он
 * берёт из каталога проекта-образца, и их автор правит их там же. Без наблюдателя каждая
 * пересборка требовала бы перезагрузки страницы — того, от чего плагины проекта «в разработке»
 * давно избавлены (`../dev-watch`).
 *
 * ## Чем это не `dev-watch`
 *
 * Тот наблюдает файлы источника проекта: у него есть `stat` и ревизии каждого файла. У слоя
 * приложения источника нет — есть индекс по HTTP. Поэтому ревизии считает сервер, по одной
 * на плагин, и кладёт их в индекс; наблюдателю остаётся перечитать индекс и сравнить.
 * Пометок «в разработке» у слоя тоже нет: живой каталог наблюдается целиком — его и отдают
 * затем, чтобы править.
 *
 * ## Когда проверяем
 *
 * По возврату фокуса в окно — тем же жестом, что `dev-watch` и расхождение документов: человек
 * уходил в другой инструмент, почти всегда — править файлы и пересобирать.
 *
 * ## Что делаем с изменившимся
 *
 * Работающий перезагружается, упавший и только что появившийся — поднимаются. Упавший
 * поднимается намеренно: частый случай — проверка попала на середину пересборки, файлы были
 * неполными; следующая проверка увидит новую ревизию и поправит это сама.
 *
 * Источник файлов подменяется ЦЕЛИКОМ и до перечитывания каталога: список файлов у нового
 * индекса свой (у сборки на месте имена отложенных модулей несут хэш), и загрузчик обязан
 * читать уже по нему.
 *
 * ## Чего это стоит слою
 *
 * Плагины приложения читаются по графу сборки: точка входа сразу, остальное — по отложенному
 * импорту. Это опирается на то, что файлы под работающим плагином не меняются, а у живого
 * каталога они меняются. Между пересборкой и перезагрузкой плагин может попросить модуль,
 * которого на диске уже нет, — и получит обычный отказ отложенного импорта. Окно узкое:
 * перезагрузка приходит с возвратом фокуса, раньше первого жеста. Чтобы оно не открывалось
 * заново, отложенный код перезагруженных плагинов дочитывается сразу, а не по требованию.
 *
 * @module shell/platform/plugin/application/live
 */

import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import type { ProjectPluginCatalog } from '../catalog';
import { APPLICATION_ROOT_DIR, type ApplicationFilesSource } from './files';

/** Как часто разрешено проверять по фокусу. То же значение, что у плагинов проекта. */
const DEFAULT_FOCUS_INTERVAL_MS = 1000;

interface ListenerTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface ApplicationPluginsWatchDeps {
  /** Слой, по которому сейчас читает загрузчик; `null` — слоя нет. */
  readonly current: () => ApplicationFilesSource | null;
  /** Перечитывает индекс слоя. `null` — слой исчез либо сервер недоступен. */
  readonly load: () => Promise<ApplicationFilesSource | null>;
  /** Подменяет слой у загрузчика. */
  readonly replace: (files: ApplicationFilesSource) => void;
  readonly catalog: Pick<
    ProjectPluginCatalog,
    'list' | 'refresh' | 'reload' | 'enable' | 'preloadDeferred'
  >;
  /** Окно и документ для событий фокуса. Без них наблюдатель ничего не делает. */
  readonly window?: ListenerTarget;
  readonly document?: ListenerTarget & { visibilityState?: string };
  readonly minIntervalMs?: number;
  readonly now?: () => number;
}

export interface ApplicationPluginsWatch extends Disposable {
  /** Проверить сейчас, мимо событий фокуса и их троттлинга. Для тестов и ручного жеста. */
  check(): Promise<void>;
}

/** Каталоги плагинов, чья ревизия разошлась: изменившиеся, появившиеся и исчезнувшие. */
function changedDirs(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
): ReadonlySet<string> {
  const changed = new Set<string>();
  for (const [dir, revision] of after) {
    if (before.get(dir) !== revision) changed.add(dir);
  }
  for (const dir of before.keys()) {
    if (!after.has(dir)) changed.add(dir);
  }
  return changed;
}

/** Каталог плагина от корня слоя — тем же ключом, что у ревизий индекса. */
function dirInLayer(entryDir: string): string {
  const prefix = `${APPLICATION_ROOT_DIR}/`;
  return entryDir.startsWith(prefix) ? entryDir.slice(prefix.length) : entryDir;
}

export function createApplicationPluginsWatch(
  deps: ApplicationPluginsWatchDeps
): ApplicationPluginsWatch {
  const interval = deps.minIntervalMs ?? DEFAULT_FOCUS_INTERVAL_MS;
  const now = deps.now ?? ((): number => Date.now());
  let disposed = false;

  const run = async (): Promise<void> => {
    const before = deps.current()?.revisions;
    // Слой без ревизий неизменен: спрашивать сервер не о чем.
    if (before === undefined) return;
    const next = await deps.load();
    if (disposed || next === null || next.revisions === undefined) return;
    const changed = changedDirs(before, next.revisions);
    if (changed.size === 0) return;

    deps.replace(next);
    await deps.catalog.refresh();
    for (const entry of deps.catalog.list()) {
      if (disposed) return;
      if (!changed.has(dirInLayer(entry.dir))) continue;
      if (entry.state === 'enabled') await deps.catalog.reload(entry.id);
      else await deps.catalog.enable(entry.id);
    }
    // Не ждём: это ускорение, и проверка считается законченной, когда плагины подняты.
    void deps.catalog.preloadDeferred().catch(() => undefined);
  };

  /** Совпавшие проверки схлопываются: вторая ждёт первую, а не идёт рядом с ней. */
  let checking: Promise<void> | null = null;
  const check = (): Promise<void> => {
    checking ??= run()
      .catch((error: unknown) => {
        console.error('[plugins] перечитывание плагинов приложения не удалось', error);
      })
      .finally(() => {
        checking = null;
      });
    return checking;
  };

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

  const subscription = toDisposable(() => {
    disposed = true;
    deps.window?.removeEventListener('focus', onFocus);
    deps.document?.removeEventListener('visibilitychange', onVisible);
  });

  return {
    check,
    dispose: () => {
      subscription.dispose();
    },
  };
}
