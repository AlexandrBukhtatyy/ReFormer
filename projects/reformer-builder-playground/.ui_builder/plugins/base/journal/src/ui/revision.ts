/**
 * Подписки журнала на чужое состояние — хуками для `useSyncExternalStore`.
 *
 * Хуки ничего не считают: они делают состояние службы поводом перерисоваться. Снимок — всегда
 * ссылка или примитив, стабильные между изменениями: объект, собранный на каждый вызов, дал бы
 * бесконечную перерисовку.
 *
 * @module plugins/base/journal/ui/revision
 */

import { useCallback, useEffect, useReducer, useSyncExternalStore } from 'react';
import type { DiagnosticsService, LogEntry, LogService } from '@reformer/builder-plugin-api';
import type { JournalView, JournalViewState } from '../view-state';

/** Пустой журнал: одна ссылка вместо нового массива на каждую отрисовку. */
const NO_ENTRIES: readonly LogEntry[] = Object.freeze([]);

/**
 * Перерисовка по изменению свода диагностик.
 *
 * Подписка одна на весь вид, а не на ресурс: вид показывает все ресурсы, и фильтровать по
 * адресу здесь нечего.
 */
export function useDiagnosticsRevision(diagnostics: DiagnosticsService | null): void {
  const [, bump] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    if (diagnostics === null) return;
    const subscription = diagnostics.onDidChange(bump);
    return () => {
      subscription.dispose();
    };
  }, [diagnostics]);
}

/** Записи журнала. Без службы — пусто, и это штатно: оболочка без журнала его не даёт. */
export function useLogEntries(log: LogService | null): readonly LogEntry[] {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (log === null) return () => {};
      const subscription = log.observe(cb);
      return () => {
        subscription.dispose();
      };
    },
    [log]
  );
  return useSyncExternalStore(
    subscribe,
    () => log?.entries() ?? NO_ENTRIES,
    () => NO_ENTRIES
  );
}

/** Выбранный вид. */
export function useJournalView(state: JournalViewState): JournalView {
  const subscribe = useCallback(
    (cb: () => void) => {
      const subscription = state.observe(cb);
      return () => {
        subscription.dispose();
      };
    },
    [state]
  );
  return useSyncExternalStore(subscribe, state.get, state.get);
}
