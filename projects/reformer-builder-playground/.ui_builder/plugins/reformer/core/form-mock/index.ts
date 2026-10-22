/**
 * Синтез мок-данных формы из схемы: начальные значения модели и значения источников.
 *
 * ## Одно правило синтеза на двоих, а не по копии
 *
 * «Какое начальное значение у поля с таким контролом» — вопрос ДОМЕНА, а не превью
 * и не генератора. Потребителей ровно два, и они смотрят на форму с разных сторон:
 * превью рисует её живой, генератор печатает `model.ts` с начальными значениями.
 * Разойдись копии — превью показывало бы **не ту форму**, которую экспортирует генератор,
 * и заметить это можно было бы только сравнив две программы вручную.
 *
 * Модуль лежал в `lib/codegen/`, что было почти правильно: домен — да, но не генерации.
 * Копия в превью появилась раньше и уже успела разойтись на 29 строк.
 *
 * @module plugins/reformer/core/form-mock/index
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  isPartNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../form-model/node-kind';
import {
  collectOperatorNames,
  documentParts,
  partNameOf,
  walkDocumentNodes,
} from '../form-model/query';
import type { FormMock } from '../codegen/types';

// Тип описывает РЕЗУЛЬТАТ синтеза, поэтому принадлежит сюда: генератор знает о моке
// не больше превью, и держать его объявление у одного из двух потребителей — случайность
// истории, а не решение. Реэкспорт вместо переноса объявления: `codegen/types` — публичная
// поверхность генератора, и двигать её ради этого пришлось бы шире, чем стоит задача.
export type { FormMock } from '../codegen/types';

/** Контролы, чьё значение — список файлов. */
const FILE_COMPONENTS: ReadonlySet<string> = new Set([
  'FileUpload',
  'FileUploadAvatar',
  'FileUploadDropzone',
  'FileUploadInput',
  'Attachment',
]);

/** Контролы, чьё значение — массив строк. */
const MULTI_COMPONENTS: ReadonlySet<string> = new Set([
  'SelectMulti',
  'ComboboxMulti',
  // Набор узлов иерархии — тот же диалект мультивыбора; без записи поле объявлялось строкой.
  'ComboboxTreeMulti',
  'NativeSelectMulti',
  'ToggleGroupMulti',
  'MultiSelect',
]);

/** Контролы с булевым значением. */
const BOOLEAN_COMPONENTS: ReadonlySet<string> = new Set(['Checkbox', 'Switch', 'Toggle']);

/** Контролы, чьё значение — дата (`Date`), а не строка. */
const DATE_COMPONENTS: ReadonlySet<string> = new Set(['DatePicker', 'Calendar']);

/** Контролы, чьё значение — список дат (`Date[]`). */
const DATES_COMPONENTS: ReadonlySet<string> = new Set(['DatePickerMulti']);

/** Контролы, чьё значение — период: кортеж `[начало, конец]`. */
const DATE_RANGE_COMPONENTS: ReadonlySet<string> = new Set(['DatePickerRange']);

/** Пропсы, в которых лежит список опций. */
export const LIST_PROP_KEYS: readonly string[] = [
  'options',
  'items',
  'data',
  'dataSource',
  'choices',
  'list',
];

/** Вид значения поля — то, чем `types.ts` объявляет лист, а мок заполняет модель. */
export type FieldKind =
  | 'boolean'
  | 'number'
  | 'multi'
  | 'file'
  | 'date'
  | 'dates'
  | 'dateRange'
  | 'select'
  | 'string'
  /**
   * Тип, который кит объявил контролу, а у синтеза своего правила для него нет
   * (`[string, string]`, `Record<string, number[]>`): лист печатается этим типом, мок — `null`.
   */
  | 'raw';

/**
 * Тип значения, который кит объявил контролу (`x-runtimeProps.value.type` записи каталога), по
 * имени компонента; `undefined` — не объявил.
 *
 * Функция, а не каталог: синтезу нужен один ответ на компонент, а не устройство каталога. Таблицу
 * строит тот, у кого каталог есть, — кодоген по `ctx.kit.catalog` (`valueTypesOf` в
 * `codegen/collect`). Без неё вид решают наборы имён и пропсы узла — как до появления таблицы.
 */
export type ValueTypeOf = (component: string) => string | undefined;

/**
 * Члены объединения верхнего уровня. `|` внутри `<…>`, `(…)`, `[…]`, `{…}` и строковых литералов
 * не делит: `Record<string, number | null>` — один член, а не два.
 */
