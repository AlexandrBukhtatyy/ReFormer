/**
 * Крошечное внешнее хранилище журнала под `useSyncExternalStore`.
 *
 * Снимок обязан быть стабильным по ссылке между изменениями — иначе React считает состояние
 * изменившимся на каждом рендере и уходит в бесконечный цикл. Поэтому массив не мутируется, а
 * заменяется целиком.
 *
 * @module react-playground/examples/form-registry-lab/lab-store
 */

export interface LogStore<T> {
  subscribe(listener: () => void): () => void;
  snapshot(): readonly T[];
  push(item: T): void;
  clear(): void;
}

const EMPTY: readonly never[] = [];

/**
 * @param limit - Сколько последних записей держать. Журнал стенда живёт долго, а интересен всегда
 *   хвост: без потолка страница с включённой задержкой набьёт память за пару минут кликанья.
 */
export function createLogStore<T>(limit = 200): LogStore<T> {
  let items: readonly T[] = EMPTY as readonly T[];
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((l) => l());

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => items,
    push(item) {
      const next = [...items, item];
      items = next.length > limit ? next.slice(next.length - limit) : next;
      notify();
    },
    clear() {
      if (items.length === 0) return; // без этого лишнее уведомление на каждый клик «очистить»
      items = EMPTY as readonly T[];
      notify();
    },
  };
}
