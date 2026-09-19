import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Input (registry `Input`, компонент `Input`) — строковое поле. `type` включает
 * `date` (боевая форма использует `type: 'date'`). Числовое поле — отдельный вариант `InputNumber`,
 * поле с подсказками — `InputSuggest`.
 */
export const inputBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Input',
  'x-variantGroup': 'Input',
  'x-variant': 'Текст',
  properties: {
    type: {
      type: 'string',
      enum: ['text', 'email', 'tel', 'url', 'password', 'date'],
      default: 'text',
      description: 'HTML-тип input. Для чисел — вариант InputNumber.',
      'x-doc': {
        group: 'Textfield',
        type: "'text' | 'email' | 'tel' | 'url' | 'password' | 'date'",
        kind: 'enum',
      },
    },
    placeholder: {
      type: 'string',
      description: 'Подсказка внутри поля.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    readOnly: {
      type: 'boolean',
      default: false,
      description:
        'Значение видно и уходит с формой, но не редактируется. Отличие от disabled: поле остаётся фокусируемым и не выглядит выключенным.',
      'x-doc': { group: 'State', type: 'boolean' },
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
      type: 'string | null',
      description: 'Значение поля. Пустой ввод — null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение. Пустой ввод → null.',
    },
  },
} as const satisfies PropsSchema;
