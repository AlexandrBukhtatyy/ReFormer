import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Tooltip (Radix Tooltip.Root) — провайдер без DOM (стили/позиция — на TooltipContent).
 * `TooltipProvider` выше по дереву не обязателен: без него Tooltip ставит провайдер кита сам.
 */
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
      default: 0,
      description:
        'Задержка перед показом (мс). Не задана — берётся из TooltipProvider; провайдер кита ' +
        '(и тот, что Tooltip ставит сам без внешнего) — 0 мс.',
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
