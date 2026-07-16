import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема InputPassword — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Реальная поверхность в DSL — 3 ключа; `additionalProperties: false`
 * ловит опечатки (`lable` вместо `label` подмешивается враппером).
 *
 * `x-registryName: 'InputPassword'` — на эту схему смотрит алиас `InputPasswordField`.
 */
export const inputPasswordBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputPassword',
  properties: {
    placeholder: {
      type: 'string',
      default: 'Password',
      description: 'Подсказка внутри поля.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    showToggle: {
      type: 'boolean',
      default: true,
      description:
        'Показывать иконку переключения видимости (eye/eye-off). Появляется при непустом value.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (value/onChange/onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Значение пароля. null/пусто — пустое поле.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение. Пустой ввод приводится к null.',
    },
  },
} as const satisfies PropsSchema;
