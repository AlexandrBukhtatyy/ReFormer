import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема Skeleton — плейсхолдер загрузки (div). Единственный сериализуемый проп — className. */
export const skeletonBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Skeleton',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind) — задаёт размеры плейсхолдера (h-*/w-*).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
