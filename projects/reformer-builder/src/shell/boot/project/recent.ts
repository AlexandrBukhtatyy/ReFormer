/**
 * Недавние проекты — список «Открыть недавние» над записями рабочих областей.
 *
 * ## Проекция записей, а не второе хранилище
 *
 * Отдельного списка нет: недавние — это записи `workspaces`, которые хранилище и так отдаёт
 * свежими вперёд (`listWorkspaces`), а держатель проекта обновляет им `lastOpenedAt`
 * на каждом открытии. Тот же довод, что у «последнего проекта» в `./project`: отдельная
 * настройка рано или поздно разошлась бы со списком областей — а область, которой нет
 * в метаданных, всё равно нечем открыть.
 *
 * ## «Убрать из списка» — флаг, а не удаление
 *
 * `removeWorkspace` стирает журнал и вкладки, а рабочая копия с несохранёнными правками
 * осталась бы в OPFS без пути к ней. Поэтому убранная область помечается `hiddenFromRecent`
 * и остаётся целой. Открытие проекта пишет запись заново без флага, и проект возвращается
 * в список — так же VS Code возвращает в него текущую область при старте.
 *
 * ## Открытого сейчас проекта в списке нет
 *
 * Окно одно, и «открыть проект, который уже открыт» ничего не делает. Первым пунктом поэтому
 * стоит ПРЕДЫДУЩИЙ проект: `Ctrl+R`, Enter — и человек вернулся туда, откуда пришёл.
 *
 * ## Снимок, а не чтение по требованию
 *
 * Список читают синхронно — `items()` динамической группы меню и `useSyncExternalStore`
 * стартовой страницы, — а хранилище отвечает обещанием. Поэтому список держится готовым
 * и перечитывается по событиям, от которых зависит; ссылка на него стабильна, пока состав
 * не изменился. Тот же приём, что у снимка шаблонов (`plugins/reformer/templates/commands/context-menu`).
 *
 * @module shell/boot/project/recent
 */

import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import type { WorkspaceMetaStore, WorkspaceRecord } from '@/shell/platform/workspace/storage/idb';

/** Недавний проект — строка списка. */
export interface RecentProject {
  /** Идентификатор рабочей области: по нему проект и открывается. */
  readonly id: string;
  /**
   * Имя каталога. Пути File System Access не даёт, поэтому одноимённые каталоги различимы
   * только датой открытия — её показывает тот, кто рисует список.
   */
  readonly label: string;
  readonly lastOpenedAt: number;
}

export interface RecentProjects extends Disposable {
  /**
   * Список: свежий первым, без открытого сейчас и без убранных человеком. Ссылка стабильна
   * между изменениями — условие `useSyncExternalStore`.
   */
  get(): readonly RecentProject[];
  /** Список сменился: состав, порядок или подписи. */
  subscribe(listener: () => void): Disposable;
  /**
   * Перечитать записи.
   *
   * Не бросает: отказ хранилища оставляет прежний снимок и уходит в консоль. Список недавних —
   * удобство, и ронять из-за него открытие проекта, которое его обновляет, нельзя.
   */
  refresh(): Promise<void>;
  /** Убрать проект из списка. Рабочая копия остаётся — см. шапку модуля. */
  forget(id: string): Promise<void>;
  /** Убрать из списка всё, кроме открытого сейчас проекта. */
  clear(): Promise<void>;
}

export interface RecentProjectsOptions {
  readonly meta: Pick<WorkspaceMetaStore, 'listWorkspaces' | 'hideWorkspaces'>;
  /** Открытый сейчас проект или `null`. Спрашивается на каждом пересчёте, а не запоминается. */
  readonly currentId: () => string | null;
}

/** Пустой список: одна ссылка вместо нового массива — её сравнивает `useSyncExternalStore`. */
const NO_PROJECTS: readonly RecentProject[] = Object.freeze([]);

/**
 * Записи → список: без убранных, без открытого сейчас, в порядке хранилища.
 *
 * Порядок не пересчитывается: `listWorkspaces` уже отдаёт свежие первыми, и вторая сортировка
 * здесь была бы вторым правилом свежести, которое однажды разойдётся с первым.
 */
export function recentFromRecords(
  records: readonly WorkspaceRecord[],
  currentId: string | null
): readonly RecentProject[] {
  const projects: RecentProject[] = [];
  for (const record of records) {
    if (record.hiddenFromRecent === true || record.id === currentId) continue;
    projects.push(
      Object.freeze({
        id: record.id,
        // Подписи может не быть у записи, пришедшей не из выбора каталога. Пустая строка
        // в меню хуже некрасивого идентификатора: по ней не щёлкнуть.
        label: record.label ?? record.id,
        lastOpenedAt: record.lastOpenedAt,
      })
    );
  }
  return projects.length === 0 ? NO_PROJECTS : Object.freeze(projects);
}

/** Совпадают ли списки во всём, что видно человеку. */
function sameProjects(a: readonly RecentProject[], b: readonly RecentProject[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((project, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      other.id === project.id &&
      other.label === project.label &&
      other.lastOpenedAt === project.lastOpenedAt
    );
  });
}

export function createRecentProjects(options: RecentProjectsOptions): RecentProjects {
  const { meta, currentId } = options;
  let records: readonly WorkspaceRecord[] = [];
  let snapshot: readonly RecentProject[] = NO_PROJECTS;
  const listeners = new Set<() => void>();
  /** Номер чтения: ответ на устаревшее чтение не перетирает свежий. */
  let seq = 0;
  let disposed = false;

  const publish = (): void => {
    const next = recentFromRecords(records, currentId());
    // Тот же состав — та же ссылка и ни одного будильника: меню и стартовая страница
    // перерисовываются только тогда, когда им есть что показать нового.
    if (sameProjects(next, snapshot)) return;
    snapshot = next;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[app] подписчик недавних проектов упал', error);
      }
    }
  };

  const refresh = async (): Promise<void> => {
    const token = (seq += 1);
    let next: readonly WorkspaceRecord[];
    try {
      next = await meta.listWorkspaces();
    } catch (error) {
      console.error('[app] недавние проекты не прочитаны', error);
      return;
    }
    // Пока читали, пришло чтение свежее — или держатель уже закрыт.
    if (disposed || token !== seq) return;
    records = next;
    publish();
  };

  return {
    get: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    refresh,

    async forget(id) {
      await meta.hideWorkspaces([id]);
      await refresh();
    },

    async clear() {
      // Состав берётся из хранилища, а не из снимка: снимок мог отстать, а «очистить»
      // обязано убрать и то, что человек ещё не видел в списке.
      const current = currentId();
      const ids = (await meta.listWorkspaces())
        .filter((record) => record.hiddenFromRecent !== true && record.id !== current)
        .map((record) => record.id);
      await meta.hideWorkspaces(ids);
      await refresh();
    },

    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
