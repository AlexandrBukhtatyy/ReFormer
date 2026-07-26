import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема `Avatar` — единый источник `api`/props (reformer-doc) и валидации
 * `componentProps` (renderer-json). `Avatar` — обёртка над Radix `Avatar.Root` (compound-набор),
 * не form-control: нет seam (`value`/`onChange`/`onBlur`/`disabled`), поэтому нет `x-runtimeProps`.
 * Изображение/фолбэк — под-компоненты (AvatarImage/AvatarFallback) из `children[]` схемы рендера,
 * а не пропсы Root: `src`/`alt` тут не фигурируют. Сериализуемые пропсы самого Root — `className`
 * и custom-размер `size`.
 *
 * `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'Avatar'` — каноническое имя в реестре renderer-json.
 */
export const avatarBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Avatar',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс аватара (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    size: {
      type: 'string',
      enum: ['default', 'sm', 'lg'],
      default: 'default',
      description: 'Размер аватара: sm (24px), default (32px), lg (40px).',
      'x-doc': { group: 'Behavior', type: "'default' | 'sm' | 'lg'", kind: 'enum' },
    },
  },
} as const satisfies PropsSchema;
