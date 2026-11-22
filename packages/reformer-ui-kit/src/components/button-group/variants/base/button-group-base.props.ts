import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `ButtonGroup` — единый источник api/props (reformer-doc) и
 * валидации `componentProps` (renderer-json). `ButtonGroup` — не form-control (нет seam/field/адаптера),
 * поэтому в схеме нет `x-runtimeProps`. `orientation` — значение cva-конфига (`buttonGroupVariants`),
 * дефолт из `defaultVariants`.
 *
 * `children` (compound: ButtonGroupText / ButtonGroupSeparator / кнопки) приходят из `children[]`
 * схемы рендера, а не из `componentProps`. `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'ButtonGroup'` — каноническое имя в реестре renderer-json.
 */
export const buttonGroupBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'ButtonGroup',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс группы кнопок (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    orientation: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Ориентация группы: горизонтальная (по умолчанию) или вертикальная (cva).',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
  },
} as const satisfies PropsSchema;
