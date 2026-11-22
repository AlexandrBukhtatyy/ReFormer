import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Button` — единый источник api/props (reformer-doc) и
 * валидации `componentProps` (renderer-json). `Button` — не form-control (нет seam/field/адаптера),
 * поэтому в схеме нет `x-runtimeProps`. `variant`/`size` — значения cva-конфига (`buttonVariants`),
 * дефолты из `defaultVariants`.
 *
 * `children` (текст/иконки) приходят из `children[]` схемы рендера, а не из `componentProps`.
 * `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'Button'` — каноническое имя в реестре renderer-json.
 */
export const buttonBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Button',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс кнопки (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    variant: {
      type: 'string',
      enum: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      default: 'default',
      description: 'Визуальный вариант кнопки (cva).',
      'x-doc': {
        group: 'Behavior',
        type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'",
        kind: 'enum',
      },
    },
    size: {
      type: 'string',
      enum: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
      default: 'default',
      description: 'Размер кнопки (cva); icon-* — квадратные для иконок без текста.',
      'x-doc': {
        group: 'Behavior',
        type: "'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'",
        kind: 'enum',
      },
    },
    type: {
      type: 'string',
      enum: ['button', 'submit', 'reset'],
      description: 'HTML-тип кнопки: button | submit | reset.',
      'x-doc': { group: 'Behavior', type: "'button' | 'submit' | 'reset'", kind: 'enum' },
    },
    disabled: {
      type: 'boolean',
      description: 'Заблокировать кнопку.',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
