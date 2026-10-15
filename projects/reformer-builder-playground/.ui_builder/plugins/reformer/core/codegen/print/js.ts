/**
 * Печать конструкций TypeScript так, как их раскладывает prettier репозитория.
 *
 * ## Что здесь
 *
 * - **литерал значения** в стиле JS ({@link printLiteral}): ключи без кавычек, строки в одинарных,
 *   хвостовые запятые, массив в строку, если помещается;
 * - **импорт** ({@link printImport}) и **заголовок функции** ({@link printSignature}) с переносом
 *   по ширине;
 * - **оператор** ({@link formatStatement}): вызов, объявление `const`, `return` — разобранные на
 *   аргументы и уложенные заново. Им переукладываются строки, напечатанные билдерами
 *   `@reformer/mcp`, и строки шаблонов, чья длина зависит от имён формы.
 *
 * ## Разбор — структурный, а не синтаксический
 *
 * Оператор режется по скобкам и запятым верхнего уровня: вызов — на аргументы, массив — на
 * элементы, объект — на свойства, стрелка — на заголовок и тело. Всё остальное — АТОМ: текст,
 * который печатается как есть и не рвётся. Выражение разбирать незачем: его пишет человек
 * (условие правила, тело обработчика), и переписывать его раскладку значило бы угадывать.
 *
 * Отсюда граница: атом, не помещающийся в строку, prettier порвал бы изнутри (по `&&`, по цепочке
 * вызовов) — здесь он остаётся длинной строкой. Текст, который не удалось разобрать (скобки не
 * сходятся, регулярное выражение со скобкой), печатается без изменений.
 *
 * Формы документов повторяют печать prettier 3 (`printCallArguments`, `printArrowFunction`,
 * `printArray`, `printObject`, `printAssignment`); совпадение держит тест, сверяющий вывод с
 * настоящим форматтером.
 *
 * @module plugins/reformer/core/codegen/print/js
 */

import {
  breakParent,
  conditionalGroup,
  fill,
  group,
  hardline,
  ifBreak,
  indent,
  indentIfBreak,
  join,
  line,
  printDoc,
  softline,
  TAB_WIDTH,
  widthOf,
  willBreak,
  type Doc,
  type PrintOptions,
} from './doc';

// ── Строки и ключи ──────────────────────────────────────────────────────────

/** Соединители нулевой ширины: в имени допустимы, а в `ID_Continue` не входят. */
const ZERO_WIDTH_JOINERS = String.fromCharCode(0x200c, 0x200d);

/** Разделители строки и абзаца: в строковом литерале пишутся только экранированными. */
const LINE_SEPARATORS = String.fromCharCode(0x2028, 0x2029);

/** Имя, которое можно писать ключом объекта без кавычек. */
const IDENTIFIER_NAME = new RegExp(
  `^[$_\\p{ID_Start}][$${ZERO_WIDTH_JOINERS}\\p{ID_Continue}]*$`,
  'u'
);

/** Знак, экранирование которого prettier считает лишним и снимает (`\d` → `d`). */
const NEEDLESS_ESCAPE = new RegExp(`^[^\\n\\r"'0-7\\\\bfnrt-vx${LINE_SEPARATORS}]$`);

/** Управляющие знаки и разделители строк — в литерале только кодом. */
const UNPRINTABLE = new RegExp(`[\\x00-\\x1f\\x7f${LINE_SEPARATORS}]`, 'g');

/**
 * Обернуть «сырое» содержимое строки в кавычки по правилу prettier: одинарные, а если в тексте
 * одинарных больше, чем двойных, — двойные; кавычка выбранного вида экранируется.
 */
