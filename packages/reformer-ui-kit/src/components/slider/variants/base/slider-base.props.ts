import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Slider — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Поверхность в DSL — `min`/`max`/`step` (диапазон Radix)
 * + `className`; `additionalProperties: false` ловит опечатки. `x-registryName: 'Slider'` —
 * на этот вариант смотрит алиас `SliderField`.
 *
 * `value`/`onChange` скалярны (`number | null`): base — Radix `value: number[]` /
 * `onValueChange(number[])`, но `sliderAdapter` сводит одно-thumb режим к числу.
 */
export const sliderBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Slider',
  properties: {
    min: {
      type: 'number',
      default: 0,
      description: 'Минимум диапазона (Radix min).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    max: {
      type: 'number',
      default: 100,
      description: 'Максимум диапазона (Radix max).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    step: {
      type: 'number',
      default: 1,
      description: 'Шаг изменения значения (Radix step).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс слайдера (SliderPrimitive.Root).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'number | null',
      description: 'Значение слайдера (одно-thumb). null трактуется как min. Резолвится формой.',
    },
    onChange: {
      group: 'Control',
      type: '(value: number | null) => void',
      description: 'Изменение; эмитит первое число массива Radix (onValueChange → arr[0]).',
    },
  },
} as const satisfies PropsSchema;
