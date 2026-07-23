import { createContext, useContext } from 'react';
import type {
  AsyncBoundaryErrorPropGetters,
  AsyncBoundaryLoadingPropGetters,
  AsyncBoundaryRootPropGetters,
} from './useAsyncBoundary';
import type { AsyncStatus } from './types';

/** Идентификаторы, которыми связываются регион, индикатор загрузки и сообщение об ошибке. */
export interface AsyncBoundaryIds {
  /** id региона-обёртки — на него вешается `aria-busy`. */
  region: string;
  /** id индикатора загрузки (`role="status"`). */
  status: string;
  /** id сообщения об ошибке (`role="alert"`). */
  error: string;
}

/**
 * Значение контекста `AsyncBoundary`. Слоты читают его и решают, рендериться ли им.
 *
 * @typeParam E - Тип полезной нагрузки ошибки.
 */
export interface AsyncBoundaryContextValue<T = unknown, E = unknown> {
  /** Сырой статус из `AsyncBoundary.Root`. */
  status: AsyncStatus;
  /**
   * Загруженные данные — только в self-managed режиме (`load`). В controlled-режиме
   * всегда `undefined`: там данными владеет консумент.
   */
  data: T | undefined;
  /** `status === 'idle'` — загрузка не запускалась. */
  isIdle: boolean;
  /**
   * Показывать ли индикатор загрузки. Это НЕ `status === 'loading'`: при `delayMs > 0`
   * первые `delayMs` мс флаг остаётся `false`, чтобы быстрый ответ не вызывал вспышку спиннера.
   */
  isLoading: boolean;
  /** `status === 'ready'` — данные получены. */
  isReady: boolean;
  /** `status === 'error'` — запрос упал. */
  isError: boolean;
  /** Фоновое обновление поверх уже показанного контента. */
  refreshing: boolean;
  /** Ошибка (null, когда её нет). */
  error: E | null;
  /** Повторить загрузку. В self-managed режиме перезапускает `load`. */
  retry: () => void;
  /** Возможен ли повтор: задан `onRetry` либо работает self-managed режим. */
  canRetry: boolean;
  /** Сгенерированные id для a11y-связок. */
  ids: AsyncBoundaryIds;
  /**
   * Пропсы региона-обёртки (`aria-busy`, `data-status`). Лежат в контексте, а не только
   * в {@link useAsyncBoundary}, чтобы обёртка из ui-kit не пересчитывала ту же логику:
   * читать их можно только НИЖЕ провайдера, а сам `Root` разметки не рендерит.
   */
  rootProps: AsyncBoundaryRootPropGetters;
  /** Пропсы индикатора загрузки: `role="status"` + `aria-live="polite"`. */
  loadingProps: AsyncBoundaryLoadingPropGetters;
  /** Пропсы блока ошибки: `role="alert"` + `aria-live="assertive"`. */
  errorProps: AsyncBoundaryErrorPropGetters;
}

// Контекст хранит generic-стёртое `<any>`: конкретный `E` не assignable к параметру
// провайдера, типизированному `unknown`. Типобезопасность возвращается на чтении —
// в generic-параметре useAsyncBoundaryContext<E>().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AsyncBoundaryContext = createContext<AsyncBoundaryContextValue<any, any> | null>(null);

/**
 * Хук доступа к контексту `AsyncBoundary`. Бросает исключение вне `AsyncBoundary.Root`.
 *
 * @typeParam E - Тип полезной нагрузки ошибки.
 * @returns Текущее {@link AsyncBoundaryContextValue}.
 * @throws Error если вызван вне `AsyncBoundary.Root`.
 *
 * @example Своя кнопка повтора вне слота Error
 * ```tsx
 * import { useAsyncBoundaryContext } from '@reformer/cdk/async-boundary';
 *
 * function ToolbarRetry() {
 *   const { isError, retry, canRetry } = useAsyncBoundaryContext<string>();
 *   if (!isError || !canRetry) return null;
 *   return <button onClick={retry}>Повторить загрузку</button>;
 * }
 * ```
 *
 * @example Затемнение контента во время фонового обновления
 * ```tsx
 * function DimWhileRefreshing({ children }: { children: React.ReactNode }) {
 *   const { refreshing } = useAsyncBoundaryContext();
 *   return <div style={{ opacity: refreshing ? 0.6 : 1 }}>{children}</div>;
 * }
 * ```
 */
export function useAsyncBoundaryContext<T = unknown, E = unknown>(): AsyncBoundaryContextValue<
  T,
  E
> {
  const context = useContext(AsyncBoundaryContext) as AsyncBoundaryContextValue<T, E> | null;
  if (!context) {
    throw new Error(
      'AsyncBoundary.* components must be used within <AsyncBoundary.Root>. ' +
        'Wrap your slots with <AsyncBoundary.Root status={...}>.'
    );
  }
  return context;
}
