/**
 * Collapsible - сворачиваемая секция для RenderSchema
 *
 * @module reformer/ui-kit/components/collapsible
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
 * извне варианта используй `createRenderSchema(...).node('selector').setHidden(true)`
 * поверх обычного `Box`/`Section`.
 *
 * @example Свёрнута по умолчанию (M1: лист = `value` + `component`)
 * ```typescript
 * import { Collapsible, Textarea, Input } from '@reformer/ui-kit';
 *
 * {
 *   component: Collapsible,
 *   componentProps: {
 *     title: 'Дополнительные параметры',
 *     defaultOpen: false,
 *     className: 'border rounded p-4',
 *     titleClassName: 'font-semibold w-full text-left',
 *   },
 *   children: [
 *     { value: model.$.notes, component: Textarea },
 *     { value: model.$.tags, component: Input },
 *   ],
 * }
 * ```
 *
 * @example Развёрнута, со специальным фоном контента
 * ```typescript
 * import { Collapsible, Textarea } from '@reformer/ui-kit';
 *
 * {
 *   component: Collapsible,
 *   componentProps: {
 *     title: 'Адрес доставки',
 *     defaultOpen: true,
 *     contentClassName: 'mt-2 bg-gray-50 p-3 rounded',
 *   },
 *   children: [
 *     { value: model.$.deliveryAddress, component: Textarea },
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
