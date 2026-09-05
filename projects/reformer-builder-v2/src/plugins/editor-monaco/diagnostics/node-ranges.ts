/**
 * Перевод «узел → диапазон» — разбором текста с позициями.
 *
 * Так требует контракт диагностики (`docs/editors-and-preview.md`): у записи ровно одна цель,
 * структурная ошибка адресуется **идентификатором узла**, а перевод в диапазон делает тот,
 * кто РИСУЕТ, по тексту, который сейчас в редакторе. В v1 диапазон для узла вычисляется
 * симуляцией печати, и поэтому подчёркивание уезжает на иначе отформатированном JSON;
 * здесь позиция берётся из самого текста и уехать не может.
 *
 * ## Почему свой проход, а не `JSON.parse`
 *
 * `JSON.parse` позиций не отдаёт вовсе — ни узлам, ни ключам. Полноценный разбор с позициями
 * (`jsonc-parser`) — это зависимость и дерево на каждый показ диагностик; здесь нужно ровно
 * два отношения — «идентификатор → место» и «путь → место», — и один проход по строке даёт
 * оба за O(n) без промежуточного дерева.
 *
 * ## Два ключа у одного указателя
 *
 * Идентификаторы **выдаются при разборе, а записываются при первом сохранении** — нетронутый
 * файл не получает шумного diff. Значит в тексте только что открытого файла `$nodeId` может
 * не быть ни одного, и по идентификатору узел не найти. Ровно так выглядит каждая форма,
 * пришедшая из кодогена или написанная руками: валидатор находит ошибки, панель проблем
 * их показывает, а в редакторе не подчёркнуто ничего.
 *
 * Поэтому указатель ключуется дважды. По идентификатору — когда он в тексте есть. По **пути**
 * объекта в JSON — всегда: путь у объекта есть с первого символа, а «идентификатор → путь»
 * знает модель документа, разобранная платформой (ей идентификаторы выданы в памяти). Тот, кто
 * рисует, спрашивает у порта путь узла и переводит его в диапазон здесь — по тому тексту,
 * который перед человеком. Путь при этом никуда не записывается и в диагностику не попадает:
 * он вычисляется в момент показа и устаревает вместе с показом, чего нельзя было бы сказать
 * о пути, положенном в саму находку.
 *
 * ## Что подчёркивается у узла без идентификатора
 *
 * Не объект целиком — контейнер занимает сотни строк, и маркер на всём поддереве закрашивает
 * половину файла. Якорь выбирается по говорящести: значение `component` (там стоит имя, которого
 * нет в каталоге), иначе первый ключ объекта, иначе открывающая скобка. Для узла с
 * идентификатором якорем остаётся сам идентификатор — короткий и однозначный.
 *
 * ## Свойство внутри узла ищется отдельным проходом, а не третьей картой указателя
 *
 * Находка вида «у компонента нет свойства `readOnly`» относится не к узлу целиком, а к одному
 * его свойству, и подчёркивать в ней идентификатор — значит показывать на единственное место
 * узла, которое к ошибке отношения не имеет. Место свойства ищет {@link memberRange} —
 * по пути ОТ УЗЛА, внутри уже известного диапазона узла.
 *
 * Проходом по узлу, а не записью в указатель, потому что счёт разный: свойств в документе
 * тысячи, а находок с путём — единицы. Класть в карту каждое свойство значило бы платить
 * на КАЖДОЙ правке текста за то, что понадобится в трёх случаях из тысячи; проход по одному
 * узлу стоит его размера и делается ровно столько раз, сколько таких находок.
 *
 * Подчёркивается ИМЯ свойства, а значение — только когда виновато оно (`$component(Inpit)`,
 * «must be boolean»), и только если это не поддерево: у `componentProps` значение — сотни
 * строк, и маркер на нём вернул бы ровно ту закраску пол-файла, ради которой заведён якорь.
 *
 * Экранирование внутри строк не разворачивается: сравнение идёт по сырому содержимому,
 * а служебный ключ и восемь символов base36 экранирования не содержат. Закрывающую кавычку
 * при этом проход ищет честно — `"a\"b"` заканчивается там, где надо. Имя свойства с
 * экранированием внутри (`"a\"b"`) по этой же причине не совпадёт с именем из модели —
 * находка тогда честно подчёркивает узел, а не соседнее свойство.
 *
 * @module plugins/editor-monaco/diagnostics/node-ranges
 */

