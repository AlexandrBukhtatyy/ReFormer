/**
 * Синтез ПРЕДСТАВИТЕЛЬНЫХ мок-данных из схемы: модель с правдоподобными значениями по типу/имени
 * поля + значения именованных `$dataSource(NAME)`. Один keystone на всё: наполненное Runtime-preview
 * (build-preview), редактируемая панель мок-данных и кодоген провайдера (data-sources.ts / model.ts).
 *
 * Отличия от blank-пути {@link module:reformer-builder/preview-runtime/synth-model}: значения
 * представительные (не пустые), и есть спуск в `item.$template` массивов (собираем 1–2 элемента).
 * Детерминизм: дата инъектируется (`opts.now`) — для snapshot-тестов кодогена.
 *
 * @module reformer-builder/preview-runtime/mock-synth
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonArrayNode,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { collectOperatorNames, isNodeLike, walkNodes } from '../model';

/** Сериализуемый срез мока: значения модели + значения источников (без fn-заглушек). */
export interface MockData {
  model: Record<string, unknown>;
  /** Только option/scalar источники (сериализуемы). functionLike (itemLabel) инжектятся при сборке. */
  dataSources: Record<string, unknown>;
}

export interface SynthMockOptions {
  /** Базовая дата для date-эвристик (детерминизм тестов). По умолчанию — текущая. */
  now?: Date;
  /** Сколько элементов синтезировать в массивах. По умолчанию 1. */
  arrayItems?: 1 | 2;
}

/** Вид поля для выбора значения (и для вывода TS-типа в кодогене). */
export type FieldKind =
  | 'select'
  | 'multi'
  | 'tree'
  | 'boolean'
  | 'number'
  | 'date'
  | 'files'
  | 'string';

/**
 * Классификация `$dataSource` по контексту использования
 * (приоритет function > tree > option > scalar).
 */
export interface DataSourceClasses {
  /** `componentProps.itemLabel` массива — нужна ФУНКЦИЯ (не массив). */
  functionLike: Set<string>;
  /** list-проп поля (`options`/`items`/…) — массив `{ value, label }`. */
  optionLike: Set<string>;
  /** `nodes` дерева — ИЕРАРХИЯ `{ id, label, children }`, а не плоский список опций. */
  treeLike: Set<string>;
  /** прочие привязки — скаляр-плейсхолдер. */
  scalarLike: Set<string>;
}

const LIST_PROP_KEYS = ['options', 'items', 'data', 'dataSource', 'choices', 'list'] as const;
/**
 * Пропы, чьё значение — ДЕРЕВО (`Tree`, `ComboboxTree`, `ComboboxTreeMulti`). Отдельно от
 * {@link LIST_PROP_KEYS}, а не ещё одним именем в нём: у списка и у дерева разная форма элемента
 * (`{ value, label }` против `{ id, label, children }`), и попади `nodes` в общий набор, поле
 * получило бы плоские опции — дерево нарисовало бы пустоту, потому что `id` в них нет.
 */
const TREE_PROP_KEYS = ['nodes'] as const;
const SELECT_COMPONENTS = new Set([
  'Select',
  'RadioGroup',
  'Radio',
  'RadioButtonGroup',
  'Combobox',
  'Autocomplete',
]);
/**
 * Мультивыборные контролы: значение — МАССИВ строк, а не скаляр.
 *
 * Отдельный набор, а не ветка в SELECT_COMPONENTS, по той же причине, по какой отдельно вынесли
 * FILE_COMPONENTS: у этих контролов value.map/includes внутри, и скаляр их роняет. Значение по
 * умолчанию — null, а НЕ []: массив в начальном значении модель превратила бы в ModelArray
 * (форма-массив вместо листа), и у поля не оказалось бы сигнала.
 *
 * 'MultiSelect' — имя из ЧУЖИХ реестров (в @reformer/ui-kit такого компонента нет). Раньше оно
 * стояло в SELECT_COMPONENTS и молча давало таким полям скаляр.
 */
const MULTI_SELECT_COMPONENTS = new Set([
  'SelectMulti',
  'ComboboxMulti',
  'ComboboxTreeMulti',
  'NativeSelectMulti',
  'ToggleGroupMulti',
  'MultiSelect',
]);
/**
 * Одиночный выбор узла ИЕРАРХИИ: значение — скаляр (`id` узла), но опций у поля нет вовсе —
 * список приходит деревом в пропе `nodes`. Свой вид нужен ровно из-за этого: select-ветка
 * ищет значение среди `options` и на дереве вернула бы `'option1'`, которого в нём нет.
 */
