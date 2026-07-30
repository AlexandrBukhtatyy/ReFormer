import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема ScrollArea (Radix ScrollArea.Root) — кастомные скроллбары над контентом. */
export const scrollAreaBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'ScrollArea',
  properties: {
    type: {
      type: 'string',
      enum: ['auto', 'always', 'scroll', 'hover'],
      default: 'hover',
      description: 'Когда показывать скроллбары.',
      'x-doc': { group: 'Behavior', type: "'auto' | 'always' | 'scroll' | 'hover'", kind: 'enum' },
    },
    scrollHideDelay: {
      type: 'number',
      default: 600,
      description: 'Задержка скрытия скроллбаров (мс) — для type=hover/scroll.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
