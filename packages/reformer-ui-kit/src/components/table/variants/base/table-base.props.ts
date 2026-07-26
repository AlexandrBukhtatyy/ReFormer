import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Table` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Table'` — каноническое имя в реестре renderer-json.
 * Корень `Table` — чистый `ComponentProps<'table'>` (дословный shadcn, без cva/Radix):
 * единственный сериализуемый проп — `className`.
 */
export const tableBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Table',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс таблицы (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