function unionMembers(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < type.length; i += 1) {
    const ch = type[i];
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '<' || ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}' || (ch === '>' && type[i - 1] !== '=')) {
      // `=>` стрелки функционального типа скобку не закрывает.
      depth -= 1;
    } else if (ch === '|' && depth === 0) {
      members.push(type.slice(start, i).trim());
      start = i + 1;
    }
  }
  members.push(type.slice(start).trim());
  // Пустой член — от ведущей `|` многострочного объединения (`| 'a' | 'b'`).
  return members.filter((member) => member !== '');
}

/**
 * Объявленный китом тип значения контрола узла — без `null` и `undefined`: «пусто» синтез
 * добавляет сам, по начальному значению поля. `undefined` — кит тип не объявил (либо объявил одно
 * «пусто»).
 */
export function declaredValueType(
  node: JsonFieldNode,
  valueTypeOf?: ValueTypeOf
): string | undefined {
  const component = parseOperator(node.component)?.arg;
  if (component === undefined || valueTypeOf === undefined) return undefined;
  const declared = valueTypeOf(component);
  if (typeof declared !== 'string') return undefined;
  const members = unionMembers(declared).filter(
    (member) => member !== 'null' && member !== 'undefined'
  );
  return members.length === 0 ? undefined : members.join(' | ');
}

/**
 * Объявленные типы, у которых у синтеза есть своё правило. Ключ — тип без пробелов:
 * `[Date, Date]` и `[Date,Date]` — один тип.
 */
const KIND_BY_DECLARED: ReadonlyMap<string, FieldKind> = new Map([
  ['boolean', 'boolean'],
  ['number', 'number'],
  ['string[]', 'multi'],
  ['Array<string>', 'multi'],
  ['Date', 'date'],
  ['Date[]', 'dates'],
  ['Array<Date>', 'dates'],
  ['[Date,Date]', 'dateRange'],
  ['File[]', 'file'],
  ['Array<File>', 'file'],
]);

/**
 * Имена, которые модуль формы видит без импорта: примитивы, литералы, служебные типы TypeScript
 * и типы DOM. Тип с иным именем напечатать нельзя — модуль формы не собрался бы.
 */
const PRINTABLE_NAMES: ReadonlySet<string> = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'object',
  'unknown',
  'any',
  'never',
  'void',
  'null',
  'undefined',
  'true',
  'false',
  'readonly',
  'keyof',
  'Array',
  'ReadonlyArray',
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Map',
  'Set',
  'ReadonlyMap',
  'ReadonlySet',
  'Date',
  'File',
  'Blob',
  'FileList',
]);

/**
 * Можно ли напечатать тип в модуле формы как есть: каждое имя в нём — из {@link PRINTABLE_NAMES}.
 * Содержимое строковых литералов и ключи объектного типа (`{ start: string }`, параметры
 * `(value: string) => void`) именами типов не считаются.
 */
function isPrintable(type: string): boolean {
  const bare = type.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");
  for (const match of bare.matchAll(/[A-Za-z_$][\w$]*/g)) {
    const rest = bare.slice(match.index + match[0].length).trimStart();
    if (rest.startsWith(':') || rest.startsWith('?:')) continue;
    if (!PRINTABLE_NAMES.has(match[0])) return false;
  }
  return true;
}

/**
 * Вид значения по типу, который кит объявил контролу.
 *
 * `undefined` — вид решают пропсы узла, как и без таблицы: тип не объявлен; это строка (список,
 * число по `type` и просто строка различаются только пропсами); либо тип ссылается на имя, которого
 * модуль формы не видит (`File | RemoteFileRef` у загрузки аватара ui-kit), — напечатанный как
 * есть, он не собрался бы.
 */
function kindOfDeclared(type: string | undefined): FieldKind | undefined {
  if (type === undefined) return undefined;
  const compact = type.replace(/\s+/g, '');
  if (compact === 'string') return undefined;
  return KIND_BY_DECLARED.get(compact) ?? (isPrintable(type) ? 'raw' : undefined);
}

/**
 * Вид значения по компоненту и пропсам узла.
 *
 * Отдельная функция, а не ветка внутри дефолта: тот же вопрос задаёт эмиттер типов, и два
 * разных ответа на него означали бы `model.ts`, не подходящий под собственный `types.ts`.
 *
 * Порядок: наборы имён → тип значения из каталога кита → пропсы узла. Наборы имён первыми —
 * ради стабильности: у встроенного кита по ним уже напечатаны модули форм, и каталог их не
 * переопределяет. Каталог отвечает за контролы, которых в наборах нет (поля чужого кита:
 * `CheckboxGroup` со `string[] | null`, `TimeRange` с `[string, string] | null`).
 *
 * @param valueTypeOf - Тип значения контрола из каталога кита ({@link ValueTypeOf}); без него —
 *   только наборы имён и пропсы.
 */
