import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема AspectRatio (Radix AspectRatio.Root) — держит контент в заданной пропорции. */
export const aspectRatioBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'AspectRatio',
  properties: {
    ratio: {
      type: 'number',
      default: 1,
      description: 'Соотношение сторон (ширина / высота), напр. 16/9 ≈ 1.78.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
