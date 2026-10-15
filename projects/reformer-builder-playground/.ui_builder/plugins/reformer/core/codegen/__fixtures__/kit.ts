/**
 * Фикстуры генерации: вид кита и пара схем.
 *
 * Кит настоящий (`@reformer/ui-kit` через `lib/catalog/__fixtures__`), потому что главная
 * проверка задачи — «имена берутся у кита, а не из литерала», и выдуманный каталог проверял бы
 * выдумку. Второй кит — синтетический: он нужен ровно затем, чтобы показать, что вывод
 * МЕНЯЕТСЯ вместе с китом.
 *
 * @module plugins/reformer/core/codegen/__fixtures__/kit
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { builtinCatalog } from '../../catalog/__fixtures__/builtin-catalog';
import { containerNode, fieldNode } from '../../catalog/make-node';
import type { CatalogEntry } from '../../catalog/types';
import type { FormRules } from '../../form-model/rules';
import { joinFormSchema, STEP_SCHEMA_MARKER, type StepOrigins } from '../../form-model/composite';
import { toDescriptor, type KitDescriptor } from '@reformer/builder-plugin-api';
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
        model: '$model(fullName)',
        component: '$component(Input)',
        componentProps: { label: 'Имя', required: true },
      },
      {
        model: '$model(agreed)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Согласен' },
      },
    ],
  };
  return { format: 2, version: '1.0', root };
}

/**
 * Схема с компонентами ЗА ПОДПУТЁМ кита: комбобокс, мультикомбобокс, выбор даты и карусель.
 *
 * У встроенного кита эти символы лежат не в главном входе, а в `@reformer/ui-kit/combobox`,
 * `…/date-picker`, `…/carousel`. Состав подобран по веткам импорта: два символа с ОДНОГО подпутя
 * (одна строка импорта, символы по алфавиту), символы с РАЗНЫХ подпутей (строки по алфавиту
 * спецификаторов), поле и контейнер (подпуть — не свойство полей), корень и части составного
 * компонента (у каждой записи свой подпуть, наследования нет) и обычное поле из главного входа
 * рядом — чтобы было видно, что главный вход печатается первым.
 */
export function subpathSchema(): JsonFormSchema {
  const root: JsonNode = {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        model: '$model(fullName)',
        component: '$component(Input)',
        componentProps: { label: 'Имя', required: true },
      },
      {
        model: '$model(birthDate)',
        component: '$component(DatePicker)',
        componentProps: { label: 'Дата рождения', dateFormat: 'dd.MM.yyyy' },
      },
      {
        model: '$model(position)',
        component: '$component(Combobox)',
        componentProps: { label: 'Должность', options: '$dataSource(POSITIONS)', clearable: true },
      },
      {
        model: '$model(skills)',
        component: '$component(ComboboxMulti)',
        componentProps: { label: 'Навыки', options: '$dataSource(SKILLS)', maxItems: 3 },
      },
      {
        component: '$component(Carousel)',
        children: [
          {
            component: '$component(CarouselContent)',
            children: [{ component: '$component(CarouselItem)', children: ['Слайд'] }],
          },
        ],
      },
    ],
  };
  return { format: 2, version: '1.0', root };
}

/** Схема с визардом: один шаг, одно поле. */
export function wizardSchema(): JsonFormSchema {
  const root: JsonNode = {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        children: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Шаг 1' },
            children: [
              {
                model: '$model(email)',
                component: '$component(Input)',
                componentProps: { label: 'Почта' },
              },
            ],
          },
        ],
      },
    ],
  };
  return { format: 2, version: '1.0', root };
}

/**
 * Чужой кит БЕЗ адаптеров визарда: ни `wizard`, ни `step`.
 *
 * Отдельная фикстура, а не сборка на месте, потому что этой комбинацией держится целая ветка
 * вывода: форма с визардом есть, а зарегистрировать его нечем — `schema/registry.ts` печатает
 * заглушку С ПРИЧИНОЙ вместо символа и для визарда, и для тела шага, а поток шагов и правила по
 * шагам печатаются как у любого визарда. Собранная инлайном в одном тесте (так было в
 * `generate.test.ts`), она не покрывала реестр вовсе.
 */
export function noWizardKit(): KitView {
  return foreignKit({ adapters: { wizard: null, step: null } });
}