function enquote(raw: string): string {
  const singles = (raw.match(/'/g) ?? []).length;
  const doubles = (raw.match(/"/g) ?? []).length;
  const quoteChar = singles > doubles ? '"' : "'";
  const other = quoteChar === '"' ? "'" : '"';
  const body = raw.replace(/\\(.)|(["'])/gs, (match, escaped?: string, q?: string) => {
    // Экранированная кавычка другого вида — лишняя: экранирование снимается.
    if (escaped === other) return escaped;
    if (q === quoteChar) return `\\${q}`;
    if (q !== undefined) return q;
    return escaped !== undefined && NEEDLESS_ESCAPE.test(escaped) ? escaped : match;
  });
  return `${quoteChar}${body}${quoteChar}`;
}

/** Содержимое строкового литерала без кавычек: экранировано всё, кроме самих кавычек. */
function rawString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(UNPRINTABLE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Строковый литерал значения. */
export function quote(value: string): string {
  return enquote(rawString(value));
}

/** Ключ объектного литерала: именем, если можно, иначе строкой. */
export function propertyKey(key: string): string {
  return IDENTIFIER_NAME.test(key) ? key : quote(key);
}

// ── Узлы ────────────────────────────────────────────────────────────────────

/** Свойство объектного литерала. */
export interface JsProperty {
  /** Ключ как он печатается (`name`, `'a-b'`, `[expr]`); у распространения — `...expr`. */
  readonly key: string;
  /** Значение; `null` — сокращённая запись либо распространение. */
  readonly value: JsNode | null;
}

/** Оператор блока: уложенный документ либо текст как есть. */
export interface JsStatement {
  /** Пустая строка перед оператором. */
  readonly blankBefore: boolean;
  /** Строки оператора, напечатанные без изменений (относительные отступы — в самих строках). */
  readonly raw?: readonly string[];
  /** Разобранный оператор. */
  readonly parsed?: ParsedStatement;
}

export type JsNode =
  /** Текст, который печатается как есть. */
  | {
      readonly kind: 'atom';
      readonly text: string;
      /** Тернарный оператор верхнего уровня: телом стрелки он берётся в скобки. */
      readonly conditional: boolean;
      /** Выражение целиком — вызов: телом стрелки оно «обнимается» последним аргументом. */
      readonly callLike: boolean;
    }
  | { readonly kind: 'string'; readonly raw: string }
  /** Число либо булево: после оператора не переносится. */
  | { readonly kind: 'literal'; readonly text: string; readonly numeric: boolean }
  | { readonly kind: 'array'; readonly elements: readonly JsNode[] }
  | {
      readonly kind: 'object';
      readonly props: readonly JsProperty[];
      /** Объект обязан остаться развёрнутым (в исходном тексте первый ключ стоял с новой строки). */
      readonly expanded: boolean;
    }
  | { readonly kind: 'call'; readonly callee: string; readonly args: readonly JsNode[] }
  | {
      readonly kind: 'arrow';
      /** Заголовок как есть: `async (a: T, b)`, `(...args: unknown[])`, `({ model: item })`. */
      readonly head: string;
      readonly body: JsNode | JsBlock;
      /** Параметров нет — так узнаётся хук с массивом зависимостей. */
      readonly noParams: boolean;
    };

export interface JsBlock {
  readonly kind: 'block';
  readonly statements: readonly JsStatement[];
}

function atom(text: string): JsNode {
  return { kind: 'atom', text, conditional: false, callLike: false };
}

// ── Значение → узел ─────────────────────────────────────────────────────────

/** Значение JS (то, что переживает JSON) → узел. Непустые объекты всегда развёрнуты. */
export function valueNode(value: unknown): JsNode {
  if (value === null) return atom('null');
  if (value === undefined) return atom('undefined');
  if (typeof value === 'string') return { kind: 'string', raw: rawString(value) };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return atom('null');
    return { kind: 'literal', text: String(value).replace('e+', 'e'), numeric: true };
  }
  if (typeof value === 'boolean') return { kind: 'literal', text: String(value), numeric: false };
  if (Array.isArray(value)) return { kind: 'array', elements: value.map(valueNode) };
  if (typeof value === 'object') {
    const json = (value as { toJSON?: unknown }).toJSON;
    if (typeof json === 'function') return valueNode((json as () => unknown).call(value));
    const props = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && typeof item !== 'function')
      .map(([key, item]): JsProperty => ({ key: propertyKey(key), value: valueNode(item) }));
    return { kind: 'object', props, expanded: props.length > 0 };
  }
  return atom('undefined');
}

// ── Разбор текста ───────────────────────────────────────────────────────────

const OPEN = '([{';
const CLOSE = ')]}';

/** Знаки, после которых `/` начинает регулярное выражение, а не делит. */
const BEFORE_REGEX = '(,=:[!&|?{};+-*%<>~^';

/**
 * Конец литерала регулярного выражения, начатого по индексу `start` (индекс последнего флага),
 * либо `-1`, если литерал не закрыт в своей строке — тогда `/` считается делением.
 */
function regexEnd(text: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\n') return -1;
    if (char === '\\') i += 1;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) {
      let end = i;
      while (/[a-z]/.test(text[end + 1] ?? '')) end += 1;
      return end;
    }
  }
  return -1;
}

/**
 * Пройти текст, пропуская строки, шаблонные строки, комментарии и регулярные выражения.
 *
 * Регулярное выражение пропускается целиком: запятая или скобка внутри `/a,b/` — не разделитель
 * аргументов, и разрезанный по ней литерал уехал бы в файл испорченным.
 *
 * `visit` получает каждый значимый знак и глубину вложенности скобок ВОКРУГ него (у скобки —
 * глубину снаружи). Возвращает `false`, если скобки не сошлись.
 */
function scan(
  text: string,
  visit: (char: string, index: number, depth: number) => void,
  onComment?: (depth: number) => void
): boolean {
  let depth = 0;
  let i = 0;
  // Последний значимый знак: по нему `/` отличается от деления.
  let last = '';
  const skipString = (quoteChar: string): boolean => {
    i += 1;
    while (i < text.length) {
      const char = text[i];
      if (char === '\\') i += 2;
      else if (char === quoteChar) return true;
      else if (char === '\n' && quoteChar !== '`') return false;
      else if (quoteChar === '`' && char === '$' && text[i + 1] === '{') {
        // Подстановка: до парной фигурной скобки, со своими вложенными строками.
        let braces = 1;
        i += 2;
        while (i < text.length && braces > 0) {
          const inner = text[i];
          if (inner === '{') braces += 1;
          else if (inner === '}') braces -= 1;
          else if (inner === "'" || inner === '"' || inner === '`') {
            if (!skipString(inner)) return false;
          }
          if (braces > 0) i += 1;
        }
        if (braces > 0) return false;
        i += 1;
      } else i += 1;
    }
    return false;
  };
  while (i < text.length) {
    const char = text[i] as string;
    if (char === "'" || char === '"' || char === '`') {
      const start = i;
      if (!skipString(char)) return false;
      visit(char, start, depth);
      last = char;
      i += 1;
      continue;
    }
    if (char === '/' && text[i + 1] === '/') {
      onComment?.(depth);
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end;
      continue;
    }
    if (char === '/' && text[i + 1] === '*') {
      onComment?.(depth);
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return false;
      i = end + 2;
      continue;
    }
    if (char === '/' && (last === '' || BEFORE_REGEX.includes(last))) {
      const end = regexEnd(text, i);
      if (end > i) {
        visit(char, i, depth);
        last = char;
        i = end + 1;
        continue;
      }
    }
    if (!/\s/.test(char)) last = char;
    if (OPEN.includes(char)) {
      visit(char, i, depth);
      depth += 1;
    } else if (CLOSE.includes(char)) {
      depth -= 1;
      if (depth < 0) return false;
      visit(char, i, depth);
    } else {
      visit(char, i, depth);
    }
    i += 1;
  }
  return depth === 0;
}

/**
 * Есть ли комментарий на верхнем уровне текста — рядом с оператором, а не внутри его скобок.
 *
 * Такой оператор не укладывается заново: комментарий после `;` привязан к своей строке, и
 * перенос оператора унёс бы его в другое место.
 */
function hasTopComment(text: string): boolean {
  let found = false;
  scan(
    text,
    () => undefined,
    (depth) => {
      if (depth === 0) found = true;
    }
  );
  return found;
}

/** Скобки, строки и комментарии текста сходятся. */
function isBalanced(text: string): boolean {
  return scan(text, () => undefined);
}

/** Индекс скобки, закрывающей ту, что стоит по индексу `open`; `-1`, если не нашлась. */
function matchingClose(text: string, open: number): number {
  let found = -1;
  let base = -1;
  const ok = scan(text, (char, index, depth) => {
    if (index === open) base = depth;
    else if (found < 0 && base >= 0 && index > open && depth === base && CLOSE.includes(char)) {
      found = index;
    }
  });
  return ok ? found : -1;
}

/** Разрезать текст по разделителю верхнего уровня. Пустой хвост (висячая запятая) отбрасывается. */
function splitTop(text: string, separator: string): string[] | null {
  const cuts: number[] = [];
  const ok = scan(text, (char, index, depth) => {
    if (depth === 0 && char === separator) cuts.push(index);
  });
  if (!ok) return null;
  const parts: string[] = [];
  let from = 0;
  for (const cut of cuts) {
    parts.push(text.slice(from, cut));
    from = cut + 1;
  }
  parts.push(text.slice(from));
  const trimmed = parts.map((part) => part.trim());
  if (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') trimmed.pop();
  return trimmed;
}

/** Первое вхождение лексемы на верхнем уровне скобок; `-1`, если нет. */
function topIndexOf(text: string, token: string): number {
  let found = -1;
  scan(text, (_char, index, depth) => {
    if (found < 0 && depth === 0 && text.startsWith(token, index)) found = index;
  });
  return found;
}

/** Заголовок стрелки: имя либо список параметров в скобках, возможно с типом результата. */
function isArrowHead(head: string): boolean {
  const text = head.replace(/^async\s+/, '');
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return true;
  if (!text.startsWith('(')) return false;
  const close = matchingClose(text, 0);
  if (close < 0) return false;
  const rest = text.slice(close + 1).trim();
  return rest === '' || rest.startsWith(':');
}

/** У стрелки нет параметров. */
function hasNoParams(head: string): boolean {
  return /^(?:async\s+)?\(\s*\)$/.test(head);
}

/** Тернарный оператор на верхнем уровне: `?`, не являющийся `?.` и `??`, и `:` за ним. */
function isConditional(text: string): boolean {
  let question = -1;
  let colon = false;
  scan(text, (char, index, depth) => {
    if (depth !== 0) return;
    if (char === '?' && question < 0) {
      const next = text[index + 1];
      const prev = text[index - 1];
      if (next !== '.' && next !== '?' && prev !== '?') question = index;
    } else if (char === ':' && question >= 0) colon = true;
  });
  return question >= 0 && colon;
}

/** Вызываемое — простой путь: `validate`, `model.items.push`, `defineValidation<Form>`. */
const SIMPLE_CALLEE = /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:<[^()]*>)?$/;

/** Текст до списка аргументов похож на вызываемое выражение (цепочка без операторов). */
function isCalleeLike(callee: string): boolean {
  if (callee === '' || /^(?:await|typeof|void|delete|new|yield)\b/.test(callee)) return false;
  if (/^[!~+-]/.test(callee)) return false;
  // Пробел или бинарный оператор на верхнем уровне — это выражение, а не вызываемое.
  let plain = true;
  scan(callee, (char, _index, depth) => {
    if (depth === 0 && (/\s/.test(char) || '+*/%=&|^~,'.includes(char))) plain = false;
  });
  return plain && /[\w$)\]>]$/.test(callee);
}

