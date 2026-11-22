/**
 * Затравки встроенных шаблонов: анкета одной страницей и она же в три шага.
 *
 * ## Зачем в затравке столько полей
 *
 * Шаблон берут, чтобы доработать форму копированием: продублировал поле — получил новое, удалил —
 * убрал лишнее. Поэтому в анкете по ОДНОМУ образцу каждого вида поля с нетривиальным API: маска,
 * число с границами, выбор даты, радиогруппа, список из источника данных, комбобокс с поиском,
 * мультикомбобокс с потолком числа выбранных, многострочный текст, загрузка файлов, флажок,
 * массив со строкой-шаблоном и подписью строки. Затравка из пяти одинаковых `Input` показывала,
 * что механизм работает, но скопировать из неё было нечего.
 *
 * ## Комбобокс и выбор даты — с подпутей кита
 *
 * У встроенного кита `Combobox`, `ComboboxMulti` и `DatePicker` лежат не в главном входе, а в
 * `@reformer/ui-kit/combobox` и `…/date-picker`: за ними тяжёлые зависимости. Каталог кита
 * называет подпуть записи, кодоген печатает импорт оттуда, а превью берёт символ из пространства
 * имён кита — поэтому поле из шаблона и рисуется, и собирается у пользователя. Раньше их место
 * занимали ввод с подсказками, мультивыбор и `Input` с типом `date`: импорт комбобокса из
 * главного входа не компилировался. Теперь образец один на вид: список — `Select`, список с
 * поиском — `Combobox`, набор — `ComboboxMulti`.
 *
 * ## Поле — одна запись
 *
 * Запись {@link SeedField} держит всё, что едет вместе с полем: узел схемы, правило валидации,
 * источник данных, вычисление. Схема, правила формы и данные источников ВЫВОДЯТСЯ из одного
 * списка записей, поэтому убрать поле — значит убрать одну запись: правила про поле, которого
 * нет, остаться не могут. Тем же способом затравка подстраивается под кит.
 *
 * ## Затравка следует каталогу кита
 *
 * Кит вправе не поставлять половину компонентов (в HexaUI полей шесть, масок и дат нет вовсе).
 * Поле, чьего компонента нет в каталоге активного кита, в затравку не кладётся, а проп, которого
 * каталог компоненту не объявил, — не пишется: иначе реестр модуля уехал бы с заглушками на месте
 * полей, а редактор схемы встретил бы свежесозданную форму диагностиками. Каталог приходит
 * параметром ({@link SeedKit}); без него затравка собирается целиком.
 *
 * Массив — особый случай: запись массива билдер добавляет к каталогу любого кита сам, а рисует
 * массив компонент кита. Нет его у кита — массива в затравке нет вовсе, вместе с флажком, который
 * существует ради него ({@link SeedKit.array}).
 *
 * ## Узлы — фабриками домена
 *
 * Что такое поле, массив, шаг и визард, знает каталог (`@/plugins/reformer/core/catalog`): затравка
 * берёт заготовку узла у фабрики и дописывает своё. Так «пошаговая форма» остаётся пошаговой,
 * даже когда изменится внутреннее устройство узла-визарда.
 *
 * @module plugins/reformer/templates/seeds
 */

import type { KitDescriptor } from '@reformer/builder-plugin-api';
import type { JsonFieldNode, JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  arrayNode,
  containerNode,
  FORM_ROOT_CLASS,
  fieldNode,
  stepNode,
  wizardNode,
  type CatalogEntry,
} from '../../core/catalog';
import { defaultForField } from '../../core/codegen';
import { ARRAY_COMPONENT_NAME, emptySchema, type FormRules } from '../../core/form-model';

// ── Кит глазами затравки ────────────────────────────────────────────────────

