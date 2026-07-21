import type { ReactNode } from 'react';
import { useAsyncBoundaryContext } from './AsyncBoundaryContext';
import type { AsyncBoundaryContentProps } from './types';

/**
 * AsyncBoundary.Content — содержимое, видимое при успешной загрузке (`status === 'ready'`).
 *
 * По умолчанию остаётся на экране и во время фонового обновления (`refreshing`) —
 * это stale-while-revalidate: пользователь не теряет контекст, пока грузится новая порция.
 * Передайте `showWhileRefreshing={false}`, если обновление должно скрывать контент.
 *
 * В self-managed режиме `children` может быть render-функцией: она получает
 * загруженные данные (внутри `ready` они гарантированно есть).
 *
 * @typeParam T - Тип загруженных данных.
 *
 * @example Статичный контент
 * ```tsx
 * <AsyncBoundary.Content>
 *   <CreditForm form={form} />
 * </AsyncBoundary.Content>
 * ```
 *
 * @example Render-функция с данными (self-managed режим)
 * ```tsx
 * <AsyncBoundary.Content<Application[]>>
 *   {(items) => <ApplicationList items={items} />}
 * </AsyncBoundary.Content>
 * ```
 *
 * @example Скрывать контент на время обновления
 * ```tsx
 * <AsyncBoundary.Content showWhileRefreshing={false}>
 *   <DataTable rows={rows} />
 * </AsyncBoundary.Content>
 * ```
 */
export function AsyncBoundaryContent<T = unknown>({
  showWhileRefreshing = true,
  children,
}: AsyncBoundaryContentProps<T>) {
  const { isReady, refreshing, data } = useAsyncBoundaryContext<T>();

  if (!isReady) return null;
  if (refreshing && !showWhileRefreshing) return null;

  if (typeof children === 'function') {
    // В controlled-режиме данных нет: вызвать функцию с undefined значило бы
    // отдать консументу заведомо пустой аргумент вопреки сигнатуре `(data: T)`.
    if (data === undefined) return null;
    return <>{(children as (data: T) => ReactNode)(data)}</>;
  }

  return <>{children}</>;
}

AsyncBoundaryContent.displayName = 'AsyncBoundary.Content';
