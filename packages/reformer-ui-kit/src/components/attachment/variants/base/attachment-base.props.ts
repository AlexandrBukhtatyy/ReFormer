import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Attachment (корневой `<div data-slot="attachment">`) — презентационный
 * чип/превью прикреплённого файла. Root рендерит DOM-элемент и пробрасывает className,
 * поэтому сериализуемые пропсы — только визуальные enum'ы (state/size/orientation) + className;
 * контент задаётся суб-компонентами (Media/Content/Title/…), а не пропсами Root.
 */
export const attachmentBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Attachment',
  properties: {
    state: {
      type: 'string',
      enum: ['idle', 'uploading', 'processing', 'error', 'done'],
      default: 'done',
      description: 'Состояние загрузки/обработки файла — влияет на стили рамки и анимацию.',
      'x-doc': {
        group: 'Behavior',
        type: "'idle' | 'uploading' | 'processing' | 'error' | 'done'",
        kind: 'enum',
      },
    },
    size: {
      type: 'string',
      enum: ['default', 'sm', 'xs'],
      default: 'default',
      description: 'Размер чипа (отступы и типографика).',
      'x-doc': { group: 'Behavior', type: "'default' | 'sm' | 'xs'", kind: 'enum' },
    },
    orientation: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Ориентация: горизонтальный чип или вертикальная карточка.',
      'x-doc': { group: 'Behavior', type: "'horizontal' | 'vertical'", kind: 'enum' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
