/**
 * AsyncBoundary - контейнер с тремя состояниями (loading/error/ready)
 *
 * Принимает status и два фабричных компонента для loading/error.
 * В состоянии ready отображает children. Слоты — ComponentType, без props.
 * Для кастомизации props слота передайте тонкую обёртку.
 *
 * @module reformer/ui-kit/components/async-boundary
 */

import type { ComponentType, ReactNode } from 'react';

/** Состояние асинхронной операции, ожидаемое {@link AsyncBoundary}. */
export type AsyncStatus = 'loading' | 'error' | 'ready';

/** Props компонента {@link AsyncBoundary}. */
export interface AsyncBoundaryProps {
  status: AsyncStatus;
  LoadingComponent?: ComponentType;
  ErrorComponent?: ComponentType;
  children?: ReactNode;
}

/**
 * Контейнер с тремя состояниями (`loading`/`error`/`ready`). В состоянии `ready`
 * отображает `children`. Для loading/error используются переданные slot-компоненты
 * (`ComponentType`, без props — для кастомизации передай тонкую обёртку).
 *
 * @example
 * ```tsx
 * import { AsyncBoundary } from '@reformer/ui-kit';
 *
 * <AsyncBoundary
 *   status={status}
 *   LoadingComponent={() => <Spinner />}
 *   ErrorComponent={() => <p>Ошибка загрузки</p>}
 * >
 *   <DataView data={data} />
 * </AsyncBoundary>
 * ```
 */
export function AsyncBoundary({
  status,
  LoadingComponent,
  ErrorComponent,
  children,
}: AsyncBoundaryProps): ReactNode {
  if (status === 'loading') return LoadingComponent ? <LoadingComponent /> : null;
  if (status === 'error') return ErrorComponent ? <ErrorComponent /> : null;
  return <>{children}</>;
}