const TREE_SELECT_COMPONENTS = new Set(['ComboboxTree']);
const BOOLEAN_COMPONENTS = new Set(['Checkbox', 'Switch', 'Toggle']);
const NUMBER_COMPONENTS = new Set(['Slider', 'InputNumber', 'NumberInput']);
const DATE_COMPONENTS = new Set(['DatePicker', 'DateInput', 'Calendar', 'DateRangePicker']);
/**
 * Файловые контролы держат список файлов и внутри зовут `value.map(...)` — строка их роняет
 * (а падение одного контрола гасило всё превью). Значение по умолчанию — `null`, а НЕ `[]`:
 * массив в начальном значении модель превратила бы в ModelArray (форма-массив вместо листа),
 * и у поля не оказалось бы сигнала — см. `FileUploadDemo.tsx` в react-playground.
 */
const FILE_COMPONENTS = new Set(['FileUpload', 'FileUploadAvatar', 'Attachment']);

// ── классификация источников ─────────────────────────────────────────────────

/** Разложить `$dataSource`-имена схемы по бакетам использования. */
export function classifyDataSources(schema: JsonFormSchema): DataSourceClasses {
  const all = new Set(collectOperatorNames(schema).dataSources);
  const functionLike = new Set<string>();
  const optionLike = new Set<string>();
  const treeLike = new Set<string>();

  walkNodes(schema, (node) => {
    const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
    if (!props) return;
    if (isArrayNode(node)) {
      const il = parseOperator(props.itemLabel);
      if (il?.op === 'dataSource') functionLike.add(il.arg);
    }
    for (const key of LIST_PROP_KEYS) {
      const p = parseOperator(props[key]);
      if (p?.op === 'dataSource') optionLike.add(p.arg);
    }
    for (const key of TREE_PROP_KEYS) {
      const p = parseOperator(props[key]);
      if (p?.op === 'dataSource') treeLike.add(p.arg);
    }
  });

  // приоритет: function > tree > option > scalar. Дерево выше списка, потому что источник,
  // попавший и туда и туда, обязан родить иерархию: список из неё читается (`{ id, label }`
  // сойдёт за опцию), а обратно — нет.
  for (const n of functionLike) {
    optionLike.delete(n);
    treeLike.delete(n);
  }
  for (const n of treeLike) optionLike.delete(n);
  const scalarLike = new Set<string>();
  for (const n of all)
    if (!functionLike.has(n) && !optionLike.has(n) && !treeLike.has(n)) scalarLike.add(n);

  return { functionLike, optionLike, treeLike, scalarLike };
}

/** Опция `{ value, label }` формы, принятой в проекте. */
export interface MockOption {
  value: string;
  label: string;
}

/** 3 детерминированные опции для optionLike-источника. */
export function mockOptions(name: string): MockOption[] {
  const prefix = humanizeName(name);
  return [1, 2, 3].map((i) => ({ value: `option${i}`, label: `${prefix} ${i}` }));
}

/** Узел мок-дерева — минимум контракта `TreeNode` кита: адрес, подпись и дети. */
export interface MockTreeNode {
  id: string;
  label: string;
  children?: MockTreeNode[];
}

/**
 * Детерминированное мок-дерево для treeLike-источника: две ветки с детьми и один лист верхнего
 * уровня. Ветки нужны обе — с одной не видно, что раскрытие поузловое; лист рядом с ними
 * показывает, что дерево смешанное, а `selectable: 'leaf'` у комбобокса выбирает именно листья.
 * Адрес узла — путь через `/`: так его строит и настоящий источник (дерево файлов).
 */
export function mockTreeNodes(name: string): MockTreeNode[] {
  const prefix = humanizeName(name);
  return [
    {
      id: 'group-1',
      label: `${prefix} 1`,
      children: [
        { id: 'group-1/item-1', label: `${prefix} 1.1` },
        { id: 'group-1/item-2', label: `${prefix} 1.2` },
      ],
    },
    {
      id: 'group-2',
      label: `${prefix} 2`,
      children: [{ id: 'group-2/item-1', label: `${prefix} 2.1` }],
    },
    { id: 'item-3', label: `${prefix} 3` },
  ];
}

/** Значения сериализуемых источников (option → опции, tree → иерархия, scalar → плейсхолдер). */
function synthDataSourceValues(cls: DataSourceClasses): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of cls.optionLike) out[name] = mockOptions(name);
  for (const name of cls.treeLike) out[name] = mockTreeNodes(name);
  for (const name of cls.scalarLike) out[name] = 'значение';
  return out;
}

// ── вывод вида поля ──────────────────────────────────────────────────────────

