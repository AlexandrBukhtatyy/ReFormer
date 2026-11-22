import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Dialog (Radix Dialog.Root) — контекст-провайдер без DOM, поэтому НЕ несёт className
 * (стили/размеры — на DialogContent). Управляемое состояние (open/onOpenChange) — runtime, не в схеме.
 */
export const dialogBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Dialog',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыт ли диалог изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    modal: {
      type: 'boolean',
      default: true,
      description: 'Модальный режим — блокирует взаимодействие с фоном.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
