import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Marker (AI-примитив, порт shadcn/ui) — рендерит DOM-элемент <div> и пробрасывает
 * className, поэтому className в схеме. Единственный enum — variant (стиль оформления маркера).
 */
export const markerBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Marker',
  properties: {
    variant: {
      type: 'string',
      enum: ['default', 'separator', 'border'],
      default: 'default',
      description: 'Вариант оформления маркера.',
      'x-doc': { group: 'Behavior', type: "'default' | 'separator' | 'border'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
