/**
 * Синтетические записи каталога (нет в `defaultPropSchemas`): презентационные `$html`-блоки и
 * палитровый **array** (спека §5/§6). Возвращаем сериализуемые {@link CatalogRecord} (без
 * `makeNode` — он восстанавливается из `role`/`name`).
 *
 * @module reformer-builder/catalog/synthetic-entries
 */

import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogRecord } from './types';

const HTML_TAGS = ['div', 'section', 'fieldset', 'h3', 'p', 'hr'] as const;
const HTML_CONTAINERS = new Set<string>(['div', 'section', 'fieldset']);

const classNameProp: PropsSchema = {
  type: 'string',
  description: 'CSS-класс (Tailwind: flex, grid, gap-*).',
  'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
};

function htmlPropsSchema(tag: string): PropsSchema {
  const properties: Record<string, PropsSchema> = { className: classNameProp };
  if (!HTML_CONTAINERS.has(tag) && tag !== 'hr') {
    properties.text = {
      type: 'string',
      description: 'Текстовое содержимое.',
      'x-doc': { group: 'Control', type: 'string' },
    };
  }
  return { type: 'object', properties };
}

const arrayPropsSchema: PropsSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
    addButtonLabel: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
    emptyMessage: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
    itemLabel: {
      type: 'string',
      description: 'Подпись элемента: строка или $dataSource/$fn.',
      'x-doc': { group: 'Options', type: 'string' },
    },
    reorderable: { type: 'boolean', 'x-doc': { group: 'Behavior', type: 'boolean' } },
    minItems: { type: 'number', 'x-doc': { group: 'Behavior', type: 'number' } },
    maxItems: { type: 'number', 'x-doc': { group: 'Behavior', type: 'number' } },
  },
};

/** Синтетические записи каталога (HTML-блоки + array). */
export function syntheticRecords(): CatalogRecord[] {
  const html: CatalogRecord[] = HTML_TAGS.map((tag) => ({
    name: `$html(${tag})`,
    role: 'container',
    category: 'HTML',
    propsSchema: htmlPropsSchema(tag),
  }));
  const array: CatalogRecord = {
    name: 'FormArray',
    role: 'array',
    category: 'Массив',
    propsSchema: arrayPropsSchema,
  };
  return [...html, array];
}
