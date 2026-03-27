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
  /** HTML элемент для заголовка (h1-h6). По умолчанию h3 */
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
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
export function Section({
  title,
  titleAs: TitleTag = 'h3',
  className,
  titleClassName,
  children,
}: SectionProps): ReactNode {
  return (
    <section className={className}>
      {title && <TitleTag className={titleClassName}>{title}</TitleTag>}
      {children}
    </section>
  );
}
