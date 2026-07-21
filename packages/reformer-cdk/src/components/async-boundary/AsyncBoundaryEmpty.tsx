import { useAsyncBoundaryContext } from './AsyncBoundaryContext';
import type { AsyncBoundaryEmptyProps } from './types';

/**
 * AsyncBoundary.Empty — «данные загрузились, но их нет».
 *
 * Пустота — отдельная от статуса ось: сам предикат знает только консумент
 * (пустой массив, `totalCount === 0`, отфильтрованная выборка), поэтому он приходит
 * пропом `when`, а слот лишь ограничивает его состоянием `ready`. Именно поэтому
 * `'empty'` не добавлен в {@link AsyncStatus} — иначе статус пришлось бы пересчитывать
 * на каждое изменение данных.
 *
 * @example Пустой список после успешной загрузки
 * ```tsx
 * <AsyncBoundary.Content>
 *   <AsyncBoundary.Empty when={items.length === 0}>
 *     <p>Ничего не найдено</p>
 *   </AsyncBoundary.Empty>
 *   {items.map(renderItem)}
 * </AsyncBoundary.Content>
 * ```
 */
export function AsyncBoundaryEmpty({ when, children }: AsyncBoundaryEmptyProps) {
  const { isReady } = useAsyncBoundaryContext();

  if (!isReady || !when) return null;

  return <>{children}</>;
}

AsyncBoundaryEmpty.displayName = 'AsyncBoundary.Empty';
