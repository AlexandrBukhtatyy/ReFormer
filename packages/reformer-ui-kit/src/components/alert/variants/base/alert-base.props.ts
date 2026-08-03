import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Alert` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Alert'` — каноническое имя в реестре renderer-json.
 * Реальные сериализуемые пропсы: `className` + cva-`variant` (default | destructive).
 */
export const alertBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Alert',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс контейнера алерта (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    variant: {
      type: 'string',
      enum: ['default', 'destructive'],
      default: 'default',
      description: 'Визуальный тон алерта.',
      'x-doc': { group: 'Behavior', type: "'default' | 'destructive'", kind: 'enum' },
    },
  },
} as const satisfies PropsSchema;