/** Активный кит в объёме четырёх вопросов затравки. */
export interface SeedKit {
  /** Есть ли компонент в каталоге — то есть предлагает ли его палитра. */
  has(component: string): boolean;
  /** Пропсы, которые каталог объявил компоненту; `null` — список не закрыт. */
  declared(component: string): ReadonlySet<string> | null;
  /**
   * Есть ли у кита чем нарисовать массив: компонент секции массива (`FieldArray`) в его
   * собственном каталоге.
   *
   * Наличия записи в каталоге мало — запись массива билдер добавляет к каталогу ЛЮБОГО кита
   * (узел-массив — его собственный вид узла). Отличает кит узел, который создаёт палитра: с
   * компонентом массива он несёт `component`, без него — нет (`arrayNode` каталога). У кита без
   * такого компонента узел затравки ссылался бы на символ, которого в пакете кита нет: реестр
   * модуля уехал бы с несуществующим импортом.
   */
  readonly array: boolean;
  /**
   * Есть ли у кита чем нарисовать пошаговую форму: узел визарда и узел шага в каталоге И
   * адаптер визарда у самого кита.
   *
   * Каталога мало: узлы `Wizard` и `Step` билдер добавляет к каталогу любого кита сам, а рисует
   * визард компонент кита. У кита без адаптера кодоген регистрирует визард заглушкой — такая
   * форма показывает все шаги разом и не отправляется вовсе, потому что отправляет её визард.
   */
  readonly wizard: boolean;
}

/** Имена узлов пошаговой формы в каталоге. */
const WIZARD_NODES: readonly string[] = ['Wizard', 'Step'];

/**
 * Кит по записям каталога и дескриптору. `undefined` — каталога нет (кит ещё не доехал): сказать
 * о компонентах нечего, и затравка собирается целиком.
 *
 * @param descriptor - Дескриптор кита: по нему решается, есть ли адаптер визарда. Не дан —
 *   считается, что есть: без дескриптора отказать не на чем.
 */
export function seedKitOf(
  catalog: readonly CatalogEntry[],
  descriptor?: Pick<KitDescriptor, 'adapters'> | null
): SeedKit | undefined {
  if (catalog.length === 0) return undefined;
  const byName = new Map(catalog.map((entry) => [entry.name, entry]));
  const hasAdapter = descriptor == null || (descriptor.adapters.wizard ?? null) !== null;
  // Узел массива из палитры: компонент на нём ставит фабрика каталога, и только киту, который
  // его поставляет. Читается сырое свойство — у узла-массива без `component` домен называет
  // компонентом само имя записи, и по нему кит с компонентом от кита без него не отличить.
  const arrayDraft = byName.get(ARRAY_COMPONENT_NAME)?.makeNode() as
    | { readonly component?: unknown }
    | undefined;
  return {
    array: typeof arrayDraft?.component === 'string',
    wizard: hasAdapter && WIZARD_NODES.every((name) => byName.has(name)),
    has: (component) => byName.has(component),
    declared: (component) => {
      const schema = byName.get(component)?.propsSchema as
        | { properties?: Record<string, unknown>; additionalProperties?: unknown }
        | undefined;
      // Закрытым список делает `additionalProperties: false`: только тогда лишний проп — ошибка.
      if (schema === undefined || schema.additionalProperties !== false) return null;
      return new Set(Object.keys(schema.properties ?? {}));
    },
  };
}

// ── Записи затравки ─────────────────────────────────────────────────────────

/** Опция списка — как её печатает `constants/<форма>.ts`. */
interface SeedOption {
  readonly value: string;
  readonly label: string;
}

/** Источник данных списка: имя в схеме (`$dataSource(имя)`) и настоящие значения. */
interface SeedSource {
  readonly name: string;
  readonly options: readonly SeedOption[];
}

/** Поле затравки и всё, что едет вместе с ним. */
interface SeedField {
  readonly kind: 'field';
  /** Путь модели; у поля строки массива — от строки. */
  readonly path: string;
  /** Имя записи каталога кита. */
  readonly component: string;
  readonly props: Readonly<Record<string, unknown>>;
  /** Валидаторы `@reformer/core/validators` — в том виде, в каком их несут правила формы. */
  readonly rules?: readonly string[];
  /** Список опций из источника данных: уходит пропом `options`. */
  readonly source?: SeedSource;
  /** Вычисляемое поле: значение собирается из других полей. */
  readonly computed?: { readonly sources: readonly string[]; readonly expr: string };
  /** Путь узла, ради которого поле существует: без него поле в форму не кладётся. */
  readonly servesFor?: string;
  /** Значение для фикстуры предпросмотра. В начальные значения модуля не попадает. */
  readonly sample?: unknown;
}

