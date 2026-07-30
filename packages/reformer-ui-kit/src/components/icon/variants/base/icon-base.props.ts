import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема презентационного `Icon` — единый источник api/props и валидации `componentProps`.
 * `x-registryName: 'Icon'` — каноническое имя в реестре renderer-json. Иконка задаётся строкой-именем
 * lucide (`iconName`); билдер рендерит для этого поля пикер иконок (виджет по ключу `iconName`).
 */
export const iconBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Icon',
  properties: {
    iconName: {
      type: 'string',
      default: 'Circle',
      description: 'Имя иконки lucide (PascalCase, напр. Home, ArrowRight).',
      'x-doc': { group: 'Control', type: 'string' },
    },
    size: {
      type: 'number',
      default: 24,
      minimum: 8,
      description: 'Размер в пикселях.',
      'x-doc': { group: 'Control', type: 'number' },
    },
    color: {
      type: 'string',
      description: 'Цвет обводки (любой CSS-цвет; по умолчанию currentColor).',
      'x-doc': { group: 'Control', type: 'string' },
    },
    strokeWidth: {
      type: 'number',
      default: 2,
      minimum: 0.5,
      description: 'Толщина линий.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
