/**
 * Collapsible - сворачиваемая секция для RenderSchema
 *
 * @module reformer/renderer-react/components/collapsible
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
 * Collapsible - сворачиваемая секция формы.
 *
 * Заголовок-кнопка переключает видимость `children`. Состояние локальное
 * (`useState`), внешний control пока не поддерживается — для управляемого
 * варианта используй `RenderSchema.node('selector').setHidden(true)` поверх
 * обычного `Box`.
 *
 * @example Свёрнута по умолчанию
 * ```typescript
 * {
 *   component: Collapsible,
 *   componentProps: {
 *     title: 'Дополнительные параметры',
 *     defaultOpen: false,
 *     className: 'border rounded p-4',
 *     titleClassName: 'font-semibold w-full text-left',
 *   },
 *   children: [
 *     { component: path.notes },
 *     { component: path.tags },
 *   ],
 * }
 * ```
 *
 * @example Развёрнута, со специальным фоном контента
 * ```typescript
 * {
 *   component: Collapsible,
 *   componentProps: {
 *     title: 'Адрес доставки',
 *     defaultOpen: true,
 *     contentClassName: 'mt-2 bg-gray-50 p-3 rounded',
 *   },
 *   children: [
 *     { component: path.deliveryAddress },
 *   ],
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
