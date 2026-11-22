import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема Item — контейнер-строка списка (рендерит div со стилями cva variant/size). */
export const itemBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Item',
  properties: {
    variant: {
      type: 'string',
      enum: ['default', 'outline', 'muted'],
      default: 'default',
      description: 'Визуальный стиль: прозрачный, с рамкой или приглушённый фон.',
      'x-doc': { group: 'Behavior', type: "'default' | 'outline' | 'muted'", kind: 'enum' },
    },
    size: {
      type: 'string',
      enum: ['default', 'sm'],
      default: 'default',
      description: 'Размер отступов и зазоров внутри строки.',
      'x-doc': { group: 'Behavior', type: "'default' | 'sm'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
