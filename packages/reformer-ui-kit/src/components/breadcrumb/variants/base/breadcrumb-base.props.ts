import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Breadcrumb (Root) — семантический `<nav aria-label="breadcrumb">`.
 * Презентационный compound-контейнер без Radix-примитива и без form-состояния: Root
 * лишь оборачивает список хлебных крошек. Своих enum/boolean/number-пропсов у него нет,
 * поэтому единственный статический сериализуемый проп — className (пробрасывается в `<nav>`).
 */
export const breadcrumbBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Breadcrumb',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
