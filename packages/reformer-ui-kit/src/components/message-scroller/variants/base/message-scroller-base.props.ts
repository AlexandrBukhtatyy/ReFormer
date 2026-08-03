import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема MessageScroller (Root примитива @shadcn/react/message-scroller) — корневой
 * контейнер авто-скролла списка сообщений. Root — это обычный `<div>`
 * (React.ComponentProps<'div'>), поэтому единственный статический сериализуемый пропс — className.
 * Всё поведение авто-скролла (autoScroll / defaultScrollPosition / scrollEdgeThreshold / …)
 * задаётся на MessageScrollerProvider, а не на Root, и в эту схему не входит.
 */
export const messageScrollerBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'MessageScroller',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
