/**
 * Фикстуры генерации: вид кита и пара схем.
 *
 * Кит настоящий (`@reformer/ui-kit` через `lib/catalog/__fixtures__`), потому что главная
 * проверка задачи — «имена берутся у кита, а не из литерала», и выдуманный каталог проверял бы
 * выдумку. Второй кит — синтетический: он нужен ровно затем, чтобы показать, что вывод
 * МЕНЯЕТСЯ вместе с китом.
 *
 * @module lib/codegen/__fixtures__/kit
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { builtinCatalog } from '../../catalog/__fixtures__/builtin-catalog';
import { containerNode, fieldNode } from '../../catalog/make-node';
import type { CatalogEntry } from '../../catalog/types';
import type { FormRules } from '../../form-model/rules';
import { toDescriptor } from '../../kits/descriptor';
import type { KitDescriptor } from '../../kits/types';
import type { KitView } from '../components';
import { sampleSchema } from '../../form-model/__fixtures__/sample-schema';

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

/**
 * Чужой кит БЕЗ адаптеров визарда: ни `wizard`, ни `step`.
 *
 * Отдельная фикстура, а не сборка на месте, потому что этой комбинацией держится целая ветка
 * вывода: форма с визардом есть, шима напечатать нечем — цель `codegen.wizard` не применяется,
 * а `registry.ts` печатает заглушку С ПРИЧИНОЙ вместо символа. Собранная инлайном в одном тесте
 * (так было в `generate.test.ts`), она не покрывала ни `registry.ts`, ни `renderer.behavior.ts`.
 */
export function noWizardKit(): KitView {
  return foreignKit({ adapters: { wizard: null, step: null } });
}

/**
 * Затравочные правила формы — единственный вход в билдеры `@reformer/mcp`.
 *
 * Без них `validation.ts` и `form.behavior.ts` уезжают заглушками, то есть мост
 * `emit/rules-bridge` не исполняется ни в одном тесте вовсе. Состав подобран по ВЕТКАМ, а не
 * по правдоподобию: валидатор с аргументом (`minLength(2)`) поднимает `collectValidators`,
 * `when` — `validateWhen`, `computeFrom` с двумя источниками — вывод имён параметров колбэка,
 * `patchProps` с `$expr` рядом с литералом — различение выражения и JSON, а два `onEvent`
 * (синхронный и асинхронный) — обе формы заголовка обработчика и переотступ тела.
 *
 * Пути — настоящие пути {@link plainSchema}: правило по несуществующему полю напечаталось бы
 * так же, но перестало бы быть примером формы, которую можно собрать.
 */
export function seededRules(): FormRules {
  return {
    validation: [
      { target: 'fullName', rules: ['required', 'minLength(2)'] },
      { target: 'agreed', rules: ['required'], when: 'model.fullName !== null' },
    ],
    behavior: [
      {
        kind: 'computeFrom',
        target: 'agreed',
        sources: ['fullName'],
        expr: 'fullName !== null && fullName.length > 1',
      },
    ],
    render: [
      {
        kind: 'hideWhen',
        selector: 'lichnye-dannye-section',
        condition: '!form.agreed.value.value',
      },
      {
        kind: 'patchProps',
        selector: 'full-name',
        props: {
          placeholder: 'Иванов Иван',
          maxLength: 64,
          disabled: '$expr(!form.agreed.value.value)',
        },
      },
      {
        kind: 'onEvent',
        selector: 'full-name',
        event: 'onBlur',
        body: "const value = form.fullName.value.value;\nconsole.info('[golden] blur', value);",
      },
      {
        kind: 'onEvent',
        selector: 'full-name',
        event: 'onFocus',
        body: 'await Promise.resolve();',
        async: true,
      },
    ],
  };
}

/**
 * Схема с ИСТОЧНИКАМИ ДАННЫХ и массивом — то, чего нет ни в одной схеме выше.
 *
 * Обнаружено снимками: на `plainSchema` и `wizardSchema` файл `data-sources.ts` уезжает
 * ПУСТЫМ, то есть ни один цикл в нём, ни строка импорта `SelectOption`, ни склейка блоков
 * не проверялись вовсе. Здесь закрыты все три класса источника сразу:
 *
 * - `LOAN_TYPES` — список опций (`options` у Select);
 * - `PROP_LABEL` — подпись элемента массива, ей нужна ФУНКЦИЯ, а не массив;
 * - `HINT_TEXT` — скаляр: имя есть в схеме, но ни в списке, ни в подписи.
 *
 * Заодно приезжают массив с шаблоном элемента и визард с двумя шагами — их раскладка
 * тоже нигде не удерживалась.
 */
export function richSchema(): JsonFormSchema {
  const schema = sampleSchema();
  const root = schema.root as unknown as { componentProps: { steps: JsonNode[] } };
  const steps = root.componentProps.steps;
  const first = steps[0] as JsonNode & { children: JsonNode[] };
  first.children = [
    ...first.children,
    {
      value: '$model(comment)',
      component: '$component(Input)',
      componentProps: { label: 'Комментарий', placeholder: '$dataSource(HINT_TEXT)' },
    },
  ];
  return schema;
}
