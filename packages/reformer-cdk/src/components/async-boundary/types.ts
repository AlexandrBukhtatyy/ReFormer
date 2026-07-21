import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Состояние асинхронной операции.
 *
 * - `'idle'` — загрузка не запускалась и не планируется (создание новой записи, id ещё не выбран).
 *   Отдельное состояние нужно, чтобы «пустая форма» не выглядела как успешно загруженные данные.
 * - `'loading'` — запрос выполняется, данных ещё нет.
 * - `'ready'` — данные получены, показываем контент.
 * - `'error'` — запрос завершился ошибкой.
 *
 * Фоновое обновление поверх уже показанных данных — это не отдельный статус, а флаг
 * `refreshing` при `status === 'ready'` (stale-while-revalidate).
 */
export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Императивный handle `AsyncBoundary`, доступный через `ref`.
 *
 * Нужен, когда триггер перезагрузки живёт вне дерева границы: тулбар страницы,
 * пункт меню «Обновить», WebSocket-событие, кнопка в диалоге. Получают через
 * `useRef<AsyncBoundaryHandle<T>>(null)` и передают в `<AsyncBoundary.Root ref={...}>`.
 *
 * Поля `status` / `data` / `error` / `isLoading` / `refreshing` — снимок на момент
 * рендера. Для реактивного UI читайте их из {@link AsyncBoundaryContextValue}
 * (через слоты или `useAsyncBoundaryContext()`), а не из handle.
 *
 * @typeParam T - Тип загружаемых данных (self-managed режим).
 * @typeParam E - Тип полезной нагрузки ошибки.
 *
 * @example Кнопка «Обновить» в шапке страницы
 * ```tsx
 * import { useRef } from 'react';
 * import { AsyncBoundary, type AsyncBoundaryHandle } from '@reformer/cdk/async-boundary';
 *
 * function ApplicationsPage() {
 *   const boundaryRef = useRef<AsyncBoundaryHandle<Application[]>>(null);
 *
 *   return (
 *     <>
 *       <header>
 *         <button onClick={() => boundaryRef.current?.reload()}>Обновить</button>
 *         <button onClick={() => boundaryRef.current?.abort()}>Отменить</button>
 *       </header>
 *
 *       <AsyncBoundary.Root ref={boundaryRef} load={(signal) => fetchApplications(signal)}>
 *         <AsyncBoundary.Loading>Загрузка…</AsyncBoundary.Loading>
 *         <AsyncBoundary.Content>{(items) => <List items={items} />}</AsyncBoundary.Content>
 *       </AsyncBoundary.Root>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Дозагрузка по событию извне
 * ```tsx
 * useEffect(() => {
 *   const off = socket.on('application:updated', () => boundaryRef.current?.reload());
 *   return off;
 * }, []);
 * ```
 */
export interface AsyncBoundaryHandle<T = unknown, E = unknown> {
  /** Перезапустить загрузку. В controlled-режиме вызывает `onRetry`. */
  reload: () => void;
  /** Прервать текущий запрос. Прерывание не считается ошибкой. В controlled-режиме — no-op. */
  abort: () => void;
  /** Снимок статуса на момент рендера. */
  status: AsyncStatus;
  /** Последние загруженные данные (только self-managed режим). */
  data: T | undefined;
  /** Снимок ошибки. */
  error: E | null;
  /** Идёт ли загрузка (с учётом `delayMs`). */
  isLoading: boolean;
  /** Идёт ли фоновое обновление. */
  refreshing: boolean;
}

/**
 * Props корневого провайдера `AsyncBoundary.Root`.
 *
 * Два режима, взаимоисключающих:
 *
 * - **self-managed** — передан `load`: компонент грузит данные сам, ведёт статус,
 *   отменяет запросы при смене `loadKey`/размонтировании, а `AsyncBoundary.Retry`
 *   и `handle.reload()` перезапускают загрузку. Props `status` / `error` /
 *   `refreshing` / `onRetry` в этом режиме игнорируются.
 * - **controlled** — `load` не передан: состояние приходит снаружи через `status`.
 *   Нужен там, где загрузкой владеет кто-то другой — например behavior рендерера,
 *   вызывающий `schema.node('boundary').patchProps({ status })`.
 *
 * @typeParam T - Тип загружаемых данных (self-managed режим).
 * @typeParam E - Тип полезной нагрузки ошибки. В репозитории это человекочитаемая
 *   RU-строка, но тип намеренно открыт (`Error`, код ответа, объект от API).
 */
export interface AsyncBoundaryRootProps<T = unknown, E = unknown> {
  // ── self-managed режим ────────────────────────────────────────────────────
  /**
   * Загрузчик. Получает `AbortSignal` — прокиньте его в `fetch`, чтобы отменённый
   * запрос не висел в сети. Наличие этого пропа включает self-managed режим.
   */
  load?: (signal: AbortSignal) => Promise<T>;
  /**
   * Ключ перезапуска: при изменении стартует новая загрузка (обычно id записи).
   * Сравнивается по `Object.is` — передавайте примитив, а не свежий объект.
   */
  loadKey?: unknown;
  /**
   * `false` → загрузка не стартует, состояние `idle`. Режим создания новой записи.
   * @default true
   */
  enabled?: boolean;
  /** Побочный эффект после успеха — например `form.patchValue(data)`. */
  onSuccess?: (data: T) => void;
  /** Побочный эффект после ошибки — логирование, тост. */
  onError?: (error: E) => void;
  /** Преобразование отказа промиса в отображаемую ошибку. По умолчанию — сообщение `Error`. */
  toError?: (e: unknown) => E;

  // ── controlled режим ──────────────────────────────────────────────────────
  /** Текущее состояние. Обязателен, когда `load` не передан. */
  status?: AsyncStatus;
  /** Ошибка, которую получит слот `AsyncBoundary.Error`. */
  error?: E | null;
  /**
   * Идёт фоновое обновление поверх уже показанного контента.
   * Контент остаётся видимым, `aria-busy` выставляется.
   * @default false
   */
  refreshing?: boolean;
  /** Повтор загрузки. Без него `AsyncBoundary.Retry` не рендерится, а `canRetry` — `false`. */
  onRetry?: () => void;

  // ── общее ─────────────────────────────────────────────────────────────────
  /**
   * Не показывать слот загрузки первые N мс. Гасит вспышку спиннера, когда
   * ответ приходит быстрее задержки. Не влияет на `status` — только на `isLoading`.
   * @default 0
   */
  delayMs?: number;
  /** Явный префикс для генерируемых id (иначе `useId`). */
  id?: string;
  /** Слоты `AsyncBoundary.*` и любой другой контент. */
  children: ReactNode;
}

/** Props слотов, которые просто показывают/скрывают содержимое. */
export interface AsyncBoundarySlotProps {
  /** Содержимое слота. */
  children: ReactNode;
}

/** Данные, которые `AsyncBoundary.Error` передаёт в render-функцию. */
export interface AsyncBoundaryErrorRenderProps<E = unknown> {
  /** Ошибка из `AsyncBoundary.Root`. */
  error: E | null;
  /** Повторить загрузку (no-op, если `onRetry` не задан). */
  retry: () => void;
  /** Задан ли `onRetry` — по нему решают, рисовать ли кнопку повтора. */
  canRetry: boolean;
}

/**
 * Props слота `AsyncBoundary.Error`.
 *
 * В отличие от остальных слотов принимает render-функцию: именно потеря `error` и
 * `onRetry` в props-less слотах старого `AsyncBoundary` заставляла консументов писать
 * обёртки вида `() => <ErrorState error="Не удалось загрузить" />` с захардкоженным текстом.
 */
export interface AsyncBoundaryErrorProps<E = unknown> {
  /** Узел или render-функция, получающая `error` / `retry` / `canRetry`. */
  children: ReactNode | ((props: AsyncBoundaryErrorRenderProps<E>) => ReactNode);
}

/** Props слота `AsyncBoundary.Empty`. */
export interface AsyncBoundaryEmptyProps {
  /**
   * Показать вместо контента, когда загрузка успешна, но данных нет.
   * Пустота — ортогональная статусу ось: предикат считает консумент, а слот
   * рендерится только внутри `ready`.
   */
  when: boolean;
  /** Содержимое пустого состояния. */
  children: ReactNode;
}

/** Props слота `AsyncBoundary.Content`. */
export interface AsyncBoundaryContentProps<T = unknown> {
  /**
   * Показывать контент во время фонового обновления (`refreshing`).
   * @default true
   */
  showWhileRefreshing?: boolean;
  /**
   * Содержимое при `status === 'ready'`. В self-managed режиме можно передать
   * render-функцию — она получит загруженные данные уже суженными до `T`
   * (внутри `ready` они гарантированно есть).
   */
  children: ReactNode | ((data: T) => ReactNode);
}

/** Props кнопки `AsyncBoundary.Retry`. */
export interface AsyncBoundaryRetryProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Рендерить как дочерний элемент через Slot (props мержатся в children вместо `<button>`). */
  asChild?: boolean;
}