/** Массив затравки: секция со строками по шаблону. */
interface SeedArray {
  readonly kind: 'array';
  readonly path: string;
  /** Селектор узла — по нему массив адресует правило видимости. */
  readonly selector: string;
  readonly props: Readonly<Record<string, unknown>>;
  /** Имя источника-функции, подписывающей строку. */
  readonly itemLabel: string;
  /** Класс контейнера строки. */
  readonly rowClassName: string;
  /** Поля строки. */
  readonly row: readonly SeedField[];
  /** Путь флажка: пока он не отмечен, массив скрыт и выключен — его строки не проверяются. */
  readonly shownWhen?: string;
}

type SeedItem = SeedField | SeedArray;

/** Группа полей: секция простой формы, она же шаг пошаговой. */
interface SeedGroup {
  /** Основа селектора: `<id>-section` у секции, `<id>-step` у шага. */
  readonly id: string;
  /** Заголовок секции. */
  readonly section: string;
  /** Заголовок шага. */
  readonly step: string;
  readonly items: readonly SeedItem[];
}

/** Маска телефона — одна на поле формы и на поле строки массива. */
const PHONE_MASK = '+7 (999) 999-99-99';

const GENDERS: SeedSource = {
  name: 'GENDERS',
  options: [
    { value: 'male', label: 'Мужской' },
    { value: 'female', label: 'Женский' },
  ],
};

const CITY_LIST: SeedSource = {
  name: 'CITY_LIST',
  options: [
    { value: 'msk', label: 'Москва' },
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'nsk', label: 'Новосибирск' },
  ],
};

const POSITIONS: SeedSource = {
  name: 'POSITIONS',
  options: [
    { value: 'developer', label: 'Разработчик' },
    { value: 'analyst', label: 'Аналитик' },
    { value: 'designer', label: 'Дизайнер' },
    { value: 'manager', label: 'Руководитель проекта' },
  ],
};

const SKILLS: SeedSource = {
  name: 'SKILLS',
  options: [
    { value: 'typescript', label: 'TypeScript' },
    { value: 'react', label: 'React' },
    { value: 'sql', label: 'SQL' },
    { value: 'figma', label: 'Figma' },
    { value: 'english', label: 'Английский язык' },
  ],
};

/**
 * Состав анкеты. Порядок записей — порядок полей на форме.
 *
 * Связей между полями ровно две, и обе названы в записях: вычисляемое «Полное имя» (`computed`)
 * и рекомендатели, скрытые и выключенные до отметки флажка (`shownWhen` / `servesFor`).
 * Остальные поля друг о друге не знают — любое убирается, не задев соседей.
 */
