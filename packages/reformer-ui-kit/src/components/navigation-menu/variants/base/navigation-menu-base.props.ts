import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема NavigationMenu (Radix NavigationMenu.Root) — рендерит DOM-элемент <nav> и пробрасывает
 * className, поэтому className входит в схему. Управляемое состояние (value/onValueChange) — runtime,
 * не в схеме. Сериализуемые статические пропсы: viewport, orientation, dir, тайминги задержек.
 */
export const navigationMenuBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'NavigationMenu',
  properties: {
    orientation: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Ориентация меню.',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
    dir: {
      type: 'string',
      enum: ['ltr', 'rtl'],
      description: 'Направление письма (слева-направо / справа-налево).',
      'x-doc': { group: 'Behavior', type: "'ltr' | 'rtl'", kind: 'enum' },
    },
    viewport: {
      type: 'boolean',
      default: true,
      description:
        'Рендерить общий Viewport-оверлей для контента (иначе контент под каждым пунктом).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    delayDuration: {
      type: 'number',
      default: 200,
      description: 'Задержка (мс) перед открытием меню при наведении.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    skipDelayDuration: {
      type: 'number',
      default: 300,
      description:
        'Окно (мс), в течение которого переход между пунктами открывает меню без задержки.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
