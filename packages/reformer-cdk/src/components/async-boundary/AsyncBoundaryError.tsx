import { useAsyncBoundaryContext } from './AsyncBoundaryContext';
import type { AsyncBoundaryErrorProps, AsyncBoundaryErrorRenderProps } from './types';

type ErrorRenderFunction<E> = (props: AsyncBoundaryErrorRenderProps<E>) => React.ReactNode;

function isRenderFunction<E>(
  children: AsyncBoundaryErrorProps<E>['children']
): children is ErrorRenderFunction<E> {
  return typeof children === 'function';
}

/**
 * AsyncBoundary.Error — содержимое, видимое при `status === 'error'`.
 *
 * Единственный слот с render-функцией: она получает саму ошибку и `retry`. Именно
 * отсутствие этих данных в props-less слотах прежнего API вынуждало консументов
 * оборачивать блок ошибки в замыкание с захардкоженным текстом и терять `onRetry`.
 *
 * @typeParam E - Тип полезной нагрузки ошибки.
 *
 * @example Render-функция с доступом к ошибке и повтору
 * ```tsx
 * <AsyncBoundary.Error>
 *   {({ error, retry, canRetry }) => (
 *     <div role="alert" aria-live="assertive">
 *       <p>{String(error)}</p>
 *       {canRetry && <button onClick={retry}>Повторить</button>}
 *     </div>
 *   )}
 * </AsyncBoundary.Error>
 * ```
 *
 * @example Статичное содержимое, когда текст ошибки не нужен
 * ```tsx
 * <AsyncBoundary.Error>
 *   <p role="alert">Не удалось загрузить заявку</p>
 * </AsyncBoundary.Error>
 * ```
 */
export function AsyncBoundaryError<E = unknown>({ children }: AsyncBoundaryErrorProps<E>) {
  const { isError, error, retry, canRetry } = useAsyncBoundaryContext<unknown, E>();

  if (!isError) return null;

  if (isRenderFunction<E>(children)) {
    return <>{children({ error, retry, canRetry })}</>;
  }

  return <>{children}</>;
}

AsyncBoundaryError.displayName = 'AsyncBoundary.Error';