export function fieldKindOf(node: JsonFieldNode, valueTypeOf?: ValueTypeOf): FieldKind {
  const component = parseOperator(node.component)?.arg;
  if (component !== undefined) {
    if (FILE_COMPONENTS.has(component)) return 'file';
    if (MULTI_COMPONENTS.has(component)) return 'multi';
    if (BOOLEAN_COMPONENTS.has(component)) return 'boolean';
    if (DATE_COMPONENTS.has(component)) return 'date';
    if (DATES_COMPONENTS.has(component)) return 'dates';
    if (DATE_RANGE_COMPONENTS.has(component)) return 'dateRange';
    if (component === 'Slider' || component === 'InputNumber') return 'number';
  }
  const declared = kindOfDeclared(declaredValueType(node, valueTypeOf));
  if (declared !== undefined) return declared;
  // Старые схемы (до выделения InputNumber) задавали число пропом `type: 'number'` у Input —
  // схемы Input его больше не принимают, но мок читает такие схемы по-прежнему как число.
  if (node.componentProps?.type === 'number') return 'number';
  const props = node.componentProps ?? {};
  for (const key of LIST_PROP_KEYS) {
    if (props[key] !== undefined) return 'select';
  }
  return 'string';
}

/**
 * Дефолт значения листа по его виду.
 *
 * @param valueTypeOf - Тип значения контрола из каталога кита (см. {@link fieldKindOf}).
 */
export function defaultForField(node: JsonFieldNode, valueTypeOf?: ValueTypeOf): unknown {
  switch (fieldKindOf(node, valueTypeOf)) {
    case 'file':
    case 'multi':
    case 'dates':
    case 'dateRange':
      // `null`, а не `[]`: массив в начальном значении модель превратила бы в форму-массив,
      // и у поля не оказалось бы сигнала вовсе.
      return null;
    case 'raw':
      // Пустого значения объявленного типа синтез не знает, а `null` годится любому: тип листа
      // кодоген объявляет допускающим его.
      return null;
    case 'boolean':
      return false;
    case 'date':
      // «Дата не выбрана» у выбора даты — `null`: пустую строку он значением не считает, и тип
      // поля разошёлся бы с тем, что контрол кладёт в модель (`Date`).
      return null;
    case 'number': {
      const min = node.componentProps?.min;
      return typeof min === 'number' ? min : null;
    }
    default:
      return '';
  }
}

/** Пара «путь модели → дефолтное значение». */
export interface FieldDefault {
  readonly path: string;
  readonly value: unknown;
}

/**
 * Верхнеуровневые дефолты полей, массивов и подформ.
 *
 * В шаблон строки массива (`item.$template` либо `item: "$part(…)"`) не спускаемся: пути внутри
 * шаблона ОТНОСИТЕЛЬНЫ элементу и в модель верхнего уровня не входят — подмодель элемента строит
 * конвертер рендерера.
 *
 * В разметку подформы (`{ model, part }`) спускаемся: её пути относительны ГРУППЕ, к которой часть
 * подключена, и группа эта — часть модели верхнего уровня. Поля части получают путь с префиксом
 * группы (`registrationAddress.city`); у части без единого поля объявляется сама группа — без неё
 * рендерер на таком узле бросает («not a group of the model»). Часть, подключающая саму себя,
 * второй раз не разворачивается: модель у неё вышла бы бесконечной.
 *
 * @param valueTypeOf - Тип значения контрола из каталога кита (см. {@link fieldKindOf}).
 */
export function collectFieldDefaults(
  schema: JsonFormSchema,
  valueTypeOf?: ValueTypeOf
): readonly FieldDefault[] {
  const out: FieldDefault[] = [];
  const parts = documentParts(schema);
  const visit = (node: JsonNode, prefix: string, entered: readonly string[]): void => {
    if (isArrayNode(node)) {
      const parsed = parseOperator(node.model);
      if (parsed?.op === 'model') out.push({ path: `${prefix}${parsed.arg}`, value: [] });
      return;
    }
    if (isPartNode(node)) {
      const parsed = parseOperator(node.model);
      if (parsed?.op !== 'model') return;
      const group = `${prefix}${parsed.arg}`;
      const name = partNameOf(node.part);
      const markup = name === undefined || entered.includes(name) ? undefined : parts.get(name);
      const before = out.length;
      if (markup !== undefined && name !== undefined)
        visit(markup, `${group}.`, [...entered, name]);
      if (out.length === before) out.push({ path: group, value: {} });
      return;
    }
    if (isFieldNode(node)) {
      const parsed = parseOperator(node.model);
      if (parsed?.op === 'model') {
        out.push({ path: `${prefix}${parsed.arg}`, value: defaultForField(node, valueTypeOf) });
      }
      return;
    }
    if (isContainerNode(node)) {
      // Шаги визарда — те же `children`.
      (node as JsonContainerNode).children?.forEach((child) => {
        if (isNodeLike(child)) visit(child, prefix, entered);
      });
    }
  };
  if (isNodeLike(schema.root)) visit(schema.root, '', []);
  return out;
}

