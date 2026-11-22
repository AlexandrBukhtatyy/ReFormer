import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Spinner — презентационный индикатор загрузки поверх lucide Loader2Icon.
 * Собственных сериализуемых пропсов нет: принимает только SVG-атрибуты, размер задаётся
 * через className (size-*). Поэтому единственный статический проп — className.
 */
export const spinnerBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Spinner',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind); размер задаётся через size-* (по умолчанию size-4).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
