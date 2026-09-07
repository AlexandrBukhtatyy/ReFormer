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
    // Тот же `TextareaHTMLAttributes`, что и `rows`: держать один и отклонять другой нечем
    // обосновать. Схема — закрытый список (`additionalProperties: false`), поэтому пропуск
    // здесь означал `has unknown property "maxLength"` в JSON-DSL при том, что проза ui-kit
    // этот проп описывала, а рантайм пропускал. Ограничение длины ПРАВИЛОМ (`maxLength(500)`
    // в схеме валидации) — отдельная вещь: атрибут не даёт ввести лишнее, правило сообщает
    // об ошибке.
    maxLength: {
      type: 'number',
      description: 'Максимальная длина ввода (HTML-атрибут maxLength). Не заменяет валидацию.',
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