/**
 * Затравочные правила формы — единственный вход в билдеры `@reformer/mcp`.
 *
 * Без них `validation/form.ts` и `behavior/index.ts` уезжают заготовками, то есть мост
 * `emit/rules-bridge` не исполняется ни в одном тесте вовсе. Состав подобран по ВЕТКАМ, а не
 * по правдоподобию: валидатор с аргументом (`minLength(2)`) поднимает `collectValidators`,
 * `when` — `validateWhen`, `computeFrom` с двумя источниками — вывод имён параметров колбэка,
 * `patchProps` с `$expr` рядом с литералом — различение выражения и JSON, а два `onEvent`
 * (синхронный и асинхронный) — обе формы заголовка обработчика и переотступ тела. Условия правил
 * узлов читают `form`, связь — `model`: вместе они держат выбор параметров области поведения.
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
 * Обнаружено снимками: на `plainSchema` и `wizardSchema` файл констант источников
 * (`constants/<форма>.ts`) уезжает ПУСТЫМ, то есть ни один цикл в нём, ни строка импорта
 * `SelectOption`, ни склейка блоков не проверялись вовсе. Здесь закрыты все три класса источника
 * сразу:
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
  const root = schema.root as unknown as { children: JsonNode[] };
  const first = root.children[0] as JsonNode & { children: JsonNode[] };
  first.children = [
    ...first.children,
    {
      model: '$model(comment)',
      component: '$component(Input)',
      componentProps: { label: 'Комментарий', placeholder: '$dataSource(HINT_TEXT)' },
    },
  ];
  return schema;
}

/**
 * Визард с ПРАВИЛАМИ формы: два шага и секция вне визарда.
 *
 * Держит ветку раскладки правил по шагам: правило про поле шага уходит в
 * `validation/<шаг>.ts` (`stepRules`), правило про поле вне шагов — в `crossStepRules` файла
 * `validation/form.ts`, правило узла шага — в группу шага единого поведения
 * (`behavior/index.ts`), узла вне шагов — в группу узлов вне шагов.
 */
export function wizardRulesSchema(): JsonFormSchema {
  const field = (path: string, label: string): JsonNode => ({
    model: `$model(${path})`,
    component: '$component(Input)',
    componentProps: { label },
  });
  const root: JsonNode = {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        children: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Данные' },
            children: [field('fullName', 'ФИО')],
          },
          {
            component: '$component(Step)',
            componentProps: { title: 'Контакты' },
            children: [field('contacts.email', 'Почта'), field('contacts.phone', 'Телефон')],
          },
        ],
      },
      {
        component: '$component(Section)',
        componentProps: { title: 'Дополнительно' },
        children: [field('comment', 'Комментарий')],
      },
    ],
  };
  return { format: 2, version: '1.0', root };
}

/** Правила к {@link wizardRulesSchema}: по одному в каждый шаг, одно вне шагов, render — шаг и корень. */
export function wizardRules(): FormRules {
  return {
    validation: [
      { target: 'fullName', rules: ['required', 'minLength(2)'] },
      { target: 'contacts.email', rules: ['required', 'email'] },
      {
        target: 'contacts.phone',
        rules: ['required'],
        when: 'model.contacts.email === null',
      },
      { target: 'comment', rules: ['maxLength(500)'] },
    ],
    behavior: [],
    render: [
      { kind: 'hideWhen', selector: 'kontakty-section', condition: '!form.fullName.value.value' },
      { kind: 'hideWhen', selector: 'dopolnitelno-section', condition: 'false' },
    ],
  };
}

/**
 * Визард с «трудными» заголовками шагов: кириллица, два одинаковых, пустой. Держит правило имени
 * папки шага (транслит, суффикс у совпадения, запасное имя без заголовка).
 */
export function wizardSlugsSchema(): JsonFormSchema {
  const step = (title: string | undefined, path: string): JsonNode => ({
    component: '$component(Step)',
    componentProps: title === undefined ? {} : { title },
    children: [
      {
        model: `$model(${path})`,
        component: '$component(Input)',
        componentProps: { label: path, required: true },
      },
    ],
  });
  const root: JsonNode = {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        children: [step('Контакты', 'phone'), step('Контакты', 'email'), step(undefined, 'note')],
      },
    ],
  };
  return { format: 2, version: '1.0', root };
}

/**
 * Визард, разбитый по шагам, в том виде, в каком его видит генерация: собранная схема и карта
 * происхождения шагов.
 *
 * Первый шаг лежит в `steps/anketa/` при заголовке «Данные» — папку задаёт ссылка, а не слаг
 * заголовка (шаг переименовали после разбиения). Второй шаг инлайн — его добавили в разбитую
 * форму, и он обязан получить свой файл `steps/kontakty/`.
 */
