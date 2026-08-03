import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема DropdownMenu (Radix DropdownMenu.Root) — контекст-провайдер без DOM, поэтому НЕ несёт
 * className (стили/размеры — на DropdownMenuContent). Управляемое состояние (open/onOpenChange) — runtime, не в схеме.
 */
export const dropdownMenuBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'DropdownMenu',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыто ли меню изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    modal: {
      type: 'boolean',
      default: true,
      description: 'Модальный режим — блокирует взаимодействие с фоном, пока меню открыто.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    dir: {
      type: 'string',
      enum: ['ltr', 'rtl'],
      description: 'Направление чтения — влияет на раскладку и навигацию клавиатурой.',
      'x-doc': { group: 'Behavior', type: "'ltr' | 'rtl'", kind: 'enum' },
    },
  },
} as const satisfies PropsSchema;