function setNested(target: Record<string, unknown>, segments: string[], value: unknown): void {
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1];
  // Первое объявление пути выигрывает: два поля на один путь — это одно значение модели.
  if (!(last in cursor)) cursor[last] = value;
}

/** Вложенный объект начальных значений из плоских дот-путей. */
export function buildInitialValues(defaults: readonly FieldDefault[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const { path, value } of defaults) setNested(root, path.split('.'), value);
  return root;
}

/** Классификация `$dataSource` по КОНТЕКСТУ использования. Приоритет: функция > список > скаляр. */
export interface DataSourceClasses {
  /** `componentProps.itemLabel` массива — нужна ФУНКЦИЯ, а не массив. */
  readonly functionLike: ReadonlySet<string>;
  /** list-проп поля — массив опций. */
  readonly optionLike: ReadonlySet<string>;
  /** Всё прочее — скаляр-плейсхолдер. */
  readonly scalarLike: ReadonlySet<string>;
}

/**
 * Разложить `$dataSource`-имена схемы по бакетам использования.
 *
 * Смотрится весь документ, включая разметку именованных частей: список опций поля части — такой
 * же список, и без обхода частей он сошёл бы за скаляр-плейсхолдер.
 */
export function classifyDataSources(schema: JsonFormSchema): DataSourceClasses {
  const all = new Set(collectOperatorNames(schema).dataSources);
  const functionLike = new Set<string>();
  const optionLike = new Set<string>();

  walkDocumentNodes(schema, (node) => {
    const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
    if (props === undefined) return;
    if (isArrayNode(node)) {
      const itemLabel = parseOperator(props.itemLabel);
      if (itemLabel?.op === 'dataSource') functionLike.add(itemLabel.arg);
    }
    for (const key of LIST_PROP_KEYS) {
      const parsed = parseOperator(props[key]);
      if (parsed?.op === 'dataSource') optionLike.add(parsed.arg);
    }
  });

  for (const name of functionLike) optionLike.delete(name);
  const scalarLike = new Set<string>();
  for (const name of all) {
    if (!functionLike.has(name) && !optionLike.has(name)) scalarLike.add(name);
  }
  return { functionLike, optionLike, scalarLike };
}

/** Опция списка в форме, принятой в проекте. */
export interface MockOption {
  readonly value: string;
  readonly label: string;
}

/** Три детерминированные опции для источника-списка. Детерминизм — ради воспроизводимости. */
export function mockOptions(name: string): readonly MockOption[] {
  const prefix = humanizeSourceName(name);
  return [1, 2, 3].map((index) => ({ value: `option${index}`, label: `${prefix} ${index}` }));
}

/** `CITY_LIST` / `cityList` → `City list`: имя источника как подпись, а не как идентификатор. */
function humanizeSourceName(name: string): string {
  const words = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words === '' ? name : words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Значения источников из правил формы (`FormRules.dataSources`) — поверх выдуманных, и только
 * для имён, на которые ссылается схема: источник, которого форма не читает, ни печатать, ни
 * показывать незачем. Общая точка генерации и превью — иначе они показали бы разные варианты.
 */
export function overlayDataSources(
  mock: FormMock,
  sources: Readonly<Record<string, unknown>> | undefined
): FormMock {
  if (sources === undefined) return mock;
  const dataSources = { ...mock.dataSources };
  let changed = false;
  for (const [name, value] of Object.entries(sources)) {
    if (!Object.hasOwn(dataSources, name)) continue;
    dataSources[name] = value;
    changed = true;
  }
  return changed ? { ...mock, dataSources } : mock;
}

/**
 * Синтезированный мок схемы: пустая модель плюс списки опций.
 *
 * Детерминирована по построению — в отличие от v1, где `synthMock` брал `new Date()` и форма
 * с полем-датой давала новый `model.ts` при каждой регенерации. Там это лечили фиксированной
 * датой в `regenerate.ts`; здесь лечить нечего, потому что даты не синтезируются вовсе.
 *
 * @param valueTypeOf - Тип значения контрола из каталога кита (см. {@link fieldKindOf}). Кодоген
 *   и превью передают одну и ту же таблицу — иначе начальные значения разошлись бы с типом формы.
 */
export function synthMock(schema: JsonFormSchema, valueTypeOf?: ValueTypeOf): FormMock {
  const classes = classifyDataSources(schema);
  const dataSources: Record<string, unknown> = {};
  for (const name of classes.optionLike) dataSources[name] = mockOptions(name);
  for (const name of classes.scalarLike) dataSources[name] = 'значение';
  return { model: buildInitialValues(collectFieldDefaults(schema, valueTypeOf)), dataSources };
}
