import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Drawer (vaul Drawer.Root) — контекст-провайдер без DOM (className/стили — на DrawerContent).
 * Оставлены практичные конфиг-пропсы; низкоуровневые vaul-флаги (scrollLock/bodyStyles/…) не выносим.
 */
export const drawerBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Drawer',
  properties: {
    direction: {
      type: 'string',
      enum: ['top', 'bottom', 'left', 'right'],
      default: 'bottom',
      description: 'Сторона появления шторки.',
      'x-doc': { group: 'Behavior', type: "'top' | 'bottom' | 'left' | 'right'", kind: 'enum' },
    },
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыта ли шторка изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    modal: {
      type: 'boolean',
      default: true,
      description: 'Модальный режим — блокирует взаимодействие с фоном.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    dismissible: {
      type: 'boolean',
      default: true,
      description: 'Можно ли закрыть свайпом/кликом по фону.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    handleOnly: {
      type: 'boolean',
      default: false,
      description: 'Тянуть только за «ручку», а не за весь контент.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
