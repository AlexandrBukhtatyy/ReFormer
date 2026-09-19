import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема InputNumber (registry `InputNumber`) — числовое поле с сырым буфером ввода.
 * `value`/`onChange` переопределяют seam под `number | null`.
 */
export const inputNumberPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputNumber',
  'x-variantGroup': 'Input',
  'x-variant': 'Число',
  properties: {
    placeholder: {
      type: 'string',
      description: 'Подсказка внутри поля.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    min: {
      type: 'number',
      description: 'Минимум. При min>=0 отрицательные значения зажимаются к 0.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    max: {
      type: 'number',
      description: 'Максимум.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    step: {
      type: 'number',
      description: 'Шаг.',
      'x-doc': { group: 'Behavior', type: 'number' },
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
      type: 'number | null',
      description: 'Текущее число. null — пусто.',
    },
    onChange: {
      group: 'Control',
      type: '(value: number | null) => void',
      description: 'Изменение. Пустой ввод → null; частичный ввод («-», «1.») не эмитится.',
    },
  },
} as const satisfies PropsSchema;
