import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Menubar (Radix Menubar.Root) — рендерит DOM-контейнер меню-бара, поэтому несёт
 * className. Управляемое состояние (value/onValueChange/defaultValue — какое меню открыто) — runtime,
 * в схему не входит. Статически задаются только направление (dir) и зацикливание фокуса (loop).
 */
export const menubarBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Menubar',
  properties: {
    dir: {
      type: 'string',
      enum: ['ltr', 'rtl'],
      default: 'ltr',
      description: 'Направление чтения (влияет на навигацию стрелками).',
      'x-doc': { group: 'Behavior', type: "'ltr' | 'rtl'", kind: 'enum' },
    },
    loop: {
      type: 'boolean',
      default: false,
      description: 'Зациклить перемещение фокуса стрелками по краям.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
