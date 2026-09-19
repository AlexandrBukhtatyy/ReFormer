/**
 * Section - секция с заголовком для RenderSchema
 *
 * @module reformer/ui-kit/components/section
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
 * Section - секция формы с заголовком.
 *
 * Семантический `<section>`-контейнер для группировки связанных полей
 * с опциональным заголовком (`titleAs` управляет уровнем `h1`-`h6`).
 *
 * @example Заголовок h2 + сетка из двух колонок (M1: лист = `value` + `component`)
 * ```typescript
 * import { Section, Input } from '@reformer/ui-kit';
 *
 * {
 *   component: Section,
 *   componentProps: {
 *     title: 'Личные данные',
 *     titleAs: 'h2',
 *     titleClassName: 'text-xl font-bold',
 *     className: 'grid grid-cols-2 gap-4',
 *   },
 *   children: [
 *     { value: model.$.firstName, component: Input },
 *     { value: model.$.lastName, component: Input },
 *   ],
 * }
 * ```
 *
 * @example Section без заголовка (только обёртка)
 * ```typescript
 * import { Section, Input } from '@reformer/ui-kit';
 *
 * {
 *   component: Section,
 *   componentProps: { className: 'space-y-4 mt-4' },
 *   children: [
 *     { value: model.$.address, component: Input },
 *     { value: model.$.city, component: Input },
 *   ],
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
    <section data-slot="section" className={className}>
      {title && (
        <TitleTag data-slot="section-title" className={titleClassName}>
          {title}
        </TitleTag>
      )}
      {children}
    </section>
  );
}
