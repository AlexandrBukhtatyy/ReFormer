import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема AlertDialog (Radix AlertDialog.Root) — контекст-провайдер без DOM, поэтому НЕ несёт
 * className (стили/размер — на AlertDialogContent). AlertDialog всегда модальный (Radix убирает `modal`),
 * поэтому такого пропа нет. Управляемое состояние (open/onOpenChange) — runtime, не в схеме.
 */
export const alertDialogBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'AlertDialog',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыт ли диалог изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
