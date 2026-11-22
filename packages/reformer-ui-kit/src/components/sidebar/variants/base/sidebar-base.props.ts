import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Sidebar (лейаут-компонент). Требует SidebarProvider-контекст в рантайме; в превью —
 * заглушка. Управление open/onOpenChange — на провайдере (runtime), не в схеме.
 */
export const sidebarBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Sidebar',
  properties: {
    side: {
      type: 'string',
      enum: ['left', 'right'],
      default: 'left',
      description: 'Сторона размещения.',
      'x-doc': { group: 'Behavior', type: "'left' | 'right'", kind: 'enum' },
    },
    variant: {
      type: 'string',
      enum: ['sidebar', 'floating', 'inset'],
      default: 'sidebar',
      description: 'Вариант оформления.',
      'x-doc': { group: 'Behavior', type: "'sidebar' | 'floating' | 'inset'", kind: 'enum' },
    },
    collapsible: {
      type: 'string',
      enum: ['offcanvas', 'icon', 'none'],
      default: 'offcanvas',
      description: 'Режим сворачивания.',
      'x-doc': { group: 'Behavior', type: "'offcanvas' | 'icon' | 'none'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
