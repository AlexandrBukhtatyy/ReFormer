import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Toggle — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Поверхность в DSL — `variant`/`size`/`className`;
 * `additionalProperties: false` ловит опечатки. `x-registryName: 'Toggle'` — алиас `ToggleField`.
 *
 * НЕ inline-label: подпись поля рисует FormField сверху (`componentProps.label`), контент toggle —
 * через `children` (несериализуемый, в схему не выносится). `value`/`onChange` переопределяют seam
 * под boolean-контракт (Radix `pressed`/`onPressedChange`).
 */
export const toggleBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Toggle',
  properties: {
    variant: {
      type: 'string',
      enum: ['default', 'outline'],
      default: 'default',
      description: 'Стиль cva: default (заливка при нажатии) | outline (граница).',
      'x-doc': { group: 'Control', type: "'default' | 'outline'", kind: 'enum' },
    },
    size: {
      type: 'string',
      enum: ['default', 'sm', 'lg'],
      default: 'default',
      description: 'Размер cva: default | sm | lg.',
      'x-doc': { group: 'Control', type: "'default' | 'sm' | 'lg'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контрола (TogglePrimitive.Root).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'boolean',
      description:
        'Состояние (true — нажат/pressed). undefined/null трактуется как false. Резолвится формой.',
    },
    onChange: {
      group: 'Control',
      type: '(value: boolean) => void',
      description: 'Переключение; эмитит boolean (Radix onPressedChange).',
    },
  },
} as const satisfies PropsSchema;
