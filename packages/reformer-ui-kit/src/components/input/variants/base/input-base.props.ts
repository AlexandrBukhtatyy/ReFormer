import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Input. `type` enum включает `number` и `date` (боевая форма использует `type: 'date'` ×4 —
 * v6-контракт их не заявлял, из-за чего JSON-DSL пропускал невалид). `x-registryName: 'Input'` — алиас InputField.
 */
export const inputBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Input',
  properties: {
    type: {
      type: 'string',
      enum: ['text', 'email', 'tel', 'url', 'password', 'number', 'date'],
      default: 'text',
      description: 'HTML-тип input. number включает числовой буфер, остальные — строковые.',
      'x-doc': {
        group: 'Textfield',
        type: "'text' | 'email' | 'number' | 'date' | …",
        kind: 'enum',
      },
    },
    placeholder: {
      type: 'string',
      description: 'Подсказка внутри поля.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    min: {
      type: 'number',
      description: 'Минимум (type=number). При min>=0 отрицательные значения зажимаются к 0.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    max: {
      type: 'number',
      description: 'Максимум (type=number).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    step: {
      type: 'number',
      description: 'Шаг (type=number).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    value: {
      group: 'Control',
      type: 'string | number | null',
      description: 'Значение поля. Для type=number — number|null, иначе string|null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | number | null) => void',
      description:
        'Изменение. Пустой ввод → null. Для number частичный ввод («-», «1.») не эмитится.',
    },
  },
} as const satisfies PropsSchema;
