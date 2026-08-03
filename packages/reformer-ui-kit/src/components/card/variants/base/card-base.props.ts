import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Card` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Card'` — каноническое имя в реестре renderer-json.
 * Card — чистый `ComponentProps<'div'>` без cva/Radix: единственный сериализуемый проп — `className`.
 */
export const cardBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Card',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс карточки-контейнера (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
