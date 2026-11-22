import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Collapsible` — единый источник api/props (reformer-doc) и
 * валидации `componentProps` (renderer-json). `Collapsible` — обёртка над Radix `Collapsible.Root`
 * (не form-control: нет seam/field/адаптера), поэтому в схеме нет `x-runtimeProps`.
 *
 * `children` (compound: CollapsibleTrigger / CollapsibleContent) приходят из `children[]` схемы
 * рендера, а не из `componentProps`. `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'Collapsible'` — каноническое имя в реестре renderer-json.
 */
export const collapsibleBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Collapsible',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс контейнера collapsible (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    defaultOpen: {
      type: 'boolean',
      description: 'Раскрыт ли collapsible по умолчанию (uncontrolled).',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
    disabled: {
      type: 'boolean',
      description: 'Заблокировать раскрытие/сворачивание.',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
