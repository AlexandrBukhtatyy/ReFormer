import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Tabs` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Tabs'` — каноническое имя в реестре renderer-json.
 * Tabs — обёртка над Radix `Tabs.Root`; сериализуемые пропсы взяты из его API
 * (обёртка задаёт default `orientation='horizontal'`). cva-`variant` живёт на `TabsList`, не на Root.
 */
export const tabsBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Tabs',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс контейнера табов (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    defaultValue: {
      type: 'string',
      description: 'Значение вкладки, активной по умолчанию (uncontrolled).',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    orientation: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Ориентация раскладки табов.',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
    activationMode: {
      type: 'string',
      enum: ['automatic', 'manual'],
      default: 'automatic',
      description: 'Активировать вкладку при фокусе (automatic) или только по клику/Enter (manual).',
      'x-doc': { group: 'Behavior', type: "'automatic' | 'manual'", kind: 'enum' },
    },
  },
} as const satisfies PropsSchema;
