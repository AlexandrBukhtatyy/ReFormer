import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Accordion` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Accordion'` — каноническое имя в реестре renderer-json.
 * Accordion — обёртка над Radix `Accordion.Root`; сериализуемые пропсы взяты из его API.
 */
export const accordionBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Accordion',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс контейнера аккордеона (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    type: {
      type: 'string',
      enum: ['single', 'multiple'],
      description: 'Режим раскрытия: одна секция за раз (single) или несколько (multiple).',
      'x-doc': { group: 'Behavior', type: "'single' | 'multiple'", kind: 'enum' },
    },
    collapsible: {
      type: 'boolean',
      description: 'В режиме single разрешить закрыть открытую секцию (не оставлять всегда одну открытой).',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
    defaultValue: {
      type: 'string',
      description: 'Значение(-я) секции, открытой по умолчанию (uncontrolled).',
      'x-doc': { group: 'Behavior', type: 'string | string[]' },
    },
    disabled: {
      type: 'boolean',
      description: 'Заблокировать взаимодействие со всеми секциями.',
      'x-doc': { group: 'Behavior', type: 'boolean', kind: 'boolean' },
    },
    orientation: {
      type: 'string',
      enum: ['vertical', 'horizontal'],
      default: 'vertical',
      description: 'Ориентация раскладки секций.',
      'x-doc': { group: 'Behavior', type: "'vertical' | 'horizontal'", kind: 'enum' },
    },
  },
} as const satisfies PropsSchema;