export function wizardSplitSource(): { schema: JsonFormSchema; origins: StepOrigins } {
  const step = (id: string, title: string, path: string): JsonNode =>
    ({
      component: '$component(Step)',
      componentProps: { title },
      $nodeId: id,
      children: [
        {
          model: `$model(${path})`,
          component: '$component(Input)',
          componentProps: { label: title, required: true },
          $nodeId: `${id.slice(0, 6)}0f`,
        },
      ],
    }) as JsonNode;
  const skeleton: JsonFormSchema = {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      $nodeId: 'root0000',
      children: [
        {
          component: '$component(Wizard)',
          $nodeId: 'wizard00',
          children: [
            { $ref: './steps/anketa/form.schema.json' },
            step('kontakt0', 'Контакты', 'email'),
          ],
        } as unknown as JsonNode,
      ],
    } as JsonNode,
  };
  const { schema, origins } = joinFormSchema(
    skeleton,
    new Map([
      [
        './steps/anketa/form.schema.json',
        { $schema: STEP_SCHEMA_MARKER, node: step('anketa00', 'Данные', 'name') },
      ],
    ])
  );
  return { schema, origins };
}

/**
 * Схема с правилами узлов ВНУТРИ СТРОК массивов: массив рекомендателей и вложенный в его строку
 * массив контактов.
 *
 * Держит раскладку правил по областям. Узел шаблона строки живёт в области строки, а не формы:
 * правило по его селектору обязано печататься в поведении строки и подключаться
 * `applyEach` — из корня для внешнего массива и из поведения внешней строки для вложенного.
 * Сам узел-массив при этом остаётся в области родителя: его селектор адресуется из корня.
 */
