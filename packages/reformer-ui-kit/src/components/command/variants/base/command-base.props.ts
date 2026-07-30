import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Command (cmdk CommandPrimitive) — корень командного меню, рендерит DOM-обёртку
 * (div) и пробрасывает className. Управляемое состояние (value/defaultValue/onValueChange) и
 * кастомный filter — runtime, не в схеме. В схеме только статические булевы-переключатели поведения.
 */
export const commandBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Command',
  properties: {
    shouldFilter: {
      type: 'boolean',
      default: true,
      description: 'Авто-фильтрация и сортировка по поисковому запросу.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    loop: {
      type: 'boolean',
      default: false,
      description: 'Зацикливать навигацию стрелками (с конца — в начало).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    disablePointerSelection: {
      type: 'boolean',
      default: false,
      description: 'Отключить выбор пункта наведением мыши.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    vimBindings: {
      type: 'boolean',
      default: true,
      description: 'Vim-хоткеи навигации (ctrl+n/j/p/k).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
