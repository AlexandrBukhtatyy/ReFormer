/**
 * Минимальный внешний стор для `useSyncExternalStore` — без зависимостей (в проекте нет
 * state-либы; форм-модель на сигналах, но для дерева-редактора со снимками undo/redo нужен
 * простой снапшот-стор). Селекторные подписки дают точечные ре-рендеры (хук — в `hooks.ts`).
 *
 * @module reformer-builder/store/create-store
 */

/** Минимальный стор: снимок + подписка. */
export interface Store<T> {
  getState(): T;
  setState(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

/** Создать стор с начальным состоянием. `setState` не уведомляет, если ссылка не изменилась. */
export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