const GROUPS: readonly SeedGroup[] = [
  {
    id: 'personal',
    section: 'Личные данные',
    step: 'Данные',
    items: [
      {
        kind: 'field',
        path: 'lastName',
        component: 'Input',
        props: { label: 'Фамилия', placeholder: 'Иванов', required: true },
        rules: ['required'],
        sample: 'Иванов',
      },
      {
        kind: 'field',
        path: 'firstName',
        component: 'Input',
        props: { label: 'Имя', placeholder: 'Иван', required: true },
        rules: ['required'],
        sample: 'Иван',
      },
      {
        kind: 'field',
        path: 'fullName',
        component: 'Input',
        props: {
          label: 'Полное имя',
          description: 'Собирается из фамилии и имени',
          readOnly: true,
        },
        computed: {
          sources: ['lastName', 'firstName'],
          expr: "[lastName, firstName].filter(Boolean).join(' ')",
        },
      },
      {
        kind: 'field',
        path: 'birthDate',
        component: 'DatePicker',
        // Значение поля — `Date | null`: календарь кладёт в модель дату, а не строку.
        // `dateFormat` — как дата показана на кнопке (токены date-fns).
        props: { label: 'Дата рождения', placeholder: 'ДД.ММ.ГГГГ', dateFormat: 'dd.MM.yyyy' },
        rules: ['pastDate'],
      },
      {
        kind: 'field',
        path: 'gender',
        component: 'RadioGroup',
        props: { label: 'Пол' },
        source: GENDERS,
      },
    ],
  },
  {
    id: 'contacts',
    section: 'Контакты',
    step: 'Контакты',
    items: [
      {
        kind: 'field',
        path: 'phone',
        component: 'InputMask',
        props: { label: 'Телефон', mask: PHONE_MASK },
        rules: ['phone'],
      },
      {
        kind: 'field',
        path: 'email',
        component: 'Input',
        props: {
          label: 'Электронная почта',
          type: 'email',
          placeholder: 'name@example.com',
          required: true,
        },
        rules: ['required', 'email'],
      },
      {
        kind: 'field',
        path: 'city',
        component: 'Select',
        props: { label: 'Город', placeholder: 'Выберите город', clearable: true },
        source: CITY_LIST,
        sample: 'msk',
      },
      {
        kind: 'field',
        path: 'position',
        component: 'Combobox',
        // Список с поиском: опции — из источника данных, значение поля — `value` выбранной опции.
        // Крестик очистки сбрасывает поле в `null` — тип поля это значение знает.
        props: {
          label: 'Должность',
          placeholder: 'Выберите должность',
          searchPlaceholder: 'Найти должность',
          emptyText: 'Ничего не найдено',
          clearable: true,
        },
        source: POSITIONS,
      },
      {
        kind: 'field',
        path: 'skills',
        component: 'ComboboxMulti',
        // Набор значений: поле хранит массив `value` выбранных опций, пустой выбор — `null`.
        // `maxItems` только выключает лишние пункты списка; правило формы — `maxLength` ниже.
        props: {
          label: 'Навыки',
          placeholder: 'Выберите до трёх навыков',
          searchPlaceholder: 'Найти навык',
          emptyText: 'Ничего не найдено',
          maxItems: 3,
          clearable: true,
        },
        source: SKILLS,
        rules: ['maxLength(3)'],
      },
    ],
  },
  {
    id: 'extra',
    section: 'Дополнительно',
    step: 'Дополнительно',
    items: [
      {
        kind: 'field',
        path: 'experience',
        component: 'InputNumber',
        props: { label: 'Опыт работы, лет', min: 0, max: 50, step: 1 },
        rules: ['min(0)', 'max(50)'],
      },
      {
        kind: 'field',
        path: 'about',
        component: 'Textarea',
        props: {
          label: 'О себе',
          placeholder: 'Пара предложений о себе',
          rows: 4,
          maxLength: 500,
        },
        rules: ['maxLength(500)'],
      },
      {
        kind: 'field',
        path: 'documents',
        component: 'FileUploadDropzone',
        props: {
          label: 'Документы',
          placeholder: 'Перетащите файлы сюда или нажмите, чтобы выбрать',
          hint: 'PDF или изображения, до 5 МБ, не больше 3 файлов',
          accept: 'image/*,.pdf',
          multiple: true,
          maxFiles: 3,
          maxFileSize: 5242880,
        },
        rules: ['maxFiles(3)', 'maxFileSize(5242880)'],
      },
      {
        kind: 'field',
        path: 'hasReferences',
        component: 'Checkbox',
        props: { label: 'Есть рекомендатели' },
        servesFor: 'references',
      },
      {
        kind: 'array',
        path: 'references',
        selector: 'references',
        props: {
          title: 'Рекомендатели',
          addButtonLabel: '+ Добавить рекомендателя',
          emptyMessage: 'Рекомендателей пока нет',
        },
        itemLabel: 'REFERENCE_LABEL',
        rowClassName: 'grid grid-cols-2 gap-4',
        row: [
          {
            kind: 'field',
            path: 'name',
            component: 'Input',
            props: { label: 'Имя', placeholder: 'Пётр Петров', required: true },
            rules: ['required'],
          },
          {
            kind: 'field',
            path: 'phone',
            component: 'InputMask',
            props: { label: 'Телефон', mask: PHONE_MASK },
          },
        ],
        shownWhen: 'hasReferences',
      },
      {
        kind: 'field',
        path: 'agree',
        component: 'Checkbox',
        props: { label: 'Согласен на обработку персональных данных', required: true },
        rules: ['required'],
      },
    ],
  },
];

// ── Подгонка под кит ────────────────────────────────────────────────────────

/** Пропсы компонента, которые его каталог объявил; без кита — все. */
function fitProps(
  component: string,
  props: Readonly<Record<string, unknown>>,
  kit: SeedKit | undefined
): Record<string, unknown> {
  const declared = kit?.declared(component) ?? null;
  if (declared === null) return { ...props };
  return Object.fromEntries(Object.entries(props).filter(([key]) => declared.has(key)));
}

