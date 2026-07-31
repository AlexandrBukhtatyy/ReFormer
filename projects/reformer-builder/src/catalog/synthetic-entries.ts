/**
 * Синтетические записи каталога (нет в `defaultPropSchemas`): презентационные `$html`-блоки,
 * палитровый **array** и палитровый **wizard** (`Wizard` + шаг `Step`) — всё то, что билдер
 * поставляет сам, минуя ui-kit-каталог (спека §5/§6). Возвращаем сериализуемые {@link CatalogRecord}
 * (без `makeNode` — он восстанавливается из `role`/`name` в {@link './make-node'}).
 *
 * Список HTML-тегов и их props живут в {@link './html-tags'} (единый источник для палитры и
 * узла-по-умолчанию); здесь — только маппинг спецификаций в записи каталога.
 *
 * @module reformer-builder/catalog/synthetic-entries
 */

import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { SyntheticConfig } from '../config/types';
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

/**
 * Props визарда — минимум: класс контейнера. Шаги живут в `componentProps.steps` и правятся
 * структурно на canvas, а не через инспектор.
 */
const wizardPropsSchema: PropsSchema = {
  type: 'object',
  properties: {
    className: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
  },
};

/** Props шага визарда: подпись и иконка (показываются в индикаторе шагов). */
const stepPropsSchema: PropsSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
    icon: {
      type: 'string',
      description: 'Иконка шага: эмодзи или строка.',
      'x-doc': { group: 'Control', type: 'string' },
    },
  },
};

/**
 * Синтетические записи каталога (HTML-блоки + array + wizard/step). Клиентский конфиг
 * ({@link SyntheticConfig}) может отключить целые группы или сузить набор HTML-тегов; без конфига —
 * полный набор (поведение как раньше).
 */
export function syntheticRecords(cfg?: SyntheticConfig): CatalogRecord[] {
  const specs =
    cfg?.htmlTags && cfg.htmlTags.length
      ? HTML_TAG_SPECS.filter((s) => cfg.htmlTags!.includes(s.tag))
      : HTML_TAG_SPECS;
  const html: CatalogRecord[] =
    cfg?.html === false
      ? []
      : specs.map((spec) => ({
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
  // Wizard держит шаги в `componentProps.steps` (не в `children`); Step — контейнер тела шага.
  // Оба роли `container`: kindOf → container, что нужно для makeNode/childSlots.
  const wizard: CatalogRecord = {
    name: 'Wizard',
    role: 'container',
    category: 'Мастер',
    propsSchema: wizardPropsSchema,
  };
  const step: CatalogRecord = {
    name: 'Step',
    role: 'container',
    category: 'Мастер',
    propsSchema: stepPropsSchema,
  };
  const out: CatalogRecord[] = [...html];
  if (cfg?.formArray !== false) out.push(array);
  if (cfg?.wizard !== false) out.push(wizard, step);
  return out;
}
