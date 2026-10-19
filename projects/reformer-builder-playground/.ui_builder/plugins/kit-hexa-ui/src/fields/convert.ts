/**
 * Чистые преобразования значений между моделью формы и контролами HexaUI — без React.
 *
 * Обёртки полей (`./*.tsx`) держат в себе только связку с компонентом; всё, что можно проверить
 * без браузера (разбор маски, дерево вариантов, список файлов, расписание), живёт здесь и
 * проверяется в node (`./adapters.test.ts`).
 *
 * @module reformer/kit-hexa-ui/fields/convert
 */

// ---------------------------------------------------------------------------------------------
// Формы значений
// ---------------------------------------------------------------------------------------------

/** Полный период: ровно две настоящие даты. */
export function isDateRange(value: unknown): value is [Date, Date] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((date) => date instanceof Date && !Number.isNaN(date.getTime()))
  );
}

/** Полный интервал времени: ровно две непустые строки. */
export function isStringPair(value: unknown): value is [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((part) => typeof part === 'string' && part !== '')
  );
}

/**
 * Один ли это период для модели: оба неполные (`null`, `[]`, одна дата) либо одни и те же даты.
 * Поле-кортеж хранит `null` как `[]`, а адаптер отдаёт модели копию — по ссылке их не сравнить.
 */
export function sameRange(a: unknown, b: unknown): boolean {
  const left = isDateRange(a) ? a : null;
  const right = isDateRange(b) ? b : null;
  if (left === null || right === null) return left === right;
  return left.every((date, index) => date.getTime() === right[index].getTime());
}

/** Один ли это интервал времени для модели: оба неполные либо одни и те же строки. */
export function samePair(a: unknown, b: unknown): boolean {
  const left = isStringPair(a) ? a : null;
  const right = isStringPair(b) ? b : null;
  if (left === null || right === null) return left === right;
  return left[0] === right[0] && left[1] === right[1];
}

/**
 * Расписание в формате HexaUI `WeeklySchedule`: «день → 24 флага часов» (`1` — час отмечен,
 * `0` — нет), ключи — `monday` … `sunday`. День без ровно 24 флагов HexaUI читает пустым.
 */
export type WeeklyScheduleValue = Record<string, number[]>;

/** Похоже ли значение на расписание: объект, у которого каждое поле — массив чисел. */
export function isSchedule(value: unknown): value is WeeklyScheduleValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (hours) => Array.isArray(hours) && hours.every((hour) => typeof hour === 'number')
  );
}

/** Флаги дня так, как их читает HexaUI: ровно 24 часа, иначе день пуст. */
const dayFlags = (hours: readonly number[] | undefined): boolean[] =>
  hours?.length === 24 ? hours.map(Boolean) : Array.from({ length: 24 }, () => false);

/** Расписание, в котором отмечен хотя бы один час. */
export function isNonEmptySchedule(value: unknown): value is WeeklyScheduleValue {
  return isSchedule(value) && Object.values(value).some((hours) => dayFlags(hours).some(Boolean));
}

/**
 * Формат даты ui-kit (токены date-fns: `dd.MM.yyyy`) → формат HexaUI (`DD.MM.YYYY`). HexaUI строит
 * из формата маску ввода и узнаёт в нём только `DD`, `MM`, `YYYY` — с `dd`/`yyyy` маска вышла бы
 * из букв. В date-fns HexaUI переводит формат обратно сам.
 */
export function hexaDateFormat(dateFormat: string): string {
  return dateFormat.replace(/yyyy/g, 'YYYY').replace(/dd/g, 'DD');
}

// ---------------------------------------------------------------------------------------------
// Маска ввода
// ---------------------------------------------------------------------------------------------

/**
 * Символы, которые у IMask значат не себя: определения (`0` цифра, `a` буква, `*` любой символ),
 * необязательная часть `[]`, фиксированная `{}`, `` ` `` и экранирование `\`.
 */
const IMASK_SPECIAL = new Set(['0', 'a', '*', '[', ']', '{', '}', '`', '\\']);

/**
 * Маска в формате ui-kit (`'9'` — цифра, всё прочее — литерал: `'+7 (999) 999-99-99'`) → шаблон
 * IMask, которым маскирует HexaUI `Textbox.Masked`. Цифра — `0`; литерал, совпавший со
 * спецсимволом IMask, экранируется, иначе `0` в `'+7 (900)'` стал бы ещё одной цифрой.
 */
export function imaskPattern(mask: string): string {
  let pattern = '';
  for (const char of mask) {
    if (char === '9') pattern += '0';
    else if (IMASK_SPECIAL.has(char)) pattern += `\\${char}`;
    else pattern += char;
  }
  return pattern;
}

// ---------------------------------------------------------------------------------------------
// Дерево вариантов
// ---------------------------------------------------------------------------------------------

/**
 * Узел дерева вариантов — та же форма, что `nodes` у `ComboboxTree` из ui-kit: на ней держится
 * одна схема формы на два кита. Поля оформления ui-kit (`badge`, `loading`, …) HexaUI не рисует.
 */
