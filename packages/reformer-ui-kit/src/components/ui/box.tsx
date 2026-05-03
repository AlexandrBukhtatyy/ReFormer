/**
 * Box - простой div-контейнер для RenderSchema
 *
 * @module reformer/renderer-react/components/box
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
 * Box - базовый контейнер-обёртка.
 *
 * Простой `<div>` для группировки элементов в `RenderSchema`. Используйте
 * `className` для настройки layout через atomic CSS (Tailwind).
 *
 * @example Вертикальный список полей в RenderSchema
 * ```typescript
 * {
 *   component: Box,
 *   componentProps: { className: 'flex flex-col gap-4' },
 *   children: [
 *     { component: path.email },
 *     { component: path.password },
 *   ],
 * }
 * ```
 *
 * @example Двухколоночная сетка
 * ```typescript
 * {
 *   component: Box,
 *   componentProps: { className: 'grid grid-cols-2 gap-4' },
 *   children: [
 *     { component: path.firstName },
 *     { component: path.lastName },
 *   ],
 * }
 * ```
 */
export function Box({ className, children }: BoxProps): ReactNode {
  return <div className={className}>{children}</div>;
}