/** Поле, которым кит располагает; источник данных остаётся, только если у компонента есть `options`. */
function fitField(field: SeedField, kit: SeedKit | undefined): SeedField | null {
  if (kit === undefined) return field;
  if (!kit.has(field.component)) return null;
  const declared = kit.declared(field.component);
  const { source, ...rest } = field;
  const keepsSource = source !== undefined && (declared === null || declared.has('options'));
  return {
    ...rest,
    props: fitProps(field.component, field.props, kit),
    ...(keepsSource ? { source } : {}),
  };
}

/**
 * Массив, которым кит располагает: нужен компонент массива у САМОГО кита и хотя бы одно поле
 * строки. Кит без компонента массива остаётся без массива вовсе ({@link SeedKit.array}).
 */
function fitArray(array: SeedArray, kit: SeedKit | undefined): SeedArray | null {
  if (kit === undefined) return array;
  if (!kit.array) return null;
  const row = array.row.flatMap((field): SeedField[] => {
    const fit = fitField(field, kit);
    return fit === null ? [] : [fit];
  });
  return row.length === 0 ? null : { ...array, row };
}

/**
 * Состав анкеты под кит.
 *
 * Два прохода: сперва по наличию компонентов, затем по связям — флажок, существующий ради
 * массива, без массива не нужен, а массив без своего флажка остаётся видимым всегда. Пустая
 * группа выпадает целиком: секция без полей — пустой заголовок.
 */
