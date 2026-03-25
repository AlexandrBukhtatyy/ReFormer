/**
 * Box - простой div-контейнер для RenderSchema
 *
 * @module core/render/components/box
 */

import type { ReactNode } from 'react';

/**
 * Props компонента Box
 */
export interface BoxProps {
  /** CSS класс для стилизации */
  className?: string;
  /** Дочерние элементы */
  children?: ReactNode;
}

/**
 * Box - базовый контейнер-обёртка
 *
 * Простой div для группировки элементов и применения стилей.
 * Используйте className для настройки layout через atomic CSS.
 *
 * @example
 * ```typescript
 * {
 *   component: Box,
 *   componentProps: {
 *     className: 'flex flex-col gap-4',
 *     children: [
 *       { component: path.email },
 *       { component: path.password },
 *     ],
 *   },
 * }
 * ```
 */
export function Box({ className, children }: BoxProps): ReactNode {
  return <div className={className}>{children}</div>;
}
