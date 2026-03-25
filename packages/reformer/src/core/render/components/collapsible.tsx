/**
 * Collapsible - сворачиваемая секция для RenderSchema
 *
 * @module core/render/components/collapsible
 */

import { useState, type ReactNode } from 'react';

/**
 * Props компонента Collapsible
 */
export interface CollapsibleProps {
  /** Заголовок секции */
  title: string;
  /** Начальное состояние (развёрнуто по умолчанию) */
  defaultOpen?: boolean;
  /** CSS класс для контейнера */
  className?: string;
  /** CSS класс для заголовка */
  titleClassName?: string;
  /** CSS класс для контента */
  contentClassName?: string;
  /** Дочерние элементы */
  children?: ReactNode;
}

/**
 * Collapsible - сворачиваемая секция формы
 *
 * Секция с возможностью сворачивания/разворачивания.
 * Используется для группировки опциональных или дополнительных полей.
 *
 * @example
 * ```typescript
 * {
 *   component: Collapsible,
 *   componentProps: {
 *     title: 'Дополнительные параметры',
 *     defaultOpen: false,
 *     className: 'border rounded p-4',
 *     children: [
 *       { component: path.notes },
 *       { component: path.tags },
 *     ],
 *   },
 * }
 * ```
 */
export function Collapsible({
  title,
  defaultOpen = true,
  className,
  titleClassName,
  contentClassName,
  children,
}: CollapsibleProps): ReactNode {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        className={titleClassName}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {title}
        <span aria-hidden="true">{isOpen ? ' ▼' : ' ▶'}</span>
      </button>
      {isOpen && <div className={contentClassName}>{children}</div>}
    </div>
  );
}