import type { TextRange } from '@/sdk';

/**
 * Имя поля идентификатора. Форма — `^[0-9a-z]{8}$`, но проверять её здесь незачем:
 * искать надо то, что записал провайдер модели, а не то, что мы считаем правильным.
 */
export const NODE_ID_KEY = '$nodeId';

/** Ключ, чьё значение — самое говорящее место узла без идентификатора. */
const COMPONENT_KEY = 'component';

/** Путь значения в JSON: ключи объектов и индексы массивов от корня документа. */
export type TextPath = readonly (string | number)[];

/** Где узел лежит в тексте. */
export interface NodeLocation {
  /**
   * Короткий якорь для подчёркивания: идентификатор вместе с кавычками, а у узла без него —
   * значение `component`, первый ключ или скобка (см. шапку модуля).
   *
   * Подчёркивать узел целиком нельзя: контейнер занимает сотни строк, и маркер на всём
   * поддереве не показывает, где ошибка, — он закрашивает половину файла.
   */
  readonly anchor: TextRange;
  /** Объект узла целиком, от `{` до `}`. Нужен выделению и переходу к узлу, не маркеру. */
  readonly node: TextRange;
}

/** Указатель по тексту: объекты по идентификатору и по пути. */
export interface TextNodeIndex {
  /** Узлы, у которых идентификатор записан в тексте. */
  readonly byId: ReadonlyMap<string, NodeLocation>;
  /** Каждый объект текста по своему пути — ключ считает {@link pathKey}. */
  readonly byPath: ReadonlyMap<string, NodeLocation>;
}

/**
 * Ключ пути для {@link TextNodeIndex.byPath}.
 *
 * Сериализация, а не склейка через разделитель: ключ объекта вправе содержать любой символ,
 * и «/» в имени свойства дал бы два разных пути с одним ключом.
 */
export function pathKey(path: TextPath): string {
  return JSON.stringify(path);
}

interface Frame {
  readonly start: number;
  readonly object: boolean;
  readonly path: TextPath;
  /** Объект: ключ, чьё значение читается сейчас. */
  key: string | null;
  /** Массив: индекс следующего значения. */
  index: number;
  nodeId: string | null;
  idAnchor: TextRange | null;
  componentAnchor: TextRange | null;
  firstKey: TextRange | null;
}

interface StringToken {
  readonly value: string;
  /** Индекс сразу за закрывающей кавычкой. */
  readonly end: number;
}

/** Читает строковый литерал, начинающийся кавычкой в позиции `at`. `null` — литерал не закрыт. */
function readString(text: string, at: number): StringToken | null {
  let i = at + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"') return { value: text.slice(at + 1, i), end: i + 1 };
    i += 1;
  }
  return null;
}