/** Индекс скобки, открывающей список аргументов, который закрывается последним знаком текста. */
function trailingCallOpen(text: string): number {
  if (!text.endsWith(')')) return -1;
  let open = -1;
  const ok = scan(text, (char, index, depth) => {
    if (depth === 0 && char === '(') open = index;
  });
  return ok ? open : -1;
}

/** Целый текст — один строковый литерал в одинарных или двойных кавычках. */
function wholeString(text: string): string | null {
  const first = text[0];
  if ((first !== "'" && first !== '"') || text.length < 2 || !text.endsWith(first)) return null;
  for (let i = 1; i < text.length - 1; i += 1) {
    if (text[i] === '\\') i += 1;
    else if (text[i] === first || text[i] === '\n') return null;
  }
  // Последний знак экранирован — литерал не закрыт.
  let slashes = 0;
  for (let i = text.length - 2; i > 0 && text[i] === '\\'; i -= 1) slashes += 1;
  return slashes % 2 === 0 ? text.slice(1, -1) : null;
}

/** Разобрать свойства объектного литерала; `null` — встретилась запись, которую не разбираем. */
function parseProperties(inner: string): JsProperty[] | null {
  const parts = splitTop(inner, ',');
  if (parts === null) return null;
  const props: JsProperty[] = [];
  for (const part of parts) {
    if (part === '') return null;
    if (part.startsWith('...')) {
      props.push({ key: part, value: null });
      continue;
    }
    const colon = topIndexOf(part, ':');
    if (colon < 0) {
      // Сокращённая запись — только имя; метод и геттер не разбираем.
      if (!/^[A-Za-z_$][\w$]*$/.test(part)) return null;
      props.push({ key: part, value: null });
      continue;
    }
    const rawKey = part.slice(0, colon).trim();
    const text = wholeString(rawKey);
    let key: string;
    if (text !== null) {
      // Ключ в кавычках: снимаются, если ключ — имя и в нём нет экранирования.
      key = !text.includes('\\') && IDENTIFIER_NAME.test(text) ? text : enquote(text);
    } else if (/^[A-Za-z_$][\w$]*$/.test(rawKey) || /^\d+$/.test(rawKey)) {
      key = rawKey;
    } else if (rawKey.startsWith('[') && matchingClose(rawKey, 0) === rawKey.length - 1) {
      key = rawKey;
    } else {
      return null;
    }
    props.push({ key, value: parseExpression(part.slice(colon + 1)) });
  }
  return props;
}

