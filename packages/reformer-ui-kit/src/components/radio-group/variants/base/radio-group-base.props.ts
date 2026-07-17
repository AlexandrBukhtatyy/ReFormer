import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема RadioGroup — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки. `x-registryName:
 * 'RadioGroup'` — на этот вариант смотрит алиас `RadioGroupField`.
 *
 * `value`/`onChange` переопределяют seam под string-контракт группы (выбранное `option.value`).
 */
export const radioGroupBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'RadioGroup',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'label'],
        additionalProperties: false,
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
        },
      },
      description: 'Варианты выбора. Каждый рендерится как radio + подпись справа.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label }>', kind: 'readonly' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера группы (по умолчанию grid gap-3).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Выбранное значение (option.value). null — ничего не выбрано.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Выбор варианта; пустой выбор → null.',
    },
  },
} as const satisfies PropsSchema;
