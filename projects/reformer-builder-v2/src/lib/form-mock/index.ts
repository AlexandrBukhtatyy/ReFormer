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
 * @module reformer-builder/lib/form-mock
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonContainerNode,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../form-model/node-kind';
import { collectOperatorNames, walkNodes } from '../form-model/query';
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
  'Attachment',
]);

/** Контролы, чьё значение — массив строк. */
const MULTI_COMPONENTS: ReadonlySet<string> = new Set([
  'SelectMulti',
  'ComboboxMulti',
  'NativeSelectMulti',
  'ToggleGroupMulti',
  'MultiSelect',
]);

/** Контролы с булевым значением. */
const BOOLEAN_COMPONENTS: ReadonlySet<string> = new Set(['Checkbox', 'Switch', 'Toggle']);

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
export type FieldKind = 'boolean' | 'number' | 'multi' | 'file' | 'select' | 'string';

/**
 * Вид значения по компоненту и пропсам узла.
 *
 * Отдельная функция, а не ветка внутри дефолта: тот же вопрос задаёт эмиттер типов, и два
 * разных ответа на него означали бы `model.ts`, не подходящий под собственный `types.ts`.
 */
export function fieldKindOf(node: JsonFieldNode): FieldKind {
  const component = parseOperator(node.component)?.arg;
  if (component !== undefined) {
    if (FILE_COMPONENTS.has(component)) return 'file';
    if (MULTI_COMPONENTS.has(component)) return 'multi';
    if (BOOLEAN_COMPONENTS.has(component)) return 'boolean';
    if (component === 'Slider') return 'number';
  }
  if (node.componentProps?.type === 'number') return 'number';
  const props = node.componentProps ?? {};
  for (const key of LIST_PROP_KEYS) {
    if (props[key] !== undefined) return 'select';
  }
  return 'string';
}

/** Дефолт значения листа по его виду. */
export function defaultForField(node: JsonFieldNode): unknown {
  switch (fieldKindOf(node)) {
    case 'file':
    case 'multi':
      // `null`, а не `[]`: массив в начальном значении модель превратила бы в форму-массив,
      // и у поля не оказалось бы сигнала вовсе.
      return null;
    case 'boolean':
      return false;
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
 * Верхнеуровневые дефолты полей и массивов.
 *
 * В `item.$template` не спускаемся: пути внутри шаблона ОТНОСИТЕЛЬНЫ элементу и в модель
 * верхнего уровня не входят — подмодель элемента строит конвертер рендерера.
 */
export function collectFieldDefaults(schema: JsonFormSchema): readonly FieldDefault[] {
  const out: FieldDefault[] = [];
  const visit = (node: JsonNode): void => {
    if (isArrayNode(node)) {
      const parsed = parseOperator(node.array);
      if (parsed?.op === 'model') out.push({ path: parsed.arg, value: [] });
      return;
    }
    if (isFieldNode(node)) {
      const parsed = parseOperator(node.value);
      if (parsed?.op === 'model') out.push({ path: parsed.arg, value: defaultForField(node) });
      return;
    }
    if (isContainerNode(node)) {
      const container = node as JsonContainerNode;
      container.children?.forEach((child) => {
        if (isNodeLike(child)) visit(child as JsonNode);
      });
      const steps = container.componentProps?.steps;
      if (Array.isArray(steps)) {
        steps.forEach((step) => {
          if (isNodeLike(step)) visit(step as JsonNode);
        });
      }
    }
  };
  if (isNodeLike(schema.root)) visit(schema.root);
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

/** Разложить `$dataSource`-имена схемы по бакетам использования. */
export function classifyDataSources(schema: JsonFormSchema): DataSourceClasses {
  const all = new Set(collectOperatorNames(schema).dataSources);
  const functionLike = new Set<string>();
  const optionLike = new Set<string>();

  walkNodes(schema, (node) => {
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
 * Синтезированный мок схемы: пустая модель плюс списки опций.
 *
 * Детерминирована по построению — в отличие от v1, где `synthMock` брал `new Date()` и форма
 * с полем-датой давала новый `model.ts` при каждой регенерации. Там это лечили фиксированной
 * датой в `regenerate.ts`; здесь лечить нечего, потому что даты не синтезируются вовсе.
 */
export function synthMock(schema: JsonFormSchema): FormMock {
  const classes = classifyDataSources(schema);
  const dataSources: Record<string, unknown> = {};
  for (const name of classes.optionLike) dataSources[name] = mockOptions(name);
  for (const name of classes.scalarLike) dataSources[name] = 'значение';
  return { model: buildInitialValues(collectFieldDefaults(schema)), dataSources };
}
