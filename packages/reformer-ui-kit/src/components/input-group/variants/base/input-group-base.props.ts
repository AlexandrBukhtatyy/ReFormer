import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема `InputGroup` — единый источник `api`/props (reformer-doc) и валидации
 * `componentProps` (renderer-json). `InputGroup` — презентационная обёртка над `<div role="group">`
 * (композиция контролов с аддонами), не form-control: нет seam (`value`/`onChange`/`onBlur`/
 * `disabled`), поэтому нет `x-runtimeProps`. Единственный сериализуемый проп самого контейнера —
 * `className`; под-компоненты (InputGroupAddon/InputGroupButton/…) и их дочерние ноды приходят из
 * `children[]` схемы рендера, а не из `componentProps`.
 *
 * `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'InputGroup'` — каноническое имя в реестре renderer-json.
 */
export const inputGroupBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputGroup',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс контейнера-группы (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
