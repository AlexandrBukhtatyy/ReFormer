import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема ToggleGroup — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки. `x-registryName:
 * 'ToggleGroup'` — на этот вариант смотрит алиас `ToggleGroupField`.
 *
 * `value`/`onChange` переопределяют seam под string-контракт группы (выбранное `option.value`).
 */
export const toggleGroupBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'ToggleGroup',
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
      description: 'Варианты выбора. Каждый рендерится как кнопка-переключатель.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label }>', kind: 'readonly' },
    },
    variant: {
      type: 'string',
      enum: ['default', 'outline'],
      default: 'default',
      description: 'Визуальный стиль кнопок: плоские (default) или с рамкой (outline).',
      'x-doc': { group: 'Control', type: "'default' | 'outline'" },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера группы.',
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
