import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема варианта `select/async` — единый источник `api.controls[]` (reformer-doc) и
 * DSL-валидации `componentProps` (renderer-json). Реальная поверхность в DSL — 4 ключа;
 * `additionalProperties: false` ловит опечатки (`lable` вместо `label` подмешивается враппером).
 *
 * `x-registryName: 'Select'` — на этот вариант смотрит алиас `SelectField`.
 */
export const selectAsyncPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Select',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс триггера.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    options: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'label'],
        additionalProperties: false,
        properties: {
          value: { type: ['string', 'number'] },
          label: { type: 'string' },
          group: { type: 'string' },
        },
      },
      description: 'Inline-опции. Одинаковый group объединяется в секцию SelectLabel.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label; group? }>', kind: 'readonly' },
    },
    placeholder: {
      type: 'string',
      default: 'Select an option...',
      description: 'Подсказка в триггере.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    clearable: {
      type: 'boolean',
      default: false,
      description: 'Показывать крестик очистки (сброс в null).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (value/onChange/onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Выбранное значение (option.value). null — ничего не выбрано.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Выбор; при очистке приходит null.',
    },
    resource: {
      group: 'Options',
      type: 'ResourceConfig<unknown>',
      description:
        'Асинхронный источник опций (static / preload / partial). В JSON-форме недостижим: требует функцию load.',
    },
  },
} as const satisfies PropsSchema;
