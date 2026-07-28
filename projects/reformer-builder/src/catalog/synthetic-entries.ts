/**
 * Синтетические записи каталога (нет в `defaultPropSchemas`): презентационные `$html`-блоки и
 * палитровый **array** (спека §5/§6). Возвращаем сериализуемые {@link CatalogRecord} (без
 * `makeNode` — он восстанавливается из `role`/`name`).
 *
 * Список HTML-тегов и их props живут в {@link './html-tags'} (единый источник для палитры и
 * узла-по-умолчанию); здесь — только маппинг спецификаций в записи каталога.
 *
 * @module reformer-builder/catalog/synthetic-entries
 */

import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogRecord } from './types';
import { HTML_TAG_SPECS, htmlPropsSchema } from './html-tags';

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
  const html: CatalogRecord[] = HTML_TAG_SPECS.map((spec) => ({
    name: `$html(${spec.tag})`,
    role: 'container',
    category: 'HTML',
    propsSchema: htmlPropsSchema(spec),
  }));
  const array: CatalogRecord = {
    name: 'FormArray',
    role: 'array',
    category: 'Массив',
    propsSchema: arrayPropsSchema,
  };
  return [...html, array];
}
