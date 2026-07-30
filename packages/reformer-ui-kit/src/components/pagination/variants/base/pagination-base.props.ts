import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Pagination (презентационный `<nav role="navigation">`, порт shadcn/ui).
 * Root — простой DOM-элемент, пробрасывает className; собственных сериализуемых
 * пропсов (enum/boolean/number) нет — только доп. CSS-класс.
 */
export const paginationBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Pagination',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
