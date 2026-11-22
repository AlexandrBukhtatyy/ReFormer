import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема DSL-контейнера `Box` — единый источник `api`/props (reformer-doc) и
 * валидации `componentProps` в renderer-json. `Box` — не form-control (нет seam/field/адаптера),
 * поэтому в схеме нет `x-runtimeProps`: единственный сериализуемый проп — `className`.
 *
 * `children` в схеме НЕ фигурирует: дочерние ноды приходят из `children[]` схемы рендера,
 * а не из `componentProps`. `additionalProperties: false` ловит опечатки в DSL.
 *
 * `x-registryName: 'Box'` — каноническое имя в реестре renderer-json.
 */
export const boxBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Box',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс layout-контейнера (atomic CSS / Tailwind: flex, grid, gap-*).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
