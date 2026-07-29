import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема HoverCard (Radix HoverCard.Root) — контекст-провайдер без DOM, поэтому НЕ несёт className
 * (стили/размеры — на HoverCardContent). Управляемое состояние (open/onOpenChange) — runtime, не в схеме.
 * Остаются задержки открытия/закрытия и неуправляемый defaultOpen.
 */
export const hoverCardBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'HoverCard',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Открыта ли карточка изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    openDelay: {
      type: 'number',
      default: 700,
      description: 'Задержка (мс) перед открытием при наведении.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    closeDelay: {
      type: 'number',
      default: 300,
      description: 'Задержка (мс) перед закрытием при уходе курсора.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
  },
} as const satisfies PropsSchema;
