import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Textarea — многострочный аналог Input (native textarea). Единый источник
 * `api.controls[]` (reformer-doc) и DSL-валидации `componentProps` (renderer-json).
 * `x-registryName: 'Textarea'` — на этот вариант смотрит алиас TextareaField.
 */
export const textareaBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Textarea',
  properties: {
    placeholder: {
      type: 'string',
      description: 'Подсказка внутри поля.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    rows: {
      type: 'number',
      description: 'Число видимых строк (HTML-атрибут rows).',
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
      type: 'string | null',
      description: 'Значение поля. Пустой ввод → null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение. Пустой ввод → null.',
    },
  },
} as const satisfies PropsSchema;