/** Разобрать выражение в узел. Неразборчивое возвращается атомом — текстом как есть. */
export function parseExpression(source: string): JsNode {
  const text = source.trim();
  if (text === '' || !isBalanced(text)) return atom(text);

  const str = wholeString(text);
  if (str !== null) return { kind: 'string', raw: str };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: 'literal', text, numeric: true };
  if (text === 'true' || text === 'false') return { kind: 'literal', text, numeric: false };

  const arrowAt = topIndexOf(text, '=>');
  if (arrowAt > 0) {
    const head = text.slice(0, arrowAt).trim();
    if (isArrowHead(head)) {
      const bodyText = text.slice(arrowAt + 2).trim();
      const isBlock =
        bodyText.startsWith('{') && matchingClose(bodyText, 0) === bodyText.length - 1;
      return {
        kind: 'arrow',
        head,
        body: isBlock ? parseBlock(bodyText.slice(1, -1)) : parseExpression(bodyText),
        noParams: hasNoParams(head),
      };
    }
    return atom(text);
  }

  if (text.startsWith('[') && matchingClose(text, 0) === text.length - 1) {
    const parts = splitTop(text.slice(1, -1), ',');
    if (parts === null || parts.some((part) => part === '')) return atom(text);
    return { kind: 'array', elements: parts.map(parseExpression) };
  }

  if (text.startsWith('{') && matchingClose(text, 0) === text.length - 1) {
    const inner = text.slice(1, -1);
    const props = parseProperties(inner);
    if (props === null) return atom(text);
    return { kind: 'object', props, expanded: props.length > 0 && /^[ \t]*\r?\n/.test(inner) };
  }

  const open = trailingCallOpen(text);
  if (open > 0 && matchingClose(text, open) === text.length - 1) {
    const callee = text.slice(0, open).trim();
    if (SIMPLE_CALLEE.test(callee)) {
      const parts = splitTop(text.slice(open + 1, -1), ',');
      if (parts !== null && !parts.some((part) => part === '')) {
        return { kind: 'call', callee, args: parts.map(parseExpression) };
      }
    }
    if (isCalleeLike(callee)) return { kind: 'atom', text, conditional: false, callLike: true };
  }

  return { kind: 'atom', text, conditional: isConditional(text), callLike: false };
}

/** Оператор, разобранный на части. */
export type ParsedStatement =
  | { readonly kind: 'expression'; readonly node: JsNode }
  | { readonly kind: 'assignment'; readonly left: string; readonly right: JsNode }
  | { readonly kind: 'return'; readonly node: JsNode };

/** Операторы, которые начинаются ключевым словом и не являются выражением. */
const BLOCK_KEYWORD = /^(?:if|for|while|switch|try|do|function|class|else|case|default)\b/;

/** Знак `=` присваивания на верхнем уровне (не `=>`, `==`, `<=`, `>=`, `!=`). */
function assignmentAt(text: string): number {
  let found = -1;
  scan(text, (char, index, depth) => {
    if (found >= 0 || depth !== 0 || char !== '=') return;
    const prev = text[index - 1] ?? '';
    const next = text[index + 1] ?? '';
    if (next === '=' || next === '>' || '=!<>+-*/%&|^?'.includes(prev)) return;
    found = index;
  });
  return found;
}

/** Разобрать оператор; `null` — печатать как есть. */
export function parseStatement(source: string): ParsedStatement | null {
  const text = source.trim().replace(/;$/, '').trim();
  if (text === '' || text.startsWith('//') || text.startsWith('/*') || !isBalanced(text))
    return null;
  if (BLOCK_KEYWORD.test(text)) return null;

  if (/^return\b/.test(text)) {
    const rest = text.slice('return'.length).trim();
    if (rest === '') return null;
    const node = parseExpression(rest);
    // Атом после `return` prettier раскладывает по-своему (скобки у бинарного выражения) — не трогаем.
    return node.kind === 'atom' && !node.callLike ? null : { kind: 'return', node };
  }

  if (/^(?:export\s+)?(?:const|let|var)\s/.test(text)) {
    const at = assignmentAt(text);
    if (at < 0) return null;
    return {
      kind: 'assignment',
      left: text.slice(0, at).trim(),
      right: parseExpression(text.slice(at + 1)),
    };
  }

  const node = parseExpression(text);
  if (node.kind === 'call') return { kind: 'expression', node };
  return null;
}