export interface HexaTreeNode {
  /** Адрес узла, уникальный в пределах дерева; он же значение поля. */
  id: string;
  /** Видимая подпись строки; по ней идёт поиск. */
  label: string;
  /** Ветка или лист. По умолчанию выводится из наличия `children`. */
  kind?: 'branch' | 'leaf';
  /** Дети — такие же узлы. */
  children?: HexaTreeNode[];
  /** Подсказка при наведении; по умолчанию `label`. */
  title?: string;
  /** Строку нельзя выбрать. */
  disabled?: boolean;
}

/** Что можно выбрать в дереве: `leaf` — только листья (умолчание ui-kit), `all` — и ветки. */
export type TreeSelectable = 'all' | 'leaf';

/** Узел antd `TreeSelect` (`treeData`). */
export interface AntdTreeNode {
  value: string;
  title: string;
  disabled?: boolean;
  selectable?: boolean;
  children?: AntdTreeNode[];
}

/** Ветка ли узел: явный `kind` главнее наличия детей. */
const isBranch = (node: HexaTreeNode): boolean =>
  node.kind === undefined ? (node.children?.length ?? 0) > 0 : node.kind === 'branch';

/** `nodes` в форме ui-kit → `treeData` antd `TreeSelect`. */
export function treeDataOf(
  nodes: readonly HexaTreeNode[],
  selectable: TreeSelectable = 'leaf'
): AntdTreeNode[] {
  return nodes.map((node) => {
    const converted: AntdTreeNode = { value: node.id, title: node.label };
    if (node.disabled === true) converted.disabled = true;
    if (selectable === 'leaf' && isBranch(node)) converted.selectable = false;
    if (node.children !== undefined) converted.children = treeDataOf(node.children, selectable);
    return converted;
  });
}

// ---------------------------------------------------------------------------------------------
// Файлы
// ---------------------------------------------------------------------------------------------

/** Элемент списка HexaUI `Uploader` — то, что из него читает обёртка. */
export interface UploadListItem {
  uid: string;
  name: string;
  size: number;
  lastModified?: number;
  originFileObj?: File;
}

/**
 * Файлы модели → список `Uploader`. Идентификатор берётся у самого файла (`uid`, который ставит
 * rc-upload), иначе — у `uidOf`: список обязан быть стабилен между отрисовками, иначе удаление
 * по `uid` не найдёт элемент.
 */
export function uploadListOf(
  files: readonly File[],
  uidOf: (file: File) => string
): UploadListItem[] {
  return files.map((file) => ({
    uid: (file as File & { uid?: string }).uid ?? uidOf(file),
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    originFileObj: file,
  }));
}

/** Список `Uploader` → файлы модели: исходные `File`; элементы без файла пропускаются. */
export function filesOf(list: readonly UploadListItem[]): File[] {
  return list.flatMap((item) => (item.originFileObj === undefined ? [] : [item.originFileObj]));
}

// ---------------------------------------------------------------------------------------------
// Недельное расписание
// ---------------------------------------------------------------------------------------------

/** Дни недели в порядке HexaUI `WeeklySchedule` — его ключи. */
export const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Полное расписание: все семь дней по 24 флага. */
export type FullWeeklySchedule = Record<(typeof WEEK_DAYS)[number], number[]> & WeeklyScheduleValue;

/** Значение модели → начальное состояние `WeeklySchedule`: все семь дней, по 24 флага `0`/`1`. */
export function scheduleOf(value: unknown): FullWeeklySchedule {
  const source = isSchedule(value) ? value : {};
  const full = Object.fromEntries(
    WEEK_DAYS.map((day) => [day, dayFlags(source[day]).map((flag) => (flag ? 1 : 0))])
  );
  return full as FullWeeklySchedule;
}

/** Одинаковы ли расписания по отмеченным часам; `null` и пустое расписание равны. */
export function sameSchedule(a: unknown, b: unknown): boolean {
  const left = scheduleOf(a);
  const right = scheduleOf(b);
  return WEEK_DAYS.every((day) => left[day].every((flag, hour) => flag === right[day][hour]));
}

// ---------------------------------------------------------------------------------------------
// Документ редактора
// ---------------------------------------------------------------------------------------------

/** Текст узла slate: листья — `{ text }`, элементы — `{ children }`. */
function textOf(node: unknown): string {
  if (node === null || typeof node !== 'object') return '';
  const { text, children } = node as { text?: unknown; children?: unknown };
  if (typeof text === 'string') return text;
  return Array.isArray(children) ? children.map(textOf).join('') : '';
}

/**
 * Пуст ли документ редактора: slate держит пустой документ абзацем с пустым текстом, и
 * «ничего не введено» у поля — `null`, а не такой абзац.
 */
export function isEmptyDocument(value: unknown): boolean {
  return !Array.isArray(value) || value.every((node) => textOf(node).trim() === '');
}

/**
 * Тот же ли документ: оба пусты либо узлы верхнего уровня — те же объекты. Адаптер отдаёт модели
 * копию массива, но узлы в ней прежние — по ним отклик модели и отличается от внешней правки.
 */
export function sameDocument(a: unknown, b: unknown): boolean {
  if (isEmptyDocument(a) && isEmptyDocument(b)) return true;
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((node, index) => node === b[index])
  );
}
