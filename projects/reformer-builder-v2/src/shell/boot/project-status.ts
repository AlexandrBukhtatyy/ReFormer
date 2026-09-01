/**
 * Итог по рабочей области, переживающий смену проекта.
 *
 * Строка состояния получает ОДИН источник на всё время жизни приложения — иначе она исчезала
 * бы до восстановления проекта, то есть ровно тогда, когда состояние интереснее всего. Смена
 * проекта для неё — смена содержимого, а не смена источника.
 *
 * Двойная подписка здесь неизбежна и потому явная: на держателя проекта (сессия сменилась)
 * и на итог самой сессии (счётчик изменился). Вторая переустанавливается при каждой первой.
 *
 * Модуль типизован структурно и ничего не импортирует из `./project`: так он проверяется
 * в `node` без рабочей области, хранилищ и React.
 *
 * @module app/project-status
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import {
  NO_WORKSPACE_STATUS,
  type WorkspaceStatusSnapshot,
  type WorkspaceStatusSource,
} from '@/shell/platform/ui/status';

/** Держатель проекта в объёме, нужном строке состояния. */
export interface StatusProjectReader {
  get(): { readonly status: WorkspaceStatusSource } | null;
  subscribe(listener: () => void): Disposable;
}

/** Источник итога, который умеет отписаться. */
export interface DisposableStatusSource extends WorkspaceStatusSource, Disposable {}

export function createProjectStatusSource(project: StatusProjectReader): DisposableStatusSource {
  const listeners = new Set<() => void>();
  let snapshot: WorkspaceStatusSnapshot = project.get()?.status.get() ?? NO_WORKSPACE_STATUS;
  let inner: Disposable | null = null;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[app] подписчик итога рабочей области упал', error);
      }
    }
  };

  const pull = (): void => {
    const next = project.get()?.status.get() ?? NO_WORKSPACE_STATUS;
    // Ссылка сравнивается, а не значение: снимок сессии стабилен между изменениями,
    // и `useSyncExternalStore` требует ровно этого.
    if (next === snapshot) return;
    snapshot = next;
    notify();
  };

  const rebind = (): void => {
    inner?.dispose();
    inner = project.get()?.status.subscribe(pull) ?? null;
    pull();
  };

  const outer = project.subscribe(rebind);
  rebind();

  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    dispose() {
      outer.dispose();
      inner?.dispose();
      inner = null;
      listeners.clear();
    },
  };
}
