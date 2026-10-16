/**
 * Сбор из схемы всего, что нужно эмиттерам: дерево TS-типов формы, список `$component`-имён,
 * классы `$dataSource` и верхнеуровневые поля с `required`.
 *
 * Обход зеркалит {@link './mock'.collectFieldDefaults}: тот же спуск, тот же отказ спускаться
 * в шаблон строки за верхнеуровневыми путями и тот же спуск в разметку подформы. Это не
 * совпадение, а требование — начальные значения (`model/initial-value.ts`) печатаются из
 * первого, тип формы (`types/<dir>.ts`) — из второго, и разойтись им нельзя.
 *
 * ## Именованные части документа
 *
 * Подформа (`{ model, part }`) даёт под своим путём ГРУППУ с полями части: её обязательные поля
 * и массивы считаются верхнеуровневыми — с префиксом группы (`registrationAddress.city`). Массив с
 * `item: "$part(…)"` берёт тип строки из разметки части. Тип вписывается в тип формы на месте
 * (структурно): одна часть, подключённая дважды, даёт две одинаковые группы. Часть, которая
 * подключает саму себя, второй раз не разворачивается — на её месте остаётся
 * `Record<string, unknown>`: вписанный тип у неё вышел бы бесконечным.
 *
 * @module plugins/reformer/core/codegen/collect
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  isPartNode,
  parseOperator,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike, isStepsHost } from '../form-model/node-kind';
import {
  collectOperatorNames,
  documentParts,
  partNameOf,
  rowTemplateOf,
} from '../form-model/query';
import {
  classifyDataSources,
  fieldKindOf,
  LIST_PROP_KEYS,
  type DataSourceClasses,
} from '../form-mock';
import type { FormMock } from './types';

/** Узел дерева типов: лист (готовый TS-тип), объект (вложенность), массив (тип элемента). */
export type TsNode =
  | { readonly t: 'leaf'; readonly ts: string }
  | { readonly t: 'obj'; readonly fields: Record<string, TsNode> }
  | { readonly t: 'arr'; readonly elem: TsNode };

/** Объектный узел дерева типов — тип корня и любой вложенности. */
export interface TsObject {
  readonly t: 'obj';
  readonly fields: Record<string, TsNode>;
}

export interface Collected {
  /** Корень дерева типов. */
  readonly root: TsObject;
  /** Уникальные имена из `$component(Name)` (без `$html`). */
  readonly components: readonly string[];
  /** Классы `$dataSource`. */
  readonly ds: DataSourceClasses;
  /**
   * Верхнеуровневые `$model`-пути полей с `componentProps.required === true` — включая поля
   * подформ, с префиксом их группы.
   */
  readonly requiredPaths: readonly string[];
  /** `$model`-пути узлов-массивов — верхнеуровневые, включая массивы подформ. */
  readonly arrayPaths: readonly string[];
  /**
   * Обязательные поля КАЖДОГО шага визарда, по порядку шагов. Пусто, если визарда нет.
   *
   * Нужны пошаговой проверке: «Далее» обязано проверять только поля своего шага. Проверка всей
   * модели не пустила бы дальше первого шага из-за обязательного поля последнего, а без
   * проверки визард пропускал пустые шаги.
   */
  readonly steps: readonly StepRequired[];
}

/** Шаг визарда глазами валидации: его селектор (адрес в схеме) и обязательные поля. */
export interface StepRequired {
  readonly selector: string | null;
  readonly required: readonly string[];
}

/** Значения опций поля — из мока по `$dataSource` либо инлайн — для string-union типа. */
function optionValues(node: JsonFieldNode, mock: FormMock): string[] | null {
  const props = node.componentProps ?? {};
  for (const key of LIST_PROP_KEYS) {
    const parsed = parseOperator(props[key]);
    if (parsed?.op === 'dataSource') {
      const options = mock.dataSources[parsed.arg];
      if (Array.isArray(options) && options.length > 0) {
        return options.map((o) => String((o as { value?: unknown }).value ?? ''));
      }
    }
  }
  if (Array.isArray(props.options) && props.options.length > 0) {
    return props.options.map((o) => String((o as { value?: unknown }).value ?? ''));
  }
  return null;
}