function skipWhitespace(text: string, at: number): number {
  let i = at;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

/** Путь значения, которое сейчас начинается внутри `parent`; у корня документа путь пуст. */
function childPath(parent: Frame | undefined): TextPath {
  if (parent === undefined) return [];
  if (parent.object) return [...parent.path, parent.key ?? ''];
  return [...parent.path, parent.index];
}

/** Значение внутри `parent` дочитано: объект ждёт следующий ключ, массив — следующий индекс. */
function valueDone(parent: Frame | undefined): void {
  if (parent === undefined) return;
  if (parent.object) parent.key = null;
  else parent.index += 1;
}

/** Якорь объекта по говорящести — см. шапку модуля. */
function anchorOf(frame: Frame): TextRange {
  return (
    frame.idAnchor ??
    frame.componentAnchor ??
    frame.firstKey ?? { start: frame.start, end: frame.start + 1 }
  );
}

/**
 * Строит указатель по тексту: объекты по идентификатору и по пути.
 *
 * Повторный идентификатор — ошибка схемы, и находит её валидатор; здесь выигрывает первое
 * вхождение. Выбор произвольный, но детерминированный: диагностика обязана указывать
 * на одно и то же место при каждом показе одного и того же текста.
 *
 * Незакрытая строка, лишняя скобка, оборванный файл — не повод отказываться от уже
 * найденного: набранный наполовину JSON это НОРМАЛЬНОЕ состояние буфера, и половина
 * указателя лучше, чем ничего.
 */
export function indexTextNodes(text: string): TextNodeIndex {
  const byId = new Map<string, NodeLocation>();
  const byPath = new Map<string, NodeLocation>();
  const stack: Frame[] = [];
  const top = (): Frame | undefined => stack[stack.length - 1];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      const token = readString(text, i);
      if (token === null) break;
      const frame = top();
      const after = skipWhitespace(text, token.end);
      // Ключ — строка перед двоеточием внутри объекта. Внутри массива двоеточия не бывает,
      // а если оно там есть, текст уже не JSON, и строка честнее считается значением.
      if (frame?.object === true && text[after] === ':') {
        frame.key = token.value;
        frame.firstKey ??= { start: i, end: token.end };
        i = after + 1;
        continue;
      }
      if (frame?.object === true) {
        if (frame.key === NODE_ID_KEY) {
          frame.nodeId = token.value;
          frame.idAnchor = { start: i, end: token.end };
        } else if (frame.key === COMPONENT_KEY) {
          frame.componentAnchor = { start: i, end: token.end };
        }
      }
      valueDone(frame);
      i = token.end;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push({
        start: i,
        object: ch === '{',
        path: childPath(top()),
        key: null,
        index: 0,
        nodeId: null,
        idAnchor: null,
        componentAnchor: null,
        firstKey: null,
      });
      i += 1;
      continue;
    }

    if (ch === '}' || ch === ']') {
      const frame = stack.pop();
      if (frame !== undefined) {
        if (frame.object) {
          const node: TextRange = { start: frame.start, end: i + 1 };
          byPath.set(pathKey(frame.path), { anchor: anchorOf(frame), node });
          if (frame.nodeId !== null && frame.idAnchor !== null && !byId.has(frame.nodeId)) {
            byId.set(frame.nodeId, { anchor: frame.idAnchor, node });
          }
        }
        valueDone(top());
      }
      i += 1;
      continue;
    }

    if (ch === ',') {
      const frame = top();
      if (frame?.object === true) frame.key = null;
      i += 1;
      continue;
    }

    if (ch === ':' || /\s/.test(ch)) {
      i += 1;
      continue;
    }

    // Число, `true`, `false`, `null`: значение без кавычек. Считается, а не пропускается —
    // иначе индексы соседей в массиве сместились бы на каждое такое значение.
    let end = i;
    while (end < text.length && !/[\s,\]}]/.test(text[end])) end += 1;
    valueDone(top());
    i = Math.max(end, i + 1);
  }

  return { byId, byPath };
}

/** Указатель «идентификатор узла → место в тексте» — половина {@link indexTextNodes}. */
export function indexNodeRanges(text: string): ReadonlyMap<string, NodeLocation> {
  return indexTextNodes(text).byId;
}

/** Место свойства внутри узла. */
export interface MemberRange {
  /** Имя свойства вместе с кавычками. `null` — элемент массива: имени у него нет. */
  readonly name: TextRange | null;
  /** Значение свойства целиком — от первого символа до последнего. */
  readonly value: TextRange;
  /**
   * Значение — примитив, а не объект или массив.
   *
   * Различие нужно тому, кто подчёркивает: у поддерева значение занимает сотни строк,
   * и маркер на нём закрашивает пол-файла — ровно то, ради чего у узла заведён короткий якорь.
   */
  readonly scalar: boolean;
}

/** Индекс сразу за значением, начинающимся в `at`. `-1` — значение не дочитано (обрыв текста). */
function skipValue(text: string, at: number, limit: number): number {
  const ch = text[at];
  if (ch === '"') {
    const token = readString(text, at);
    return token === null || token.end > limit ? -1 : token.end;
  }
  if (ch === '{' || ch === '[') {
    // Глубина скобок со строками, пропущенными целиком: скобка внутри строки не считается.
    let depth = 0;
    let i = at;
    while (i < limit) {
      const c = text[i];
      if (c === '"') {
        const token = readString(text, i);
        if (token === null || token.end > limit) return -1;
        i = token.end;
        continue;
      }
      if (c === '{' || c === '[') depth += 1;
      else if (c === '}' || c === ']') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
      i += 1;
    }
    return -1;
  }
  // Число, `true`, `false`, `null`.
  let i = at;
  while (i < limit && !/[\s,\]}]/.test(text[i])) i += 1;
  return i === at ? -1 : i;
}

