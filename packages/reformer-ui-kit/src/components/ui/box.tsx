/**
 * Box - простой div-контейнер для RenderSchema
 *
 * @module reformer/ui-kit/components/box
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
 * @example Вертикальный список полей в RenderSchema (M1: лист = `value` + `component`)
 * ```typescript
 * import { Box, Input, InputPassword } from '@reformer/ui-kit';
 *
 * {
 *   component: Box,
 *   componentProps: { className: 'flex flex-col gap-4' },
 *   children: [
 *     { value: model.$.email, component: Input },
 *     { value: model.$.password, component: InputPassword },
 *   ],
 * }
 * ```
 *
 * @example Двухколоночная сетка
 * ```typescript
 * import { Box, Input } from '@reformer/ui-kit';
 *
 * {
 *   component: Box,
 *   componentProps: { className: 'grid grid-cols-2 gap-4' },
 *   children: [
 *     { value: model.$.firstName, component: Input },
 *     { value: model.$.lastName, component: Input },
 *   ],
 * }
 * ```
 */
export function Box({ className, children }: BoxProps): ReactNode {
  return <div className={className}>{children}</div>;
}