/**
 * Union строковых литералов из значений опций; `null`, если опции неизвестны.
 * `empty` добавляет в начало `''` — «ничего не выбрано».
 */
function optionUnion(node: JsonFieldNode, mock: FormMock, empty = false): string | null {
  const values = optionValues(node, mock);
  if (values === null || values.length === 0) return null;
  const unique = [...new Set(empty ? ['', ...values] : values)].map(
    (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  );
  return unique.join(' | ');
}

/**
 * Значение по дот-пути в куске мока; `undefined` — мок о таком пути молчит.
 *
 * Кусок — модель целиком либо строка массива: пути полей строки записаны от строки.
 */
function valueAt(sample: unknown, path: string): unknown {
  let cursor = sample;
  for (const key of path.split('.')) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

/** Тип, допускающий `null`. Уже допускающий не трогается — `string | null | null` не бывает. */
function nullable(type: string): string {
  return type.split(' | ').includes('null') ? type : `${type} | null`;
}

/**
 * TS-тип листа: вид значения по контролу плюс то, с чего лист стартует в моке.
 *
 * Мок — не подсказка, а источник начальных значений: `model/initial-value.ts` печатает его как
 * есть и приводит к типу формы (`as <Тип>`). Приведение прячет расхождение от компилятора:
 * `city: null` при `city: string` проходит tsc, а тип при этом врёт — сервис, читающий поле,
 * получает `null`, которого тип не обещал. Поэтому лист, стартующий с `null`, объявляется
 * nullable, какой бы контрол его ни рисовал.
 *
 * @param startsNull - В моке по пути листа лежит `null` (у поля строки массива — хотя бы в одной
 *   строке).
 */
function leafType(node: JsonFieldNode, mock: FormMock, startsNull: boolean): string {
  const type = kindType(node, mock);
  return startsNull ? nullable(type) : type;
}

/** TS-тип листа по виду значения: список с известными опциями — union, иначе по контролу. */
function kindType(node: JsonFieldNode, mock: FormMock): string {
  const kind = fieldKindOf(node);
  if (kind === 'select') {
    // `''` — «ничего не выбрано»: с него список стартует (`defaultForField` в form-mock),
    // и начальные значения печатают его как есть. Союз одних опций это значение отвергал —
    // напечатанный модуль не проходил tsc на любой форме со списком без выбора по умолчанию.
    const type = optionUnion(node, mock, true) ?? 'string';
    // Список с крестиком очистки сбрасывает значение в `null` — тип обязан это значение знать.
    return node.componentProps?.clearable === true ? `${type} | null` : type;
  }
  if (kind === 'multi') {
    const union = optionUnion(node, mock);
    // Тип nullable: пустой выбор приходит как `null` — массив в начальном значении модели
    // создал бы форму-массив вместо листа (см. дефолты в `./mock`).
    return union === null ? 'string[] | null' : `Array<${union}> | null`;
  }
  // Загрузка отдаёт выбранные файлы; `null` — ничего не выбрано. Форме, которая показывает уже
  // загруженные на сервер файлы, тип уточняют руками (`RemoteFileRef[]` кита).
  if (kind === 'file') return 'File[] | null';
  // Выбор даты кладёт в модель `Date`; `null` — дата не выбрана (с него поле и стартует).
  if (kind === 'date') return 'Date | null';
  // Несколько дат и период — массивы, поэтому nullable по той же причине, что мультивыбор.
  if (kind === 'dates') return 'Date[] | null';
  if (kind === 'dateRange') return '[Date, Date] | null';
  if (kind === 'boolean') return 'boolean';
  // `null` — «число не введено»: с него числовое поле стартует, если у него нет `min`
  // (`defaultForField` в form-mock), и начальные значения печатают его как есть. Тип `number`
  // это значение отвергал — напечатанный модуль не проходил tsc на любой форме с числовым полем.
  if (kind === 'number') return 'number | null';
  // Крестик очистки сбрасывает значение в `null` у любого контрола, который его несёт, — и у
  // комбобокса без списка опций в схеме (`ComboboxTree`: узлы приходят деревом, не опциями).
  return node.componentProps?.clearable === true ? 'string | null' : 'string';
}

/** Объект по пути `segments` — существующий либо заведённый на месте. */
function objectAt(target: TsObject, segments: readonly string[]): TsObject {
  let cursor = target;
  for (const key of segments) {
    const next = cursor.fields[key];
    if (next === undefined || next.t !== 'obj') cursor.fields[key] = { t: 'obj', fields: {} };
    cursor = cursor.fields[key] as TsObject;
  }
  return cursor;
}

function insert(target: TsObject, segments: readonly string[], node: TsNode): void {
  objectAt(target, segments.slice(0, -1)).fields[segments[segments.length - 1]] = node;
}

/**
 * Вписать группу подформы. Поля ДОПИСЫВАЮТСЯ к тем, что под этим путём уже объявлены: поле
 * `address.note` рядом с подформой `address` — одна группа модели, а не две.
 */
function insertGroup(target: TsObject, segments: readonly string[], group: TsObject): void {
  Object.assign(objectAt(target, segments).fields, group.fields);
}

/** Тип места, где часть подключает саму себя: разворачивать её дальше нельзя. */
const RECURSIVE_PART: TsNode = { t: 'leaf', ts: 'Record<string, unknown>' };

/** Что обходу нужно знать о документе целиком. */
interface TreeEnv {
  readonly mock: FormMock;
  /** Именованные части документа: разметка подформ и шаблонов строк. */
  readonly parts: ReadonlyMap<string, JsonNode>;
}

/** Приёмник верхнеуровневых путей: обязательные поля и массивы. */
interface TopLevel {
  readonly required: (path: string) => void;
  readonly array: (path: string) => void;
}

/** Тот же приёмник для путей подформы: к каждому дописывается путь её группы. */
function within(top: TopLevel | null, group: string): TopLevel | null {
  if (top === null) return null;
  return {
    required: (path) => {
      top.required(`${group}.${path}`);
    },
    array: (path) => {
      top.array(`${group}.${path}`);
    },
  };
}

/**
 * Построить дерево типов узла — формы целиком, элемента массива либо подформы.
 *
 * @param top - Приёмник верхнеуровневых путей; `null` у шаблона строки — пути там относительны
 *   строке и в верхнеуровневые не попадают.
 * @param samples - Куски мока, в которых лежат значения полей этого узла: у формы — её модель,
 *   у шаблона элемента — строки массива из мока (у синтезированного мока строк нет), у подформы —
 *   значения её группы.
 * @param entered - Части, внутри разметки которых идёт обход: защита от части, подключающей себя.
 */
function buildTree(
  node: JsonNode,
  env: TreeEnv,
  top: TopLevel | null,
  samples: readonly unknown[],
  entered: readonly string[] = []
): TsObject {
  const root: TsObject = { t: 'obj', fields: {} };
  const visit = (n: JsonNode): void => {
    if (isArrayNode(n)) {
      const parsed = parseOperator(n.model);
      if (parsed?.op === 'model') {
        // Шаблон строки: вписанный в узел либо разметка части (`item: "$part(…)"`). У ссылки на
        // часть, которой в документе нет, шаблона нет — тип элемента остаётся пустым объектом.
        const template = rowTemplateOf(n, env.parts);
        // Строки массива из мока: по ним типы полей строки узнают о своих `null`.
        const rows = samples.flatMap((sample): unknown[] => {
          const value = valueAt(sample, parsed.arg);
          return Array.isArray(value) ? value : [];
        });
        let elem: TsNode = { t: 'obj', fields: {} };
        if (template !== undefined) {
          const part = template.part;
          elem =
            part !== null && entered.includes(part)
              ? RECURSIVE_PART
              : buildTree(
                  template.node,
                  env,
                  null,
                  rows,
                  part === null ? entered : [...entered, part]
                );
        }
        insert(root, parsed.arg.split('.'), { t: 'arr', elem });
        top?.array(parsed.arg);
      }
      return;
    }
    if (isPartNode(n)) {
      const parsed = parseOperator(n.model);
      if (parsed?.op !== 'model') return;
      const segments = parsed.arg.split('.');
      const name = partNameOf(n.part);
      const markup = name === undefined ? undefined : env.parts.get(name);
      if (name === undefined || markup === undefined) {
        // Части с таким именем нет (об этом скажет проверка схемы) — группа остаётся пустой.
        insertGroup(root, segments, { t: 'obj', fields: {} });
        return;
      }
      if (entered.includes(name)) {
        insert(root, segments, RECURSIVE_PART);
        return;
      }
      const inner = samples
        .map((sample) => valueAt(sample, parsed.arg))
        .filter((value) => value !== undefined);
      insertGroup(
        root,
        segments,
        buildTree(markup, env, within(top, parsed.arg), inner, [...entered, name])
      );
      return;
    }
    if (isFieldNode(n)) {
      const parsed = parseOperator(n.model);
      if (parsed?.op === 'model') {
        const startsNull = samples.some((sample) => valueAt(sample, parsed.arg) === null);
        insert(root, parsed.arg.split('.'), { t: 'leaf', ts: leafType(n, env.mock, startsNull) });
        if (n.componentProps?.required === true) top?.required(parsed.arg);
      }
      return;
    }
    if (isContainerNode(n)) {
      // Шаги визарда — те же `children`.
      n.children?.forEach((child) => {
        if (isNodeLike(child)) visit(child);
      });
    }
  };
  visit(node);
  return root;
}

/** Узлы шагов первого визарда схемы (`children` узла-визарда), в порядке шагов. */
export function wizardStepsOf(node: JsonNode): readonly JsonNode[] {
  if (!isContainerNode(node)) return [];
  if (isStepsHost(node)) return (node.children ?? []).filter(isNodeLike);
  for (const child of node.children ?? []) {
    if (!isNodeLike(child)) continue;
    const found = wizardStepsOf(child);
    if (found.length > 0) return found;
  }
  return [];
}

/** Собрать всё для эмиттеров из (уже трансформированной) схемы и мока. */
export function collect(schema: JsonFormSchema, mock: FormMock): Collected {
  const requiredPaths: string[] = [];
  const arrayPaths: string[] = [];
  const env: TreeEnv = { mock, parts: documentParts(schema) };
  const into = (required: string[], arrays: string[]): TopLevel => ({
    required: (path) => {
      required.push(path);
    },
    array: (path) => {
      arrays.push(path);
    },
  });
  const root = isNodeLike(schema.root)
    ? buildTree(schema.root, env, into(requiredPaths, arrayPaths), [mock.model])
    : ({ t: 'obj', fields: {} } as TsObject);
  // Тот же обход, что у корня, — только от узла шага: «обязательное поле» определяется одним
  // правилом, и два обхода разошлись бы на первом же новом виде узла.
  const steps = isNodeLike(schema.root)
    ? wizardStepsOf(schema.root).map((step): StepRequired => {
        const required: string[] = [];
        buildTree(step, env, into(required, []), [mock.model]);
        const selector = (step as { selector?: unknown }).selector;
        return { selector: typeof selector === 'string' ? selector : null, required };
      })
    : [];
  return {
    root,
    components: collectOperatorNames(schema).components,
    ds: classifyDataSources(schema),
    requiredPaths,
    arrayPaths,
    steps,
  };
}
