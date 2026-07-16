import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Section — единый источник `props[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Section — DSL-контейнер (не form-control): у него нет
 * seam (`value`/`onChange`/`onBlur`/`disabled`), поэтому нет `x-runtimeProps` и field-версии.
 * Реальная поверхность в DSL — 4 сериализуемых ключа; `children` — не `componentProps`, а
 * отдельный массив дочерних нод листа (валидатор его не касается).
 *
 * `additionalProperties: false` ловит опечатки (`titel` вместо `title`).
 * `x-registryName: 'Section'` — каноническое имя в реестре renderer-json.
 */
export const sectionBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Section',
  properties: {
    title: {
      type: 'string',
      description: 'Заголовок секции. Не задан — заголовок не рендерится (только обёртка).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    titleAs: {
      type: 'string',
      enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      default: 'h3',
      description: 'HTML-элемент заголовка (уровень h1-h6).',
      'x-doc': { group: 'Behavior', type: "'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'", kind: 'enum' },
    },
    titleClassName: {
      type: 'string',
      description: 'Доп. CSS-класс заголовка.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера `<section>` (напр. `grid grid-cols-2 gap-4`).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
