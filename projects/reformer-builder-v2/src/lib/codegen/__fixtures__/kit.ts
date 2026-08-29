/**
 * Фикстуры генерации: вид кита и пара схем.
 *
 * Кит настоящий (`@reformer/ui-kit` через `lib/catalog/__fixtures__`), потому что главная
 * проверка задачи — «имена берутся у кита, а не из литерала», и выдуманный каталог проверял бы
 * выдумку. Второй кит — синтетический: он нужен ровно затем, чтобы показать, что вывод
 * МЕНЯЕТСЯ вместе с китом.
 *
 * @module reformer-builder/lib/codegen/__fixtures__/kit
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { builtinCatalog } from '../../catalog/__fixtures__/builtin-catalog';
import { containerNode, fieldNode } from '../../catalog/make-node';
import type { CatalogEntry } from '../../catalog/types';
import { toDescriptor } from '../../kits/descriptor';
import type { KitDescriptor } from '../../kits/types';
import type { KitView } from '../components';

/** Вид встроенного кита: настоящий каталог и настоящий дескриптор. */
export function builtinKit(): KitView {
  const built = builtinCatalog();
  return { kit: built.descriptor, catalog: built.entries };
}

/**
 * Чужой кит: другой пакет, другие имена экспорта, свой адаптер визарда.
 *
 * Каталог из двух записей — больше и не нужно: проверяется не полнота, а то, что импорты
 * и символы приезжают ОТСЮДА.
 */
export function foreignKit(overrides?: Partial<KitDescriptor>): KitView {
  const descriptor = toDescriptor({
    version: '2.0',
    components: [
      { name: 'Input', role: 'field', propsSchema: {}, exportName: 'HexInput' },
      { name: 'Box', role: 'container', propsSchema: {}, exportName: 'HexBox' },
    ],
    kit: {
      id: 'hexa-ui',
      label: 'HexaUI',
      package: '@hexa/ui',
      infra: { fieldWrapper: 'HexField', asyncBoundary: 'HexAsync', list: 'HexList' },
      adapters: { wizard: { symbol: 'HexWizard', subpath: 'wizard' }, step: null },
      codegen: { importSpecifier: '@hexa/ui', needsShim: ['Wizard', 'Step'] },
    },
  });
  const catalog: CatalogEntry[] = [
    {
      name: 'Input',
      role: 'field',
      propsSchema: {},
      exportName: 'HexInput',
      makeNode: () => fieldNode('Input'),
    },
    {
      name: 'Box',
      role: 'container',
      propsSchema: {},
      exportName: 'HexBox',
      makeNode: () => containerNode('Box'),
    },
  ];
  return { kit: { ...descriptor, ...overrides }, catalog };
}

/** Схема без визарда: контейнер и два поля, одно обязательное. */
export function plainSchema(): JsonFormSchema {
  const root: JsonNode = {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4', title: 'Личные данные' },
    children: [
      {
        value: '$model(fullName)',
        component: '$component(Input)',
        componentProps: { label: 'Имя', required: true },
      },
      {
        value: '$model(agreed)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Согласен' },
      },
    ],
  };
  return { version: '1.0', root };
}

/** Схема с визардом: один шаг, одно поле. */
export function wizardSchema(): JsonFormSchema {
  const root: JsonNode = {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        componentProps: {
          steps: [
            {
              component: '$component(Step)',
              componentProps: { title: 'Шаг 1' },
              children: [
                {
                  value: '$model(email)',
                  component: '$component(Input)',
                  componentProps: { label: 'Почта' },
                },
              ],
            },
          ],
        },
      },
    ],
  };
  return { version: '1.0', root };
}
