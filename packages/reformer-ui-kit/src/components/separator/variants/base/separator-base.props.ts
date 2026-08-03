import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Separator` — единый источник api/props (reformer-doc) и
 * валидации `componentProps` (renderer-json). `Separator` — обёртка над Radix `Separator.Root`
 * (не form-control), поэтому в схеме нет `x-runtimeProps`.
 *
 * `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'Separator'` — каноническое имя в реестре renderer-json.
 */
export const separatorBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Separator',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс разделителя (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    orientation: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Ориентация разделителя: горизонтальный (по умолчанию) или вертикальный.',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
    decorative: {
      type: 'boolean',
      default: true,
      description:
        'Декоративный ли разделитель. true (по умолчанию) — скрыт от AT; false — семантический separator.',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
