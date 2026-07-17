import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема NativeSelect — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Стилизованный native `<select>`: значение — строка (`option.value`),
 * пустой выбор → null (nativeInputAdapter). `x-registryName: 'NativeSelect'` — на него смотрит алиас
 * `NativeSelectField`.
 */
export const nativeSelectBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'NativeSelect',
  properties: {
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
      description: 'Опции списка. Одинаковый group объединяется в <optgroup>.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label; group? }>', kind: 'readonly' },
    },
    placeholder: {
      type: 'string',
      description: 'Подсказка-опция (value="") в начале списка.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс select.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Выбранное значение (option.value как строка). Пустой выбор → null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение. Пустой выбор (value="") → null.',
    },
  },
} as const satisfies PropsSchema;
