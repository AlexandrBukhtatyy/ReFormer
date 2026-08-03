import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема Carousel (embla). Инлайн-конфиг (opts/plugins/setApi) несериализуем — не в схеме. */
export const carouselBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Carousel',
  properties: {
    orientation: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Ориентация прокрутки карусели.',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
