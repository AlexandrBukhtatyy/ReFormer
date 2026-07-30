import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Empty — презентационный контейнер пустого состояния (обычный <div>, React.ComponentProps<'div'>).
 * Своих сериализуемых пропсов у Root нет; variant живёт на суб-компоненте EmptyMedia, не на корне —
 * поэтому в схеме только className, который Root реально пробрасывает в DOM.
 */
export const emptyBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Empty',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
