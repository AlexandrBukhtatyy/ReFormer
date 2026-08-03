import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема Resizable (react-resizable-panels ResizablePanelGroup — экспорт не «Resizable»). */
export const resizableBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Resizable',
  properties: {
    direction: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Направление разделения панелей.',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