/** Общий отступ непустых строк. */
function commonIndent(lines: readonly string[]): number {
  let min = Infinity;
  for (const text of lines) {
    if (text.trim() === '') continue;
    min = Math.min(min, text.length - text.trimStart().length);
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Разобрать тело блока на операторы.
 *
 * Оператор — строки до тех пор, пока скобки не сойдутся. Разобранный (вызов, объявление, `return`)
 * укладывается заново, остальное — комментарии, `if`, свободный текст человека — печатается как
 * есть, с сохранением относительных отступов.
 */
export function parseBlock(inner: string): JsBlock {
  const rawLines = inner.replace(/\r\n/g, '\n').split('\n');
  while (rawLines.length > 0 && (rawLines[0] as string).trim() === '') rawLines.shift();
  while (rawLines.length > 0 && (rawLines[rawLines.length - 1] as string).trim() === '')
    rawLines.pop();
  const pad = commonIndent(rawLines);
  const lines = rawLines.map((text) => text.slice(Math.min(pad, text.length)).trimEnd());

  const statements: JsStatement[] = [];
  let chunk: string[] = [];
  let blank = false;
  const flush = (): void => {
    if (chunk.length === 0) return;
    const text = chunk.join('\n');
    if (hasTopComment(text)) {
      // Комментарий либо оператор с комментарием в строке — как есть, без укладки.
      statements.push({ blankBefore: blank && statements.length > 0, raw: [...chunk] });
      chunk = [];
      blank = false;
      return;
    }
    const single = chunk.length === 1 ? (chunk[0] as string) : null;
    // Однострочный блок `{ a(); b() }` — несколько операторов через `;`.
    const pieces = single !== null ? (splitTop(single, ';') ?? [single]) : [text];
    pieces
      .filter((piece) => piece !== '')
      .forEach((piece, index) => {
        const parsed = parseStatement(piece);
        const blankBefore = index === 0 && blank && statements.length > 0;
        if (parsed !== null) statements.push({ blankBefore, parsed });
        else statements.push({ blankBefore, raw: terminated(piece).split('\n') });
      });
    chunk = [];
    blank = false;
  };
  for (const text of lines) {
    if (text.trim() === '' && chunk.length === 0) {
      blank = true;
      continue;
    }
    chunk.push(text);
    if (isBalanced(chunk.join('\n'))) flush();
  }
  flush();
  return { kind: 'block', statements };
}

/** Оператор-выражение без `;` в конце получает его: так его напечатал бы prettier. */
function terminated(text: string): string {
  const last = text.trimEnd();
  if (last.endsWith(';')) return last;
  if (last.endsWith('}') && BLOCK_KEYWORD.test(last)) return last;
  if (last.endsWith('{') || last.endsWith(',')) return last;
  return `${last};`;
}

// ── Узел → документ ─────────────────────────────────────────────────────────

interface NodeContext {
  /** Узел — последний аргумент вызова, который «обнимается» скобками. */
  readonly expandLastArg?: boolean;
  /** Печать JSON: без хвостовых запятых и без переноса после двоеточия. */
  readonly json?: boolean;
}

function isNumber(node: JsNode): boolean {
  return node.kind === 'literal' && node.numeric;
}

/** Массив из одних чисел печатается заполнением строки, а не по элементу на строку. */
function isConciseArray(node: JsNode): boolean {
  return node.kind === 'array' && node.elements.length > 0 && node.elements.every(isNumber);
}

function arrayDoc(node: Extract<JsNode, { kind: 'array' }>, ctx: NodeContext): Doc {
  const { elements } = node;
  if (elements.length === 0) return '[]';
  const inner: NodeContext = ctx.json === true ? { json: true } : {};
  const id = Symbol('array');
  // Несколько объектов (или массивов) с более чем одним свойством — всегда по одному на строку.
  const shouldBreak =
    elements.length > 1 &&
    elements.every((element, index) => {
      if (element.kind !== 'array' && element.kind !== 'object') return false;
      const next = elements[index + 1];
      if (next !== undefined && next.kind !== element.kind) return false;
      return (element.kind === 'array' ? element.elements.length : element.props.length) > 1;
    });
  const concise = isConciseArray(node);
  const comma = ctx.json === true ? '' : ',';
  let items: Doc;
  if (concise) {
    const parts: Doc[] = [];
    elements.forEach((element, index) => {
      const last = index === elements.length - 1;
      parts.push([nodeDoc(element, inner), last ? ifBreak(comma, '', id) : ',']);
      if (!last) parts.push(line);
    });
    items = fill(parts);
  } else {
    items = [
      join(
        [',', line],
        elements.map((element) => group(nodeDoc(element, inner)))
      ),
      ifBreak(comma),
    ];
  }
  return group(['[', indent([softline, items]), softline, ']'], { shouldBreak, id });
}

/** Ключ короче этого после оператора не переносит значение: выигрыш от переноса ничтожен. */
const SHORT_KEY = TAB_WIDTH + 3;

function propertyDoc(prop: JsProperty, ctx: NodeContext): Doc {
  if (prop.value === null) return prop.key;
  const value = nodeDoc(prop.value, ctx.json === true ? { json: true } : {});
  if (ctx.json === true) return [prop.key, ': ', value];
  return assignmentDoc(prop.key, ':', prop.value, value, widthOf(prop.key) < SHORT_KEY);
}

function objectDoc(node: Extract<JsNode, { kind: 'object' }>, ctx: NodeContext): Doc {
  if (node.props.length === 0) return '{}';
  const comma = ctx.json === true ? '' : ',';
  return group(
    [
      '{',
      indent([
        line,
        join(
          [',', line],
          node.props.map((prop) => propertyDoc(prop, ctx))
        ),
      ]),
      ifBreak(comma),
      line,
      '}',
    ],
    { shouldBreak: node.expanded }
  );
}

/**
 * Левая часть, оператор и значение — раскладка присваивания.
 *
 * Строка уходит на следующую строку целиком, если не помещается; число и булево от оператора не
 * отрываются; у остального сначала рвётся само значение (объект, массив, вызов), и только
 * непомещающийся атом переезжает под оператор.
 */
function assignmentDoc(
  left: string,
  operator: string,
  right: JsNode,
  rightDoc: Doc,
  shortKey = false
): Doc {
  if (right.kind === 'string' && !shortKey) {
    return group([left, operator, group(indent([line, rightDoc]))]);
  }
  if (shortKey || right.kind === 'literal') return group([left, operator, ' ', rightDoc]);
  const id = Symbol('assignment');
  return group([left, operator, group(indent(line), { id }), indentIfBreak(rightDoc, id)]);
}

function statementDoc(statement: ParsedStatement): Doc {
  switch (statement.kind) {
    case 'expression':
      return [nodeDoc(statement.node), ';'];
    case 'return':
      return ['return ', nodeDoc(statement.node), ';'];
    case 'assignment':
      return [assignmentDoc(statement.left, ' =', statement.right, nodeDoc(statement.right)), ';'];
  }
}

function blockDoc(block: JsBlock): Doc {
  if (block.statements.length === 0) return '{}';
  const parts: Doc[] = [];
  block.statements.forEach((statement, index) => {
    if (index > 0) parts.push(hardline);
    if (statement.blankBefore) parts.push(hardline);
    if (statement.parsed !== undefined) parts.push(statementDoc(statement.parsed));
    else parts.push(join(hardline, statement.raw ?? []));
  });
  return ['{', indent([hardline, parts]), hardline, '}'];
}

/**
 * Заголовок стрелки, который умеет рваться по параметрам: `(a, b): T`.
 *
 * Единственный параметр-деструктуризация «обнимается» — рвётся сам образец. У «обнятой» стрелки
 * (последний аргумент вызова) заголовок не рвётся вовсе: не поместился — рвутся все аргументы.
 */
function arrowHeadDoc(head: string, ctx: NodeContext): Doc {
  if (ctx.expandLastArg === true) return head;
  const prefix = /^async\s+/.test(head) ? 'async ' : '';
  const text = head.slice(head.match(/^async\s+/)?.[0].length ?? 0);
  if (!text.startsWith('(')) return head;
  const close = matchingClose(text, 0);
  const params = close < 0 ? null : splitTop(text.slice(1, close), ',');
  if (params === null || params.length === 0 || params.some((param) => param === '')) return head;
  const rest = text.slice(close + 1);
  const pattern = params.length === 1 ? objectPattern(params[0] as string) : null;
  if (pattern !== null) {
    return [
      prefix,
      '({',
      indent([line, join([',', line], pattern.names)]),
      ifBreak(','),
      line,
      '}',
      pattern.rest,
      ')',
      rest,
    ];
  }
  return group([prefix, '(', indent([softline, join([',', line], params)]), softline, ')', rest]);
}

function arrowDoc(node: Extract<JsNode, { kind: 'arrow' }>, ctx: NodeContext): Doc {
  const { body } = node;
  // «Обнятая» стрелка может оставить закрывающую скобку вызова на своей строке.
  const trailing: Doc = ctx.expandLastArg === true ? softline : '';
  let bodyDoc: Doc;
  if (body.kind === 'block') {
    bodyDoc = [' ', blockDoc(body)];
  } else if (body.kind === 'atom' && body.conditional) {
    // Тернарный оператор в строку берётся в скобки: `a => a ? b : c` читается как `a <= …`.
    bodyDoc = [
      ' ',
      group([ifBreak('', '('), indent([softline, body.text]), ifBreak('', ')'), trailing]),
    ];
  } else if (body.kind === 'array' || body.kind === 'object' || body.kind === 'arrow') {
    bodyDoc = [' ', nodeDoc(body)];
  } else {
    bodyDoc = [indent([line, nodeDoc(body)]), trailing];
  }
  return group([group(arrowHeadDoc(node.head, ctx)), ' =>', group(bodyDoc)]);
}

/** Аргумент можно «обнять»: порвать его самого, оставив остальные в строке вызова. */
function couldExpand(node: JsNode, arrowChain = false): boolean {
  if (node.kind === 'object') return node.props.length > 0;
  if (node.kind === 'array') return node.elements.length > 0;
  if (node.kind !== 'arrow') return false;
  const { body } = node;
  if (body.kind === 'block' || body.kind === 'object' || body.kind === 'array') return true;
  if (body.kind === 'arrow') return couldExpand(body, true);
  if (arrowChain) return false;
  return body.kind === 'call' || (body.kind === 'atom' && (body.callLike || body.conditional));
}

function isBlockArrow(node: JsNode | undefined): boolean {
  return node?.kind === 'arrow' && node.body.kind === 'block';
}

/** Среди аргументов больше одной функции с телом (либо вызов с функцией) — рвутся все. */
function isFunctionComposition(args: readonly JsNode[]): boolean {
  if (args.length <= 1) return false;
  let count = 0;
  for (const arg of args) {
    if (isBlockArrow(arg)) {
      count += 1;
      if (count > 1) return true;
    } else if (arg.kind === 'call' && arg.args.some(isBlockArrow)) {
      return true;
    }
  }
  return false;
}

/** Хук с массивом зависимостей: `useEffect(() => { … }, [a, b])` — аргументы не рвутся. */
function isHookCall(args: readonly JsNode[]): boolean {
  const at = args.length === 2 ? 0 : args.length === 3 && args[0]?.kind === 'atom' ? 1 : -1;
  if (at < 0) return false;
  const fn = args[at];
  return (
    fn?.kind === 'arrow' &&
    fn.noParams &&
    fn.body.kind === 'block' &&
    args[at + 1]?.kind === 'array'
  );
}

/** Короткий простой аргумент — рядом с ним «обнимается» первая функция. */
function isShortArgument(node: JsNode): boolean {
  if (node.kind === 'string' || node.kind === 'literal') return true;
  return node.kind === 'atom' && !node.conditional && /^[\w$.!-]+$/.test(node.text);
}

function shouldGroupFirst(args: readonly JsNode[]): boolean {
  if (args.length !== 2) return false;
  const [first, second] = args as [JsNode, JsNode];
  return (
    isBlockArrow(first) &&
    second.kind !== 'arrow' &&
    !(second.kind === 'atom' && second.conditional) &&
    isShortArgument(second) &&
    !couldExpand(second)
  );
}

function shouldGroupLast(args: readonly JsNode[]): boolean {
  const last = args[args.length - 1] as JsNode;
  const penultimate = args[args.length - 2];
  return (
    couldExpand(last) &&
    // Два последних аргумента одного вида — «обнимать» последний незачем.
    (penultimate === undefined || penultimate.kind !== last.kind) &&
    (args.length !== 2 || penultimate?.kind !== 'arrow' || last.kind !== 'array') &&
    !(args.length > 1 && isConciseArray(last))
  );
}

function argumentsDoc(args: readonly JsNode[]): Doc {
  if (args.length === 0) return '()';
  if (isHookCall(args))
    return [
      '(',
      join(
        ', ',
        args.map((arg) => nodeDoc(arg))
      ),
      ')',
    ];

  const lastIndex = args.length - 1;
  const printed = args.map(
    (arg, index): Doc => (index === lastIndex ? nodeDoc(arg) : [nodeDoc(arg), ',', line])
  );
  const allBroken = (): Doc =>
    group(['(', indent([line, ...printed]), line, ')'], { shouldBreak: true });

  if (isFunctionComposition(args)) return allBroken();

  if (shouldGroupFirst(args)) {
    const rest = printed.slice(1);
    if (rest.some(willBreak)) return allBroken();
    const first = nodeDoc(args[0] as JsNode, { expandLastArg: true });
    const hugged: Doc = ['(', group(first, { shouldBreak: true }), ', ', ...rest, ')'];
    return willBreak(first)
      ? [breakParent, conditionalGroup([hugged, allBroken()])]
      : conditionalGroup([['(', first, ', ', ...rest, ')'], hugged, allBroken()]);
  }

  if (shouldGroupLast(args)) {
    const head = printed.slice(0, -1);
    if (head.some(willBreak)) return allBroken();
    const last = nodeDoc(args[lastIndex] as JsNode, { expandLastArg: true });
    const hugged: Doc = ['(', ...head, group(last, { shouldBreak: true }), ')'];
    return willBreak(last)
      ? [breakParent, conditionalGroup([hugged, allBroken()])]
      : conditionalGroup([['(', ...head, last, ')'], hugged, allBroken()]);
  }

  return group(['(', indent([softline, ...printed]), softline, ')'], {
    shouldBreak: printed.some(willBreak),
  });
}

function nodeDoc(node: JsNode, ctx: NodeContext = {}): Doc {
  switch (node.kind) {
    case 'atom':
      return node.text.includes('\n') ? join(hardline, node.text.split('\n')) : node.text;
    case 'string':
      return ctx.json === true ? node.raw : enquote(node.raw);
    case 'literal':
      return node.text;
    case 'array':
      return arrayDoc(node, ctx);
    case 'object':
      return objectDoc(node, ctx);
    case 'call':
      return [node.callee, argumentsDoc(node.args)];
    case 'arrow':
      return arrowDoc(node, ctx);
  }
}

// ── Печать ──────────────────────────────────────────────────────────────────

/** Вызов с готовыми узлами аргументов: `callee(a, b);`. */
export function printCall(
  callee: string,
  args: readonly JsNode[],
  options: PrintOptions = {}
): string {
  return printDoc([callee, argumentsDoc(args), ';'], options);
}

/**
 * Вызов метода с единственным аргументом-объектом в конце цепочки:
 * `schema.node('x').patchProps({ … });`.
 *
 * Цепочку из двух вызовов prettier, не поместив в строку, рвёт ПО ТОЧКАМ, а не по объекту. Чтобы
 * вышло читаемо, объект разворачивается заранее: развёрнутый он цепочку не ломает.
 */
export function printChainCall(
  callee: string,
  argument: Extract<JsNode, { kind: 'object' }>,
  options: PrintOptions = {}
): string {
  const flat = printDoc([callee, '(', objectDoc(argument, {}), ');'], {
    ...options,
    width: Infinity,
  });
  const width = (options.width ?? 100) - (options.indent ?? 0);
  if (!flat.includes('\n') && widthOf(flat) <= width) return flat;
  return printDoc([callee, '(', objectDoc({ ...argument, expanded: true }, {}), ');'], options);
}

export interface LiteralOptions extends PrintOptions {
  /** Текст перед значением на той же строке: `export const X: T[] = `, `return `. */
  readonly prefix?: string;
  /** Текст сразу после значения: `;`, ` as Form;`. */
  readonly suffix?: string;
}

/**
 * Значение литералом JS вместе с тем, что стоит вокруг него на строке.
 *
 * Окружение передаётся сюда, а не дописывается снаружи: поместится ли массив в строку, зависит
 * от того, что стоит перед ним и после.
 */
export function printLiteral(value: unknown, options: LiteralOptions = {}): string {
  const node = valueNode(value);
  return printDoc([options.prefix ?? '', nodeDoc(node), options.suffix ?? ''], options);
}

/**
 * Объявление константы со значением: `export const NAME = 'текст';`.
 *
 * Отдельно от {@link printLiteral}: длинная строка после `=` переносится на следующую строку
 * целиком, а это свойство присваивания, а не литерала.
 */
export function printConst(left: string, value: unknown, options: PrintOptions = {}): string {
  const node = valueNode(value);
  return printDoc([assignmentDoc(left, ' =', node, nodeDoc(node)), ';'], options);
}

/** Вид строки импорта: импорт либо реэкспорт, значений либо типов. */
export type ImportKind = 'import' | 'import type' | 'export' | 'export type';

/** Строка `import { a, b } from 'x';` → имена и источник; `null` — строка другого вида. */
export function parseImport(
  text: string
): { readonly kind: ImportKind; readonly names: string[]; readonly from: string } | null {
  const match =
    /^(import type|import|export type|export)\s*\{([^}]*)\}\s*from\s*(['"])(.*)\3;?$/.exec(
      text.trim()
    );
  if (match === null) return null;
  const names = (match[2] as string)
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  return { kind: match[1] as ImportKind, names, from: match[4] as string };
}

/** `import { a, type B } from 'x';` — список в строку либо по имени на строку. */
export function printImport(
  names: readonly string[],
  from: string,
  options: PrintOptions & { readonly kind?: ImportKind } = {}
): string {
  const head = `${options.kind ?? 'import'} `;
  const tail = ` from ${quote(from)};`;
  // Единственное имя не переносится: рвать там нечего.
  if (names.length <= 1) return `${head}{ ${names.join('')} }${tail}`;
  return printDoc(
    [
      head,
      group(['{', indent([line, join([',', line], [...names])]), ifBreak(','), line, '}']),
      tail,
    ],
    options
  );
}

/** Параметр-деструктуризация: `{ a, b }: Type` либо `{ a }: Type = {}`. */
function objectPattern(param: string): { readonly names: string[]; readonly rest: string } | null {
  if (!param.startsWith('{')) return null;
  const close = matchingClose(param, 0);
  if (close < 0) return null;
  const names = splitTop(param.slice(1, close), ',');
  if (names === null || names.length === 0 || names.some((name) => name === '')) return null;
  return { names, rest: param.slice(close + 1) };
}

/**
 * Заголовок функции: `head(params)tail`.
 *
 * Не помещается — параметры уходят по одному на строку. Единственный параметр-деструктуризация
 * «обнимается»: рвётся сам образец, а скобки остаются на строках заголовка.
 *
 * @param head - Всё до открывающей скобки: `export function createForm`.
 * @param tail - Всё после закрывающей: `: FormBundle<Form> {`.
 */
export function printSignature(
  head: string,
  params: readonly string[],
  tail: string,
  options: PrintOptions = {}
): string {
  if (params.length === 0) return `${head}()${tail}`;
  const pattern = params.length === 1 ? objectPattern(params[0] as string) : null;
  if (pattern !== null) {
    return printDoc(
      group([
        head,
        '({',
        indent([line, join([',', line], pattern.names)]),
        ifBreak(','),
        line,
        '}',
        pattern.rest,
        ')',
        tail,
      ]),
      options
    );
  }
  return printDoc(
    group([head, '(', indent([softline, join([',', line], [...params])]), softline, ')', tail]),
    options
  );
}

/**
 * Уложить оператор заново — вызов, объявление `const`, `return`.
 *
 * Текст, который не разобрался, возвращается без изменений: лучше длинная строка, чем
 * переписанный код человека.
 */
export function formatStatement(code: string, options: PrintOptions = {}): string {
  const parsed = parseStatement(code);
  if (parsed === null) return code;
  return printDoc(statementDoc(parsed), options);
}

/** Уложить строки тела (операторы один за другим) — каждую своим оператором. */
export function formatBody(lines: readonly string[], options: PrintOptions = {}): string[] {
  if (lines.length === 0) return [];
  const block = parseBlock(lines.join('\n'));
  const out: string[] = [];
  block.statements.forEach((statement) => {
    if (statement.blankBefore) out.push('');
    if (statement.parsed !== undefined) {
      out.push(...printDoc(statementDoc(statement.parsed), options).split('\n'));
    } else {
      out.push(...(statement.raw ?? []));
    }
  });
  return out;
}

// ── JSON ────────────────────────────────────────────────────────────────────

function jsonNode(value: unknown): JsNode {
  if (value === null || value === undefined) return atom('null');
  if (typeof value === 'string') return { kind: 'string', raw: JSON.stringify(value) };
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { kind: 'literal', text: String(value).replace('e+', 'e'), numeric: true }
      : atom('null');
  }
  if (typeof value === 'boolean') return { kind: 'literal', text: String(value), numeric: false };
  if (Array.isArray(value)) return { kind: 'array', elements: value.map(jsonNode) };
  if (typeof value === 'object') {
    const json = (value as { toJSON?: unknown }).toJSON;
    if (typeof json === 'function') return jsonNode((json as () => unknown).call(value));
    const props = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && typeof item !== 'function')
      .map(([key, item]): JsProperty => ({ key: JSON.stringify(key), value: jsonNode(item) }));
    return { kind: 'object', props, expanded: props.length > 0 };
  }
  return atom('null');
}

/**
 * Документ JSON в раскладке prettier: объекты развёрнуты, массив без объектов — в строку, если
 * помещается. Завершается переводом строки.
 *
 * От `JSON.stringify(value, null, 2)` отличается ровно массивами: тот кладёт по элементу на
 * строку всегда, и `"children": ["Отправить"]` после него приходилось переформатировать.
 */
export function printJson(value: unknown, options: PrintOptions = {}): string {
  return `${printDoc(nodeDoc(jsonNode(value), { json: true }), options)}\n`;
}
