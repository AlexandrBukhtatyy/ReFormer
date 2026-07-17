import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Checkbox — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `x-registryName: 'Checkbox'` — на этот вариант смотрит алиас
 * `CheckboxField`.
 *
 * `label` объявлен и здесь (не только во враппере): для inline-контрола подпись рендерит САМ
 * field-компонент (FormField верхнюю подпись подавляет), поэтому она приходит как `componentProps.label`.
 * `value`/`onChange` переопределяют seam под boolean-контракт чекбокса.
 */
export const checkboxBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Checkbox',
  properties: {
    label: {
      type: 'string',
      description: 'Подпись справа от чекбокса (inline-раскладка). Рендерит сам контрол.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контрола (CheckboxPrimitive.Root).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'boolean',
      description: 'Состояние чекбокса. undefined/null трактуется как false.',
    },
    onChange: {
      group: 'Control',
      type: '(value: boolean) => void',
      description: 'Изменение. indeterminate приводится к false.',
    },
  },
} as const satisfies PropsSchema;
