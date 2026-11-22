import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Label` — единый источник api/props и валидации componentProps.
 * `x-registryName: 'Label'` — каноническое имя в реестре renderer-json.
 * `Label` — дословный порт shadcn поверх Radix `LabelPrimitive.Root` (рендерит `<label>`):
 * сериализуемые пропсы — `className` + нативный `htmlFor`.
 */
export const labelBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Label',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс подписи (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    htmlFor: {
      type: 'string',
      description: 'id связанного контрола (атрибут `for` тега `<label>`).',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
  },
} as const satisfies PropsSchema;
