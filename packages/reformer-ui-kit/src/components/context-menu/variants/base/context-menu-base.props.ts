import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема ContextMenu (Radix ContextMenu.Root) — контекст-провайдер без DOM, поэтому НЕ несёт
 * className (стили/размеры — на ContextMenuContent). Открытие по правому клику: управляемого open нет,
 * onOpenChange — runtime-колбэк, в схему не входит. Статически задаём dir и modal.
 */
export const contextMenuBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'ContextMenu',
  properties: {
    dir: {
      type: 'string',
      enum: ['ltr', 'rtl'],
      default: 'ltr',
      description: 'Направление чтения — влияет на раскладку и навигацию с клавиатуры.',
      'x-doc': { group: 'Behavior', type: "'ltr' | 'rtl'", kind: 'enum' },
    },
    modal: {
      type: 'boolean',
      default: true,
      description: 'Модальный режим — блокирует взаимодействие с фоном при открытом меню.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