/** Определить {@link FieldKind} листа по компоненту / типу / привязке к источнику. */
export function inferFieldKind(node: JsonFieldNode): FieldKind {
  const name = parseOperator(node.component)?.arg;
  const props = node.componentProps ?? {};
  if (name && FILE_COMPONENTS.has(name)) return 'files';
  // Проверка ДО select: у мультивыборов тоже есть options, и select-ветка перехватила бы их.
  if (name && MULTI_SELECT_COMPONENTS.has(name)) return 'multi';
  if (name && TREE_SELECT_COMPONENTS.has(name)) return 'tree';
  if (
    hasListDataSource(props) ||
    Array.isArray(props.options) ||
    (name && SELECT_COMPONENTS.has(name))
  )
    return 'select';
  if (name && BOOLEAN_COMPONENTS.has(name)) return 'boolean';
  if (props.type === 'number' || (name && NUMBER_COMPONENTS.has(name))) return 'number';
  if (props.type === 'date' || (name && DATE_COMPONENTS.has(name)) || matches(node, DATE_TOKENS))
    return 'date';
  return 'string';
}

function hasListDataSource(props: Record<string, unknown>): boolean {
  return LIST_PROP_KEYS.some((k) => parseOperator(props[k])?.op === 'dataSource');
}

// ── значения полей ───────────────────────────────────────────────────────────

const DATE_TOKENS = /(date|dob|birth|дата|рожд)/;

/** Нормализованные токены поля: последний сегмент пути + label/placeholder (нижний регистр). */
function fieldTokens(node: JsonFieldNode): string {
  const path = parseOperator(node.value)?.arg ?? '';
  const seg = path.split('.').pop() ?? '';
  const label = String(node.componentProps?.label ?? node.componentProps?.placeholder ?? '');
  return `${seg} ${label}`.toLowerCase();
}

function matches(node: JsonFieldNode, re: RegExp): boolean {
  return re.test(fieldTokens(node));
}

function synthFieldValue(
  node: JsonFieldNode,
  dataSources: Record<string, unknown>,
  now: Date
): unknown {
  switch (inferFieldKind(node)) {
    case 'select':
      return selectValue(node, dataSources);
    case 'tree':
      return treeValue(node, dataSources);
    case 'boolean':
      return false;
    case 'number':
      return numberValue(node, now);
    case 'date':
      return dateValue(node, now);
    case 'multi':
    case 'files':
      return null;
    default:
      return stringValue(node);
  }
}

/** Значение селекта = value первой опции связанного источника / инлайна, иначе `option1`. */
function selectValue(node: JsonFieldNode, dataSources: Record<string, unknown>): unknown {
  const props = node.componentProps ?? {};
  for (const key of LIST_PROP_KEYS) {
    const p = parseOperator(props[key]);
    if (p?.op === 'dataSource') {
      const opts = dataSources[p.arg];
      if (Array.isArray(opts) && opts.length) return (opts[0] as MockOption).value ?? 'option1';
    }
  }
  if (Array.isArray(props.options) && props.options.length) {
    const first = props.options[0] as { value?: unknown };
    if (first && typeof first === 'object' && 'value' in first) return first.value;
  }
  return 'option1';
}

/**
 * Значение одиночного дерева = адрес ПЕРВОГО ЛИСТА объявленной иерархии; `null`, если её нет.
 *
 * Именно листа, а не первого попавшегося узла: у `ComboboxTree` по умолчанию `selectable: 'leaf'`,
 * и адрес ветки дал бы в моке значение, которого пользователь щелчком не получит — каталог там
 * раскрывается, а не выбирается.
 */
function treeValue(node: JsonFieldNode, dataSources: Record<string, unknown>): unknown {
  const props = node.componentProps ?? {};
  for (const key of TREE_PROP_KEYS) {
    const p = parseOperator(props[key]);
    const nodes = p?.op === 'dataSource' ? dataSources[p.arg] : props[key];
    const leaf = firstLeafId(nodes);
    if (leaf !== null) return leaf;
  }
  return null;
}

/**
 * Адрес первого листа сырого дерева; `null` — листьев нет. Лист — узел без `children` либо
 * помеченный `kind: 'leaf'` (то же правило, что и в самом ките: вид выводится из наличия детей,
 * а явный `kind` его перекрывает).
 */
function firstLeafId(nodes: unknown): string | null {
  if (!Array.isArray(nodes)) return null;
  for (const raw of nodes) {
    if (!isPlainObject(raw)) continue;
    const leaf = raw.kind === 'leaf' || !Array.isArray(raw.children);
    if (leaf) {
      if (typeof raw.id === 'string') return raw.id;
      continue;
    }
    const nested = firstLeafId(raw.children);
    if (nested !== null) return nested;
  }
  return null;
}