function fitGroups(kit: SeedKit | undefined): readonly SeedGroup[] {
  const fitted = GROUPS.map((group) => ({
    ...group,
    items: group.items.flatMap((item): SeedItem[] => {
      const fit = item.kind === 'array' ? fitArray(item, kit) : fitField(item, kit);
      return fit === null ? [] : [fit];
    }),
  }));
  const present = new Set(fitted.flatMap((group) => group.items.map((item) => item.path)));

  return fitted
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item): SeedItem[] => {
        if (item.kind === 'array') {
          if (item.shownWhen === undefined || present.has(item.shownWhen)) return [item];
          const { shownWhen: _flag, ...visible } = item;
          return [visible];
        }
        return item.servesFor === undefined || present.has(item.servesFor) ? [item] : [];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

// ── Узлы схемы ──────────────────────────────────────────────────────────────

/**
 * Узел поля: заготовка фабрики со своей привязкой и пропсами.
 *
 * Привязка ПЕРЕПИСЫВАЕТСЯ в том же ключе `model`, куда её кладёт фабрика: второй ключ рядом
 * оставил бы узел привязанным к `newField`, и все поля затравки делили бы один путь модели.
 */
function fieldNodeOf(field: SeedField): JsonNode {
  const node = fieldNode(field.component);
  return {
    ...node,
    model: `$model(${field.path})`,
    componentProps: {
      // Копия вглубь: вложенный проп (список, объект) иначе делили бы все схемы, собранные из
      // затравки, и правка одной формы меняла бы соседнюю.
      ...structuredClone({ ...field.props }),
      ...(field.source === undefined ? {} : { options: `$dataSource(${field.source.name})` }),
    },
  } as JsonNode;
}

/**
 * Узел массива: секция со строками по шаблону.
 *
 * Компонент (`FieldArray`, секция массива) назван явно: без него рендерер рисует одни строки — ни
 * «добавить», ни «удалить», ни подписи строки, то есть половина пропсов узла осталась бы без
 * действия. Ставит его та же фабрика каталога, что и узлу из палитры; киту без такого компонента
 * массив в затравку не кладётся ({@link fitArray}). `initialValue` — строка, которую кладёт
 * «добавить»: модель модуля создаётся из данных, и своего шаблона строки у неё нет.
 */
function arrayNodeOf(array: SeedArray): JsonNode {
  const draft = arrayNode(ARRAY_COMPONENT_NAME) as unknown as {
    component: string;
    item: { $template: JsonNode };
  };
  const fields = array.row.map(fieldNodeOf);
  return {
    selector: array.selector,
    model: `$model(${array.path})`,
    component: draft.component,
    componentProps: { ...array.props, itemLabel: `$dataSource(${array.itemLabel})` },
    initialValue: Object.fromEntries(
      array.row.map((field, index) => [field.path, defaultForField(fields[index] as JsonFieldNode)])
    ),
    item: {
      $template: {
        ...draft.item.$template,
        componentProps: { className: array.rowClassName },
        children: fields,
      },
    },
  } as unknown as JsonNode;
}

function itemNodes(items: readonly SeedItem[]): JsonNode[] {
  return items.map((item) => (item.kind === 'array' ? arrayNodeOf(item) : fieldNodeOf(item)));
}

/** Контейнер с вертикальным ритмом: заготовка фабрики, свой класс и дети. */
function stackNode(className: string, children: readonly JsonNode[]): JsonNode {
  return {
    ...containerNode('Box'),
    componentProps: { className },
    children: [...children],
  } as JsonNode;
}

/**
 * Секция простой формы. Кит без `Section` получает обычный контейнер: заголовка у него нет, но
 * поля остаются сгруппированы и адресуемы тем же селектором.
 */
function sectionNode(group: SeedGroup, kit: SeedKit | undefined): JsonNode {
  const component = kit === undefined || kit.has('Section') ? 'Section' : 'Box';
  return {
    selector: `${group.id}-section`,
    ...containerNode(component),
    componentProps: fitProps(component, { title: group.section, className: 'space-y-4' }, kit),
    children: itemNodes(group.items),
  } as JsonNode;
}

/**
 * Кнопка отправки. Подпись — в `children` узла, а не в пропсах: рендерер отдаёт компоненту
 * содержимое из `children` и затирает им `componentProps.children`.
 */
function submitNode(): JsonNode {
  return {
    selector: 'submit',
    component: '$component(Button)',
    componentProps: { type: 'submit' },
    children: ['Отправить'],
  } as JsonNode;
}

/** Корень формы: пустая схема домена со своим ритмом и детьми. */
function schemaOf(children: readonly JsonNode[]): JsonFormSchema {
  const schema = emptySchema();
  const root = schema.root as JsonNode & { children: unknown[]; componentProps: object };
  root.componentProps = { className: FORM_ROOT_CLASS };
  root.children = [...children];
  return schema;
}

/**
 * Затравка простой формы: три секции и кнопка отправки.
 *
 * @param kit - Каталог активного кита; без него — анкета целиком.
 */
export function simpleSeed(kit?: SeedKit): JsonFormSchema {
  const sections = fitGroups(kit).map((group) => sectionNode(group, kit));
  // Кнопки в ките может не быть — тогда отправку вставит кодоген, как у любой формы без неё.
  const submit = kit === undefined || kit.has('Button') ? [submitNode()] : [];
  return schemaOf([...sections, ...submit]);
}

/** Есть ли у кита чем нарисовать пошаговую форму; без кита — считается, что есть. */
export function hasWizard(kit?: SeedKit): boolean {
  return kit === undefined || kit.wizard;
}

/**
 * Затравка пошаговой формы: те же поля в трёх шагах.
 *
 * Шаги — `children` узла-визарда. Узел берётся у фабрики, а её единственный пустой шаг заменяется
 * своими: что такое визард, знает домен, а затравка знает только свои шаги. Кнопки отправки нет —
 * её рисует сам визард на последнем шаге.
 *
 * @param kit - Каталог активного кита; без него — анкета целиком.
 */
export function wizardSeed(kit?: SeedKit): JsonFormSchema {
  const steps = fitGroups(kit).map(
    (group): JsonNode =>
      ({
        selector: `${group.id}-step`,
        ...stepNode(group.step),
        // Шаг рисует детей как есть — отступы между полями даёт контейнер внутри него.
        children: [stackNode('space-y-4', itemNodes(group.items))],
      }) as JsonNode
  );
  return schemaOf([{ selector: 'wizard', ...wizardNode(), children: steps } as JsonNode]);
}

// ── Правила и данные ────────────────────────────────────────────────────────

/** Поля состава вместе с полями строк массивов. */
function fieldsOf(groups: readonly SeedGroup[]): readonly SeedField[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => (item.kind === 'array' ? item.row : [item]))
  );
}

