import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема Sheet (Radix Dialog.Root) — провайдер без DOM (className/side — на SheetContent). */
export const sheetBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Sheet',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыта ли панель изначально (неуправляемый режим).',
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
