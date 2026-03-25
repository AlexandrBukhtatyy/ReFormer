/**
 * Section - секция с заголовком для RenderSchema
 *
 * @module core/render/components/section
 */

import type { ReactNode } from 'react';

/**
 * Props компонента Section
 */
export interface SectionProps {
  /** Заголовок секции */
  title?: string;
  /** CSS класс для контейнера */
  className?: string;
  /** CSS класс для заголовка */
  titleClassName?: string;
  /** Дочерние элементы */
  children?: ReactNode;
}

/**
 * Section - секция формы с заголовком
 *
 * Семантический контейнер для группировки связанных полей
 * с опциональным заголовком.
 *
 * @example
 * ```typescript
 * {
 *   component: Section,
 *   componentProps: {
 *     title: 'Личные данные',
 *     className: 'grid grid-cols-2 gap-4',
 *     children: [
 *       { component: path.firstName },
 *       { component: path.lastName },
 *     ],
 *   },
 * }
 * ```
 */
export function Section({ title, className, titleClassName, children }: SectionProps): ReactNode {
  return (
    <section className={className}>
      {title && <h3 className={titleClassName}>{title}</h3>}
      {children}
    </section>
  );
}
