import type { Store } from '../../../model/scope';
import { useOwned } from './use-owned';

/**
 * Стор, которым владеет компонент: создаётся один раз, снимается при размонтировании.
 *
 * Для стора одного экрана или виджета — фильтры списка, состояние мастера, черновик. Стор
 * приложения, который живёт всё время работы, создают на уровне модуля (или один на запрос при
 * SSR) и в хук не оборачивают.
 *
 * Фабрика вызывается один раз. Снятие идёт микрозадачей после размонтирования и отменяется, если
 * React тут же смонтировал компонент снова (StrictMode, Fast Refresh), — стор не умирает в
 * разработке. Читать значения стора в рендере — {@link useComputed} или {@link useSignalSnapshot}.
 *
 * @typeParam S - Тип стора (результат `createStore`) или любой объект с `dispose()`.
 * @param factory - Фабрика стора, обычно `() => createStore(...)`. Должна создавать НОВЫЙ стор:
 *   хук снимет его при размонтировании.
 * @returns Стабильный стор.
 *
 * @example
 * ```tsx
 * import { createModel, createStore } from '@reformer/core/model';
 * import { useComputed, useStore } from '@reformer/core/react';
 *
 * const createFilters = () =>
 *   createStore(() => {
 *     const model = createModel({ query: '', onlyActive: false });
 *     return { model, reset: () => model.reset() };
 *   });
 *
 * function Filters() {
 *   const filters = useStore(createFilters);
 *   const query = useComputed(() => filters.model.$.query.value);
 *   return <input value={query} onChange={(e) => (filters.model.query = e.target.value)} />;
 * }
 * ```
 *
 * @group React Hooks
 */
export function useStore<S extends Store<object>>(factory: () => S): S {
  return useOwned(factory);
}
