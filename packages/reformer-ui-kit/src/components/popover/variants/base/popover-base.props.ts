import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Popover (Radix Popover.Root) — контекст-провайдер без DOM, поэтому НЕ несёт className
 * (стили/позиционирование — на PopoverContent). Управляемое состояние (open/onOpenChange) — runtime, не в схеме.
 */
export const popoverBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Popover',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыт ли поповер изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    modal: {
      type: 'boolean',
      default: false,
      description: 'Модальный режим — блокирует взаимодействие с фоном и ловит фокус.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
