import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Badge` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Badge'` — каноническое имя в реестре renderer-json.
 * Реальные сериализуемые пропсы: `className` + cva-`variant`
 * (default | secondary | destructive | outline | ghost | link). `asChild` не сериализуем.
 */
export const badgeBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Badge',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс бейджа (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    variant: {
      type: 'string',
      enum: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
      default: 'default',
      description: 'Визуальный вариант бейджа.',
      'x-doc': {
        group: 'Behavior',
        type: "'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'",
        kind: 'enum',
      },
    },
  },
} as const satisfies PropsSchema;
