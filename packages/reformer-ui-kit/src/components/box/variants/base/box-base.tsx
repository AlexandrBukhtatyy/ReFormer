/**
 * Box - простой div-контейнер для RenderSchema
 *
 * @module reformer/ui-kit/components/box
 */

import type { ComponentProps, ReactNode } from 'react';

/**
 * Props компонента Box: `className`, `children` и атрибуты `<div>` — `id`, `role`, `aria-*`,
 * `data-*`, обработчики. Они доходят до элемента: раньше Box принимал только `className`, и
 * ни назвать область (`aria-label`), ни сослаться на неё (`id`) было нельзя.
 */
export interface BoxProps extends Omit<ComponentProps<'div'>, 'children'> {
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
 *     { model: model.$.email, component: Input },
 *     { model: model.$.password, component: InputPassword },
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
 *     { model: model.$.firstName, component: Input },
 *     { model: model.$.lastName, component: Input },
 *   ],
 * }
 * ```
 */
export function Box({ className, children, ...props }: BoxProps): ReactNode {
  return (
    <div data-slot="box" className={className} {...props}>
      {children}
    </div>
  );
}
