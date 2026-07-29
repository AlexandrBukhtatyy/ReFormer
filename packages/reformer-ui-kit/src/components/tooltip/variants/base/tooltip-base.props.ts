import type { PropsSchema } from '@/fields/props-schema';

/** Props-схема Tooltip (Radix Tooltip.Root) — провайдер без DOM (стили/позиция — на TooltipContent). */
export const tooltipBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Tooltip',
  properties: {
    defaultOpen: {
      type: 'boolean',
      default: false,
      description: 'Показан ли тултип изначально (неуправляемый режим).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    delayDuration: {
      type: 'number',
      default: 700,
      description: 'Задержка перед показом (мс).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    disableHoverableContent: {
      type: 'boolean',
      default: false,
      description: 'Скрывать тултип при уходе курсора с триггера (нельзя навести на сам тултип).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
} as const satisfies PropsSchema;
