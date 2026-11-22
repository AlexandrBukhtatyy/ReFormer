import { AsyncBoundaryRoot } from './AsyncBoundaryRoot';
import { AsyncBoundaryIdle } from './AsyncBoundaryIdle';
import { AsyncBoundaryLoading } from './AsyncBoundaryLoading';
import { AsyncBoundaryContent } from './AsyncBoundaryContent';
import { AsyncBoundaryEmpty } from './AsyncBoundaryEmpty';
import { AsyncBoundaryError } from './AsyncBoundaryError';
import { AsyncBoundaryRetry } from './AsyncBoundaryRetry';

type AsyncBoundaryComponent = typeof AsyncBoundaryRoot & {
  Root: typeof AsyncBoundaryRoot;
  Idle: typeof AsyncBoundaryIdle;
  Loading: typeof AsyncBoundaryLoading;
  Content: typeof AsyncBoundaryContent;
  Empty: typeof AsyncBoundaryEmpty;
  Error: typeof AsyncBoundaryError;
  Retry: typeof AsyncBoundaryRetry;
};

/**
 * AsyncBoundary — headless compound-компонент состояний асинхронной загрузки.
 *
 * Разделяет экран на четыре взаимоисключающих состояния (`idle` / `loading` / `ready` /
 * `error`) и раздаёт их слотам. Разметки и стилей не навязывает — визуальный слой живёт
 * в `@reformer/ui-kit`.
 *
 * Это НЕ Suspense-boundary: ничего не бросается и не перехватывается, статусом управляет
 * консумент. Сам компонент данные не грузит — он их только отображает.
 *
 * ## Возможности
 * - **Headless** — ноль разметки, слоты возвращают голые фрагменты
 * - **Ошибка с контекстом** — слот `Error` получает саму ошибку и `retry` через render-функцию
 * - **Отложенный спиннер** — `delayMs` гасит вспышку загрузки при быстром ответе
 * - **Stale-while-revalidate** — `refreshing` оставляет контент на экране во время обновления
 * - **Готовая a11y** — `aria-busy` на регионе, `role="status"`/`role="alert"` на слотах
 *
 * ## Слоты
 * - `AsyncBoundary.Root` — провайдер контекста, принимает `status`
 * - `AsyncBoundary.Idle` — загрузка не запускалась
 * - `AsyncBoundary.Loading` — идёт загрузка (с учётом `delayMs`)
 * - `AsyncBoundary.Content` — данные получены
 * - `AsyncBoundary.Empty` — данные получены, но пусты (предикат `when`)
 * - `AsyncBoundary.Error` — ошибка; render-функция получает `error` / `retry` / `canRetry`
 * - `AsyncBoundary.Retry` — кнопка повтора, скрыта без `onRetry`
 *
 * @example Полное дерево состояний
 * ```tsx
 * import { AsyncBoundary } from '@reformer/cdk/async-boundary';
 *
 * function ApplicationPage({ status, error, reload, form }: Props) {
 *   return (
 *     <AsyncBoundary.Root status={status} error={error} onRetry={reload} delayMs={200}>
 *       <AsyncBoundary.Loading>
 *         <p role="status" aria-live="polite">Загрузка заявки…</p>
 *       </AsyncBoundary.Loading>
 *
 *       <AsyncBoundary.Error>
 *         {({ error, retry }) => (
 *           <div role="alert" aria-live="assertive">
 *             <p>{String(error)}</p>
 *             <button onClick={retry}>Повторить</button>
 *           </div>
 *         )}
 *       </AsyncBoundary.Error>
 *
 *       <AsyncBoundary.Content>
 *         <CreditForm form={form} />
 *       </AsyncBoundary.Content>
 *     </AsyncBoundary.Root>
 *   );
 * }
 * ```
 *
 * @example Список с пустым состоянием и фоновым обновлением
 * ```tsx
 * <AsyncBoundary.Root status={status} refreshing={refreshing}>
 *   <AsyncBoundary.Loading><Skeleton rows={5} /></AsyncBoundary.Loading>
 *   <AsyncBoundary.Content>
 *     <AsyncBoundary.Empty when={items.length === 0}>
 *       <p>Ничего не найдено</p>
 *     </AsyncBoundary.Empty>
 *     {items.map((item) => <Row key={item.id} {...item} />)}
 *   </AsyncBoundary.Content>
 * </AsyncBoundary.Root>
 * ```
 *
 * @example Режим создания: загрузки нет вообще
 * ```tsx
 * // applicationId === null → 'idle', а не мгновенный 'ready':
 * // пустая форма и успешно загруженная — разные состояния.
 * <AsyncBoundary.Root status={applicationId ? status : 'idle'}>
 *   <AsyncBoundary.Idle><NewApplicationHint /></AsyncBoundary.Idle>
 *   <AsyncBoundary.Content><ApplicationSummary /></AsyncBoundary.Content>
 * </AsyncBoundary.Root>
 * ```
 *
 * @see {@link useAsyncBoundary} — тот же расчёт состояния без compound-дерева.
 */
export const AsyncBoundary = AsyncBoundaryRoot as AsyncBoundaryComponent;

AsyncBoundary.Root = AsyncBoundaryRoot;
AsyncBoundary.Idle = AsyncBoundaryIdle;
AsyncBoundary.Loading = AsyncBoundaryLoading;
AsyncBoundary.Content = AsyncBoundaryContent;
AsyncBoundary.Empty = AsyncBoundaryEmpty;
AsyncBoundary.Error = AsyncBoundaryError;
AsyncBoundary.Retry = AsyncBoundaryRetry;
