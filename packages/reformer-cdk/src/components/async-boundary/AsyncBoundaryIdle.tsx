import { useAsyncBoundaryContext } from './AsyncBoundaryContext';
import type { AsyncBoundarySlotProps } from './types';

/**
 * AsyncBoundary.Idle — содержимое, видимое когда загрузка не запускалась (`status === 'idle'`).
 *
 * Типовой случай — форма создания: записи ещё нет, грузить нечего, но и «успешной
 * загрузкой» это состояние называть нельзя. Без отдельного слота консументы схлопывают
 * его в `ready` и теряют возможность показать другой заголовок или подсказку.
 *
 * @example Разный заголовок для создания и редактирования
 * ```tsx
 * <AsyncBoundary.Root status={applicationId ? status : 'idle'}>
 *   <AsyncBoundary.Idle><h1>Новая заявка</h1></AsyncBoundary.Idle>
 *   <AsyncBoundary.Content><h1>Заявка №{applicationId}</h1></AsyncBoundary.Content>
 * </AsyncBoundary.Root>
 * ```
 */
export function AsyncBoundaryIdle({ children }: AsyncBoundarySlotProps) {
  const { isIdle } = useAsyncBoundaryContext();

  if (!isIdle) return null;

  return <>{children}</>;
}

AsyncBoundaryIdle.displayName = 'AsyncBoundary.Idle';
