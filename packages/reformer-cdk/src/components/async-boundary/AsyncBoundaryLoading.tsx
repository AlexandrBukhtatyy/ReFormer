import { useAsyncBoundaryContext } from './AsyncBoundaryContext';
import type { AsyncBoundarySlotProps } from './types';

/**
 * AsyncBoundary.Loading — содержимое, видимое во время загрузки.
 *
 * Учитывает `delayMs` корня: при быстром ответе слот не показывается вовсе.
 * Разметку (`role="status"`, `aria-live`) даёт ui-kit — CDK остаётся headless.
 *
 * @example
 * ```tsx
 * <AsyncBoundary.Loading>
 *   <p role="status" aria-live="polite">Загрузка данных…</p>
 * </AsyncBoundary.Loading>
 * ```
 */
export function AsyncBoundaryLoading({ children }: AsyncBoundarySlotProps) {
  const { isLoading } = useAsyncBoundaryContext();

  if (!isLoading) return null;

  return <>{children}</>;
}

AsyncBoundaryLoading.displayName = 'AsyncBoundary.Loading';
