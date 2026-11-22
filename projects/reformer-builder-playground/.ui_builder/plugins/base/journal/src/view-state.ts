/**
 * Какой вид журнала выбран: «Проблемы» или «События».
 *
 * Состояние живёт с плагином, а не с телом панели: тело размонтируется, когда док свёрнут или
 * выбрана соседняя вкладка, и выбор, хранимый в нём, сбрасывался бы на каждом таком шаге.
 * Хранилища нет намеренно — выбор нужен на сессию, как и сам журнал.
 *
 * Форма — ровно та, что ждёт `useSyncExternalStore`: подписка и снимок-примитив.
 *
 * @module plugins/base/journal/view-state
 */

import type { Disposable } from '@reformer/builder-plugin-api';

export type JournalView = 'problems' | 'events';

export interface JournalViewState {
  get(): JournalView;
  set(view: JournalView): void;
  observe(cb: () => void): Disposable;
}

export function createJournalViewState(initial: JournalView = 'problems'): JournalViewState {
  let view = initial;
  const observers = new Set<() => void>();
  return {
    get: () => view,
    set(next) {
      if (next === view) return;
      view = next;
      for (const cb of [...observers]) cb();
    },
    observe(cb) {
      observers.add(cb);
      return {
        dispose: () => {
          observers.delete(cb);
        },
      };
    },
  };
}