/** Прямой член контейнера, начинающегося в `start`, по одному сегменту пути. */
function memberAt(
  text: string,
  start: number,
  limit: number,
  segment: string | number
): MemberRange | undefined {
  const open = text[start];
  if (open !== '{' && open !== '[') return undefined;
  const object = open === '{';
  const wanted = String(segment);
  let i = start + 1;
  let index = 0;

  while (i < limit) {
    i = skipWhitespace(text, i);
    const ch = text[i];
    if (ch === undefined || ch === '}' || ch === ']') return undefined;
    if (ch === ',') {
      i += 1;
      continue;
    }

    let name: TextRange | null = null;
    if (object) {
      // В объекте всё, что не имя, — уже не JSON: дальше идти не по чему.
      if (ch !== '"') return undefined;
      const token = readString(text, i);
      if (token === null) return undefined;
      name = { start: i, end: token.end };
      const colon = skipWhitespace(text, token.end);
      if (text[colon] !== ':') return undefined;
      i = skipWhitespace(text, colon + 1);
      // Повтор имени в одном объекте: выигрывает ПЕРВОЕ, и это защита, а не только
      // детерминизм. `JSON.parse` оставил бы последнее, но текст в буфере бывает сломан
      // так, что «последнее» лежит уже за пределами узла (пропущенная скобка склеивает
      // его с соседом) — и маркер уехал бы в чужой узел. Первое вхождение такого сделать
      // не может: оно заведомо внутри того объекта, с которого проход начался.
      if (token.value !== wanted) {
        const next = skipValue(text, i, limit);
        if (next === -1) return undefined;
        i = next;
        continue;
      }
      // Сравнение по ИМЕНИ, а не по счёту: числовой ключ объекта (`"0"`) приходит из разбора
      // пути числом, но индексом массива от этого не становится.
    } else if (index !== Number(segment)) {
      const next = skipValue(text, i, limit);
      if (next === -1) return undefined;
      i = next;
      index += 1;
      continue;
    }

    const end = skipValue(text, i, limit);
    if (end === -1) return undefined;
    const head = text[i];
    return {
      name,
      value: { start: i, end },
      scalar: head !== '{' && head !== '[',
    };
  }
  return undefined;
}

/**
 * Место свойства по пути ОТ УЗЛА — внутри уже известного диапазона узла.
 *
 * Путь пустой или ведущий в никуда (текст успел уехать от модели, свойство уже переименовано,
 * имя содержит экранирование) — `undefined`: тогда подчёркивается сам узел, и это ровно то
 * поведение, которое было до появления путей.
 *
 * **Сегмент-имя самопроверяем, сегмент-индекс — нет.** Имя сверяется с текстом, поэтому на
 * соседнее СВОЙСТВО проход промахнуться не может: разошёлся текст с моделью — путь не сойдётся
 * и отдаст откат. Индекс элемента массива сверять не с чем, он просто считается; вставка
 * элемента между проходом валидатора и показом уводит место на соседний элемент. Это цена
 * точности внутри массивов (`componentProps.options[1]`), и другого способа её получить нет:
 * у элемента нет ни имени, ни идентификатора. Окно ошибки — один такт валидатора.
 */
export function memberRange(
  text: string,
  node: TextRange,
  path: TextPath
): MemberRange | undefined {
  if (path.length === 0) return undefined;
  const limit = Math.min(node.end, text.length);
  let at = node.start;
  for (let depth = 0; depth < path.length; depth += 1) {
    const found = memberAt(text, at, limit, path[depth]);
    if (found === undefined) return undefined;
    if (depth === path.length - 1) return found;
    at = found.value.start;
  }
  return undefined;
}