export function rowRulesSchema(): JsonFormSchema {
  const root: JsonNode = {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        model: '$model(hasReferences)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Есть рекомендатели' },
      },
      {
        selector: 'references',
        model: '$model(references)',
        component: '$component(FieldArray)',
        componentProps: { title: 'Рекомендатели' },
        initialValue: { name: '', noPhone: false, phone: '', contacts: [] },
        item: {
          $template: {
            component: '$component(Box)',
            componentProps: { className: 'space-y-2' },
            children: [
              {
                selector: 'ref-name',
                model: '$model(name)',
                component: '$component(Input)',
                componentProps: { label: 'Имя' },
              },
              {
                model: '$model(noPhone)',
                component: '$component(Checkbox)',
                componentProps: { label: 'Без телефона' },
              },
              {
                selector: 'ref-phone',
                model: '$model(phone)',
                component: '$component(Input)',
                componentProps: { label: 'Телефон' },
              },
              {
                selector: 'ref-contacts',
                model: '$model(contacts)',
                component: '$component(FieldArray)',
                componentProps: { title: 'Другие контакты' },
                initialValue: { value: '', hidden: false },
                item: {
                  $template: {
                    component: '$component(Box)',
                    componentProps: { className: 'flex gap-2' },
                    children: [
                      {
                        selector: 'contact-value',
                        model: '$model(value)',
                        component: '$component(Input)',
                        componentProps: { label: 'Контакт' },
                      },
                      {
                        model: '$model(hidden)',
                        component: '$component(Checkbox)',
                        componentProps: { label: 'Скрыть' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    ],
  } as unknown as JsonNode;
  return { format: 2, version: '1.0', root };
}

/**
 * Правила узлов для {@link rowRulesSchema} — по одному на каждую область.
 *
 * Условия читают `model`, и в каждой области это РАЗНАЯ модель: в корне — модель формы
 * (`hasReferences`), в строке рекомендателя — модель строки (`noPhone`), во вложенной строке —
 * модель контакта (`hidden`). Напечатанные не в своей области, два последних не собрались бы.
 */
export function rowRules(): FormRules {
  return {
    validation: [],
    behavior: [],
    render: [
      // Корень: сам узел-массив рисует родительская область.
      { kind: 'hideWhen', selector: 'references', condition: '!model.hasReferences' },
      // Строка рекомендателя.
      { kind: 'hideWhen', selector: 'ref-phone', condition: 'model.noPhone' },
      { kind: 'patchProps', selector: 'ref-name', props: { placeholder: 'Имя рекомендателя' } },
      // Строка вложенного массива контактов.
      { kind: 'hideWhen', selector: 'contact-value', condition: 'model.hidden' },
    ],
  };
}

/** Именованные части документа для {@link partsSchema} и {@link partsWizardSchema}. */
function partsOf(): Record<string, JsonNode> {
  const address: JsonNode = {
    component: '$component(Box)',
    componentProps: { className: 'space-y-2' },
    children: [
      {
        // Источник данных и компонент, которых нет в дереве корня: они обязаны доехать до
        // `constants/` и реестра из разметки части.
        model: '$model(region)',
        component: '$component(Select)',
        componentProps: { label: 'Регион', options: '$dataSource(REGIONS)' },
      },
      {
        model: '$model(city)',
        component: '$component(Input)',
        componentProps: { label: 'Город', required: true },
      },
      {
        model: '$model(noApartment)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Частный дом' },
      },
      {
        selector: 'address-apartment',
        model: '$model(apartment)',
        component: '$component(Input)',
        componentProps: { label: 'Квартира' },
      },
    ],
  } as unknown as JsonNode;
  const guest: JsonNode = {
    component: '$component(Box)',
    componentProps: { className: 'space-y-2' },
    children: [
      {
        selector: 'guest-name',
        model: '$model(name)',
        component: '$component(Input)',
        componentProps: { label: 'Имя', required: true },
      },
      {
        model: '$model(hasPhone)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Есть телефон' },
      },
      {
        selector: 'guest-phone',
        model: '$model(phone)',
        component: '$component(Input)',
        componentProps: { label: 'Телефон' },
      },
      // Часть внутри части: адрес гостя — третье подключение `address`, уже из области строки.
      { model: '$model(address)', part: '$part(address)' },
    ],
  } as unknown as JsonNode;
  return { address, guest };
}

/** Узлы формы с частями — общие для простой формы и для визарда. */
function partsNodes(): { addresses: JsonNode[]; guests: JsonNode[] } {
  const emptyAddress = { region: '', city: '', noApartment: false, apartment: '' };
  return {
    addresses: [
      {
        model: '$model(sameAddress)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Работаю из дома' },
      },
      // Одна часть под двумя группами модели.
      { model: '$model(home)', part: '$part(address)' },
      {
        selector: 'work-section',
        component: '$component(Section)',
        componentProps: { title: 'Рабочий адрес' },
        children: [{ model: '$model(work)', part: '$part(address)' }],
      },
    ] as unknown as JsonNode[],
    guests: [
      {
        // Часть — шаблон строки массива.
        selector: 'guests',
        model: '$model(guests)',
        component: '$component(FieldArray)',
        componentProps: { title: 'Гости' },
        initialValue: { name: '', hasPhone: false, phone: '', address: emptyAddress },
        item: '$part(guest)',
      },
    ] as unknown as JsonNode[],
  };
}

/**
 * Схема с ИМЕНОВАННЫМИ ЧАСТЯМИ документа: часть `address` подключена дважды подформой (`home`,
 * `work`) и третий раз — изнутри части `guest`; часть `guest` — шаблон строки массива `guests`.
 *
 * Держит чтение частей кодогеном: тип формы с подформами и строкой из части, начальные значения
 * групп, источник данных и компонент из разметки части, обязательные поля частей и области правил
 * (`apply` со списком групп, `applyEach` для массива, `apply` из поведения части).
 */
export function partsSchema(): JsonFormSchema {
  const { addresses, guests } = partsNodes();
  const root: JsonNode = {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [...addresses, ...guests],
  } as unknown as JsonNode;
  return { format: 2, version: '1.0', parts: partsOf(), root };
}

/**
 * Те же части в ВИЗАРДЕ: адреса — на первом шаге, гости — на втором.
 *
 * Держит раскладку по шагам: поле части считается полем шага, где часть смонтирована, — правило
 * на `home.city` уходит в правила шага «Адреса», а правило строки `guests` — в правила шага «Гости».
 */
export function partsWizardSchema(): JsonFormSchema {
  const { addresses, guests } = partsNodes();
  const root: JsonNode = {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        children: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Адреса' },
            children: addresses,
          },
          { component: '$component(Step)', componentProps: { title: 'Гости' }, children: guests },
        ],
      },
    ],
  } as unknown as JsonNode;
  return { format: 2, version: '1.0', parts: partsOf(), root };
}

/**
 * Правила к {@link partsSchema} и {@link partsWizardSchema}.
 *
 * Валидация — на поле части под группой (`home.city`) и на поле части-строки (`guests.name`).
 * Правила узлов — по одному на область: корень (`work-section`), часть `address`
 * (`address-apartment`) и часть `guest` (`guest-phone`, `guest-name`). Условия читают `model`, и в
 * каждой области это РАЗНАЯ модель: формы, одного адреса, одного гостя.
 */
export function partsRules(): FormRules {
  return {
    validation: [
      { target: 'home.city', rules: ['required'] },
      { target: 'guests.name', each: 'guests', rules: ['required', 'minLength(2)'] },
    ],
    behavior: [],
    render: [
      // Корень: секцию с подформой рисует область формы.
      { kind: 'hideWhen', selector: 'work-section', condition: 'model.sameAddress' },
      // Часть `address` — одна на три подключения.
      { kind: 'hideWhen', selector: 'address-apartment', condition: 'model.noApartment' },
      // Часть `guest` — шаблон строки.
      { kind: 'hideWhen', selector: 'guest-phone', condition: '!model.hasPhone' },
      { kind: 'patchProps', selector: 'guest-name', props: { placeholder: 'Имя гостя' } },
    ],
  };
}
