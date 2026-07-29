import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Bubble (shadcn AI-примитив пузыря сообщения чата) — Root рендерит <div> и
 * пробрасывает className. Статические cva-пропсы: variant (оформление) и align (сторона).
 */
export const bubbleBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Bubble',
  properties: {
    variant: {
      type: 'string',
      enum: ['default', 'secondary', 'muted', 'tinted', 'outline', 'ghost', 'destructive'],
      default: 'default',
      description: 'Вариант оформления пузыря.',
      'x-doc': {
        group: 'Behavior',
        type: "'default' | 'secondary' | 'muted' | 'tinted' | 'outline' | 'ghost' | 'destructive'",
        kind: 'enum',
      },
    },
    align: {
      type: 'string',
      enum: ['start', 'end'],
      default: 'start',
      description: 'Сторона выравнивания пузыря (start — слева, end — справа).',
      'x-doc': { group: 'Behavior', type: "'start' | 'end'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
