import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AsyncBoundaryIds } from './AsyncBoundaryContext';
import type { AsyncStatus } from './types';

/** Опции {@link useAsyncBoundary}. Совпадают с props `AsyncBoundary.Root`. */
export interface UseAsyncBoundaryOptions<E = unknown> {
  /** Текущее состояние асинхронной операции. */
  status: AsyncStatus;
  /** Полезная нагрузка ошибки. */
  error?: E | null;
  /** Фоновое обновление поверх уже показанного контента. @default false */
  refreshing?: boolean;
  /** Повтор загрузки. */
  onRetry?: () => void;
  /** Задержка перед показом загрузки, мс. @default 0 */
  delayMs?: number;
  /** Явный префикс для генерируемых id. */
  id?: string;
}

/** Пропсы региона-обёртки: `aria-busy` + data-атрибуты для CSS и e2e. */
export interface AsyncBoundaryRootPropGetters {
  id: string;
  'data-status': AsyncStatus;
  'data-refreshing'?: true;
  'aria-busy'?: true;
}

/** Пропсы индикатора загрузки. Политика объявления зафиксирована тестами a11y. */
export interface AsyncBoundaryLoadingPropGetters {
  id: string;
  role: 'status';
  'aria-live': 'polite';
}

/** Пропсы блока ошибки. */
export interface AsyncBoundaryErrorPropGetters {
  id: string;
  role: 'alert';
  'aria-live': 'assertive';
}

/** Возвращаемое значение {@link useAsyncBoundary}. */
export interface UseAsyncBoundaryReturn<E = unknown> {
  status: AsyncStatus;
  isIdle: boolean;
  /** Учитывает `delayMs` — см. {@link UseAsyncBoundaryOptions.delayMs}. */
  isLoading: boolean;
  isReady: boolean;
  isError: boolean;
  refreshing: boolean;
  error: E | null;
  retry: () => void;
  canRetry: boolean;
  ids: AsyncBoundaryIds;
  rootProps: AsyncBoundaryRootPropGetters;
  loadingProps: AsyncBoundaryLoadingPropGetters;
  errorProps: AsyncBoundaryErrorPropGetters;
}

/**
 * Headless-хук состояний асинхронной загрузки: нормализует статус, гасит вспышку
 * спиннера и отдаёт готовые наборы a11y-пропсов.
 *
 * Используется самим `AsyncBoundary.Root`, но пригоден и отдельно — когда разметка
 * пишется вручную и compound-дерево избыточно.
 *
 * @typeParam E - Тип полезной нагрузки ошибки.
 * @param options - Статус, ошибка, `onRetry`, `delayMs`, `id`.
 * @returns Разложенный статус, `retry` и три набора пропсов (`rootProps` / `loadingProps` / `errorProps`).
 *
 * @example Ручная разметка без compound-дерева
 * ```tsx
 * import { useAsyncBoundary } from '@reformer/cdk/async-boundary';
 *
 * function Panel({ status, error, reload, children }: Props) {
 *   const { isLoading, isError, retry, rootProps, loadingProps, errorProps } =
 *     useAsyncBoundary({ status, error, onRetry: reload, delayMs: 200 });
 *
 *   return (
 *     <section {...rootProps}>
 *       {isLoading && <p {...loadingProps}>Загрузка…</p>}
 *       {isError && (
 *         <div {...errorProps}>
 *           {error}
 *           <button onClick={retry}>Повторить</button>
 *         </div>
 *       )}
 *       {!isLoading && !isError && children}
 *     </section>
 *   );
 * }
 * ```
 *
 * @example Отложенный спиннер — быстрый ответ не вызывает мигания
 * ```tsx
 * // Ответ за 120 мс: status успевает пройти loading → ready, но isLoading
 * // ни разу не станет true, и пользователь не увидит вспышку.
 * const { isLoading } = useAsyncBoundary({ status, delayMs: 300 });
 * ```
 */
export function useAsyncBoundary<E = unknown>({
  status,
  error = null,
  refreshing = false,
  onRetry,
  delayMs = 0,
  id,
}: UseAsyncBoundaryOptions<E>): UseAsyncBoundaryReturn<E> {
  const reactId = useId();
  const baseId = id ?? reactId;

  // Отложенный показ загрузки. Таймер живёт только внутри `loading`; при любом другом
  // статусе состояние сбрасывается в «задержки нет», иначе следующая загрузка стартовала
  // бы с уже истёкшим таймером и мигание вернулось бы.
  const [delayElapsed, setDelayElapsed] = useState(delayMs === 0);
  useEffect(() => {
    if (delayMs === 0) {
      setDelayElapsed(true);
      return;
    }
    if (status !== 'loading') {
      setDelayElapsed(false);
      return;
    }
    const timer = setTimeout(() => setDelayElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [status, delayMs]);

  // onRetry читаем через ref: инлайновая стрелка у консумента меняется каждый рендер,
  // а `retry` должен быть стабильным, иначе контекст пересоздаётся на каждом рендере.
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;
  const retry = useCallback(() => onRetryRef.current?.(), []);

  const isLoading = status === 'loading' && delayElapsed;
  const canRetry = typeof onRetry === 'function';

  const ids = useMemo<AsyncBoundaryIds>(
    () =>
      Object.freeze({
        region: `async-${baseId}`,
        status: `async-status-${baseId}`,
        error: `async-error-${baseId}`,
      }),
    [baseId]
  );

  return useMemo<UseAsyncBoundaryReturn<E>>(
    () => ({
      status,
      isIdle: status === 'idle',
      isLoading,
      isReady: status === 'ready',
      isError: status === 'error',
      refreshing,
      error,
      retry,
      canRetry,
      ids,
      rootProps: {
        id: ids.region,
        'data-status': status,
        // Булевы data-/aria-атрибуты — только `true | undefined`: `false` отрендерился бы
        // строкой "false" и сломал бы селекторы вида [data-refreshing].
        'data-refreshing': refreshing || undefined,
        'aria-busy': status === 'loading' || refreshing || undefined,
      },
      loadingProps: { id: ids.status, role: 'status', 'aria-live': 'polite' },
      errorProps: { id: ids.error, role: 'alert', 'aria-live': 'assertive' },
    }),
    [status, isLoading, refreshing, error, retry, canRetry, ids]
  );
}
