import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Kbd — презентационный <kbd> (порт shadcn/ui) для отображения клавиш.
 * Без Radix и состояния: единственный статический проп — className, всё
 * остальное (children/ref/DOM-атрибуты) несериализуемо и в схему не входит.
 */
export const kbdBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Kbd',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