function numberValue(node: JsonFieldNode, now: Date): number {
  const name = parseOperator(node.component)?.arg;
  const props = node.componentProps ?? {};
  if (name === 'Slider') return typeof props.min === 'number' ? props.min : 0;
  const t = fieldTokens(node);
  if (/\byear\b|год/.test(t)) return now.getFullYear();
  if (/(amount|sum|price|salary|income|сумм|цен|доход|зарплат|стоим)/.test(t)) return 50000;
  if (/(age|возраст)/.test(t)) return 30;
  if (/(count|qty|quantity|колич)/.test(t)) return 1;
  if (/(percent|rate|ставк|процент)/.test(t)) return 10;
  return 42;
}

function dateValue(node: JsonFieldNode, now: Date): string {
  if (/(dob|birth|рожд)/.test(fieldTokens(node))) return '1990-01-01';
  return now.toISOString().slice(0, 10);
}

function stringValue(node: JsonFieldNode): string {
  const t = fieldTokens(node);
  if (/(e-?mail|почт)/.test(t)) return 'ivan@example.com';
  if (/(phone|tel|телефон)/.test(t)) return '+7 999 123-45-67';
  if (/(lastname|surname|фамил)/.test(t)) return 'Иванов';
  if (/(firstname|имя)/.test(t)) return 'Иван';
  if (/(fullname|fio|фио|\bname\b)/.test(t)) return 'Иван Иванов';
  if (/(url|site|website|сайт)/.test(t)) return 'https://example.com';
  if (/(city|город)/.test(t)) return 'Москва';
  if (/(address|адрес)/.test(t)) return 'г. Москва, ул. Пример, 1';
  if (/(inn|инн)/.test(t)) return '7712345678';
  if (/(password|пароль)/.test(t)) return 'Passw0rd!';
  if (/(comment|note|description|коммент|примечан|описан)/.test(t)) return 'Пример текста';
  const label = String(node.componentProps?.label ?? '').trim();
  return label || 'Пример';
}

// ── массивы (спуск в шаблон) ─────────────────────────────────────────────────

function synthArray(
  node: JsonArrayNode,
  dataSources: Record<string, unknown>,
  now: Date,
  arrayItems: 1 | 2
): unknown[] {
  const base =
    node.initialValue && typeof node.initialValue === 'object'
      ? (node.initialValue as Record<string, unknown>)
      : {};
  const template = node.item?.$template;
  const items: unknown[] = [];
  for (let i = 0; i < arrayItems; i++) {
    const synth = isNodeLike(template)
      ? synthObject(template as JsonNode, dataSources, now, arrayItems)
      : {};
    items.push(deepMerge(synth, base)); // явный initialValue бьёт синтез
  }
  return items;
}

/** Собрать объект значений из относительных `$model`-путей узла (для верхнего уровня и элемента). */
function synthObject(
  node: JsonNode,
  dataSources: Record<string, unknown>,
  now: Date,
  arrayItems: 1 | 2
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const rec = (n: JsonNode) => {
    if (isArrayNode(n)) {
      const p = parseOperator(n.array);
      if (p?.op === 'model')
        setNested(obj, p.arg.split('.'), synthArray(n, dataSources, now, arrayItems));
      return;
    }
    if (isFieldNode(n)) {
      const p = parseOperator(n.value);
      if (p?.op === 'model') setNested(obj, p.arg.split('.'), synthFieldValue(n, dataSources, now));
      return;
    }
    if (isContainerNode(n)) {
      n.children?.forEach((c) => isNodeLike(c) && rec(c as JsonNode));
      const steps = n.componentProps?.steps;
      if (Array.isArray(steps)) steps.forEach((s) => isNodeLike(s) && rec(s as JsonNode));
    }
  };
  rec(node);
  return obj;
}

// ── публичный вход ────────────────────────────────────────────────────────────

/** Синтезировать представительный мок `{ model, dataSources }` из схемы. */
export function synthMock(schema: JsonFormSchema, opts: SynthMockOptions = {}): MockData {
  const now = opts.now ?? new Date();
  const arrayItems = opts.arrayItems ?? 1;
  const cls = classifyDataSources(schema);
  const dataSources = synthDataSourceValues(cls);
  const model = isNodeLike(schema.root)
    ? synthObject(schema.root as JsonNode, dataSources, now, arrayItems)
    : {};
  return { model, dataSources };
}

// ── утилиты ──────────────────────────────────────────────────────────────────

function setNested(obj: Record<string, unknown>, segs: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (typeof cur[k] !== 'object' || cur[k] === null || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
}

/** Глубокий мердж: значения `over` бьют `base` (объекты сливаются, массивы/скаляры заменяются). */
function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    if (isPlainObject(b) && isPlainObject(v)) out[k] = deepMerge(b, v);
    else out[k] = v;
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `SNAKE_CASE`/`camelCase` имя источника → человекочитаемый префикс метки опции. */
function humanizeName(name: string): string {
  const words = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Вариант';
}
