import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Message (shadcn AI chat message) — контейнер одного сообщения (обычный <div>,
 * пробрасывает className). Из статики есть только выравнивание строки и className;
 * children/аватар/заголовок задаются вложенными под-частями, не пропсами.
 */
export const messageBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Message',
  properties: {
    align: {
      type: 'string',
      enum: ['start', 'end'],
      default: 'start',
      description: 'Сторона выравнивания сообщения (end — своё сообщение справа).',
      'x-doc': { group: 'Behavior', type: "'start' | 'end'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