/**
 * Правила формы: из них кодоген печатает `validation/*.ts` и `behavior/index.ts`.
 *
 * Печатает их не этот модуль, а мост к билдерам MCP (`@/plugins/reformer/core/codegen`): второй
 * комплект эмиттеров для того же самого разошёлся бы с первым молча.
 *
 * - валидация — по правилу на поле; у поля строки массива цель записана полным путём
 *   (`references.name`), а массив назван в `each`;
 * - связей над моделью две — вычисляемое поле и доступность массива (см. ниже);
 * - правило узла одно — массив скрыт, пока не отмечен его флажок. Условие читает МОДЕЛЬ
 *   (`model.hasReferences`), а узел адресуется селектором, который затравка проставила сама.
 *
 * ## Скрытый массив ещё и выключен
 *
 * Правило узла (`hideWhen`) убирает массив с экрана, но о модели не знает ничего: строки в ней
 * остаются, и правило строки продолжает их проверять. Добавил строку, оставил её пустой, снял
 * флажок — и форма не отправлялась бы из-за поля, которого на экране нет, без единого замечания
 * на виду. Поэтому рядом с правилом видимости стоит связь над моделью: `enableWhen` выключает
 * массив, пока флажок снят, — а выключенное поле (и поле выключенного массива) не проверяет ни
 * отправка простой формы, ни отправка визарда: обе проверяют форму так же, как сборка.
 *
 * Строки при этом не сбрасываются: человек снял флажок и вернул его — набранное на месте. В
 * значениях формы они остаются (обработчик отправки получает модель целиком) — отбросить их перед
 * запросом, если раздел выключен, решает приложение (`api/index.ts`).
 *
 * Оба правила выводятся из одной записи (`shownWhen`) и читают одно и то же поле модели:
 * разойтись они не могут.
 *
 * @param kit - Каталог активного кита: правила остаются только у полей, которые в нём есть.
 */
export function simpleRules(kit?: SeedKit): FormRules {
  const groups = fitGroups(kit);
  const items = groups.flatMap((group) => group.items);
  const present = new Set(items.map((item) => item.path));

  return {
    validation: items.flatMap((item) => {
      if (item.kind === 'field') {
        return item.rules === undefined ? [] : [{ target: item.path, rules: [...item.rules] }];
      }
      return item.row.flatMap((field) =>
        field.rules === undefined
          ? []
          : [{ target: `${item.path}.${field.path}`, each: item.path, rules: [...field.rules] }]
      );
    }),
    behavior: items.flatMap((item): FormRules['behavior'] => {
      if (item.kind === 'array') {
        return item.shownWhen === undefined
          ? []
          : [
              {
                kind: 'enableWhen' as const,
                target: item.path,
                sources: [item.shownWhen],
                expr: `model.${item.shownWhen}`,
                // Строки выключенного массива не проверяются, но и не сбрасываются (см. шапку).
              },
            ];
      }
      return item.computed !== undefined &&
        item.computed.sources.every((source) => present.has(source))
        ? [
            {
              kind: 'computeFrom' as const,
              target: item.path,
              sources: [...item.computed.sources],
              expr: item.computed.expr,
            },
          ]
        : [];
    }),
    render: items.flatMap((item) =>
      item.kind === 'array' && item.shownWhen !== undefined
        ? [
            {
              kind: 'hideWhen' as const,
              selector: item.selector,
              condition: `!model.${item.shownWhen}`,
            },
          ]
        : []
    ),
  };
}

/** Правила пошаговой формы — те же: поля совпадают, а по шагам их раскладывает кодоген. */
export const wizardRules = simpleRules;

/** Данные затравки: значения источников и значения полей для предпросмотра. */
export interface SeedData {
  /** Значения `$dataSource` списков — и для `constants/<форма>.ts`, и для фикстуры. */
  readonly dataSources: Record<string, unknown>;
  /** Значения полей для фикстуры: с ними форму видно сразу. */
  readonly model: Record<string, unknown>;
}

/**
 * Данные затравки.
 *
 * Источники заданы настоящими значениями, а не синтезированными `option1/2/3`: список из трёх
 * безымянных значений показывает, что механизм работает, но не показывает, как выглядит форма.
 * Подпись строки массива сюда не входит — ей нужна функция, и печатает её кодоген.
 *
 * @param kit - Каталог активного кита: данные остаются только у полей, которые в нём есть.
 */
export function seedData(kit?: SeedKit): SeedData {
  const groups = fitGroups(kit);
  const dataSources: Record<string, unknown> = {};
  for (const field of fieldsOf(groups)) {
    if (field.source !== undefined) {
      dataSources[field.source.name] = field.source.options.map((option) => ({ ...option }));
    }
  }
  const model: Record<string, unknown> = {};
  for (const item of groups.flatMap((group) => group.items)) {
    if (item.kind === 'field' && item.sample !== undefined) model[item.path] = item.sample;
  }
  return { dataSources, model };
}
