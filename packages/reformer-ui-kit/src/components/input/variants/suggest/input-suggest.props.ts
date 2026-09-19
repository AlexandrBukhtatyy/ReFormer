import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема InputSuggest (registry `InputSuggest`) — свободный текст с подсказками. Значение
 * остаётся строкой: выбор подсказки лишь подставляет её `value`.
 */
export const inputSuggestPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputSuggest',
  'x-variantGroup': 'Input',
  'x-variant': 'Подсказки',
  properties: {
    type: {
      type: 'string',
      enum: ['text', 'email', 'tel', 'url'],
      default: 'text',
      description: 'HTML-тип input.',
      'x-doc': { group: 'Textfield', type: "'text' | 'email' | 'tel' | 'url'", kind: 'enum' },
    },
    placeholder: {
      type: 'string',
      description: 'Подсказка внутри поля.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    suggestions: {
      type: 'array',
      items: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            required: ['value'],
            additionalProperties: false,
            properties: {
              value: { type: 'string' },
              label: { type: 'string' },
            },
          },
        ],
      },
      description:
        'Подсказки при вводе: строки или { value, label? }. Значение остаётся свободным текстом — выбор подсказки лишь подставляет её value. Из кода можно передать и асинхронный ResourceConfig (как у Select), в JSON — через $dataSource.',
      'x-doc': {
        group: 'Options',
        type: 'Array<string | { value; label? }> | ResourceConfig',
        kind: 'readonly',
      },
    },
    minChars: {
      type: 'number',
      default: 0,
      description: 'С какой длины введённого текста показывать подсказки.',
      'x-doc': { group: 'Options', type: 'number' },
    },
    openOnFocus: {
      type: 'boolean',
      default: false,
      description: 'Раскрывать подсказки при фокусе, не дожидаясь ввода.',
      'x-doc': { group: 'Options', type: 'boolean' },
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
      description: 'Введённый текст. Пустой ввод — null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение текста (ввод или выбор подсказки). Пустой ввод → null.',
    },
    filter: {
      group: 'Options',
      type: '(option: NormalizedOption, query: string) => boolean',
      description:
        'Свой предикат совпадения подсказки. По умолчанию — подстрока label без учёта регистра.',
    },
  },
} as const satisfies PropsSchema;
