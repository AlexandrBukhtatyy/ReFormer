import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useAsyncBoundaryContext } from './AsyncBoundaryContext';
import type { AsyncBoundaryRetryProps } from './types';

/**
 * AsyncBoundary.Retry — кнопка повтора загрузки.
 *
 * Не рендерится, если `onRetry` не передан в корень: контрол, который ничего не делает,
 * хуже отсутствующего — он читается скринридером и ловит фокус впустую.
 *
 * @example Кнопка внутри слота ошибки
 * ```tsx
 * <AsyncBoundary.Error>
 *   <p role="alert">Не удалось загрузить</p>
 *   <AsyncBoundary.Retry>Повторить</AsyncBoundary.Retry>
 * </AsyncBoundary.Error>
 * ```
 *
 * @example Своя кнопка через asChild
 * ```tsx
 * <AsyncBoundary.Retry asChild>
 *   <Button variant="outline">Повторить</Button>
 * </AsyncBoundary.Retry>
 * ```
 */
export const AsyncBoundaryRetry = forwardRef<HTMLButtonElement, AsyncBoundaryRetryProps>(
  ({ asChild = false, children, ...props }, ref) => {
    const { retry, canRetry } = useAsyncBoundaryContext();

    if (!canRetry) return null;

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        // В asChild-режиме тип кнопки задаёт дочерний элемент: навязанный type
        // сломал бы, например, <a> или собственный компонент без <button> внутри.
        type={asChild ? undefined : 'button'}
        onClick={retry}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

AsyncBoundaryRetry.displayName = 'AsyncBoundary.Retry';
