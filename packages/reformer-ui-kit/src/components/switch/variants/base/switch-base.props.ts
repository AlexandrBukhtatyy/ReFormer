import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Switch — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Поверхность в DSL — `label` + `className`;
 * `additionalProperties: false` ловит опечатки. `x-registryName: 'Switch'` — алиас `SwitchField`.
 *
 * Inline-раскладка: `label` рисуется САМИМ контролом справа (FormField верхнюю метку не дублирует).
 */
export const switchBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Switch',
  properties: {
    label: {
      type: 'string',
      description:
        'Подпись справа от переключателя (inline-раскладка; FormField верхнюю метку не рисует).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс переключателя.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (value/onChange/onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'boolean',
      description: 'Состояние переключателя (true — включён). Резолвится формой.',
    },
    onChange: {
      group: 'Control',
      type: '(value: boolean) => void',
      description: 'Переключение; эмитит boolean (Radix onCheckedChange, indeterminate → false).',
    },
  },
} as const satisfies PropsSchema;
