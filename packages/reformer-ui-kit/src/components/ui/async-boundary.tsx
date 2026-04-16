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

export type AsyncStatus = 'loading' | 'error' | 'ready';

export interface AsyncBoundaryProps {
  status: AsyncStatus;
  LoadingComponent?: ComponentType;
  ErrorComponent?: ComponentType;
  children?: ReactNode;
}

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
