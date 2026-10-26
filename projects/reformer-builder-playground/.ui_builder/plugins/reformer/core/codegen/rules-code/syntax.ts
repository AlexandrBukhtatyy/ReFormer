/**
 * Разбор кусков TypeScript, из которых состоят файлы правил модуля, — по тексту, без AST.
 *
 * Файлы правил печатает генерация (`../view`, `../templates`, билдеры `@reformer/mcp`), и читатель
 * узнаёт ровно эти формы: вызов, стрелку, тернарный оператор, литерал. Всё держится на сканере
 * `../print/scan`: знаки внутри строк, комментариев и регулярных выражений не считаются, поэтому
 * запятая в `'a,b'` не режет аргументы, а `;` в комментарии не кончает оператор.
 *
 * Текст выражений возвращается как есть — условие правила и тело обработчика пишет человек, и
 * пересказывать их значило бы угадывать.
 *
 * @module plugins/reformer/core/codegen/rules-code/syntax
 */

import {
  CLOSE,
  isArrowHead,
  matchingClose,
  scan,
  splitTop,
  topIndexOf,
  trailingCallOpen,
  wholeString,
} from '../print/scan';

/** Оператор блока: его текст без завершающей `;`, комментарии над ним и строка в файле. */
export interface Statement {
  readonly text: string;
  /** Комментарии перед оператором — тексты без `//` и `/* *\/`. */
  readonly comments: readonly string[];
  /** Номер строки начала оператора в файле, с единицы. */
  readonly line: number;
  /** Начало текста оператора в теле — после комментариев. */
  readonly start: number;
  /** Конец оператора в теле — индекс его `;` либо конец куска. */
  readonly end: number;
}

/**
 * Текст с комментариями, забитыми пробелами, — той же длины и с теми же переводами строк.
 *
 * По нему ищутся объявления: заготовка поведения несёт закомментированный пример с той же
 * `export function behaviorRules(`, и поиск по исходному тексту нашёл бы его. Строки остаются
 * как есть — `//` в `'http://…'` комментарием не считается.
 */
export function withoutComments(text: string): string {
  const out = text.split('');
  let i = 0;
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < text.length) {
    const char = text[i];
    if (char === "'" || char === '"' || char === '`') {
      i += 1;
      while (i < text.length && text[i] !== char) {
        if (text[i] === '\\') i += 1;
        else if (char !== '`' && text[i] === '\n') break;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (char === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/** Номер строки (с единицы) знака по индексу. */
export function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) if (text[i] === '\n') line += 1;
  return line;
}

/** Снять ведущие комментарии с куска: текст оператора и сами комментарии. */
function leadingComments(chunk: string): {
  readonly rest: string;
  readonly skipped: number;
  readonly comments: string[];
} {
  const comments: string[] = [];
  let at = 0;
  for (;;) {
    while (at < chunk.length && /\s/.test(chunk[at] as string)) at += 1;
    if (chunk.startsWith('//', at)) {
      const end = chunk.indexOf('\n', at);
      const stop = end < 0 ? chunk.length : end;
      comments.push(chunk.slice(at + 2, stop).trim());
      at = stop;
      continue;
    }
    if (chunk.startsWith('/*', at)) {
      const end = chunk.indexOf('*/', at + 2);
      const stop = end < 0 ? chunk.length : end + 2;
      comments.push(
        chunk
          .slice(at + 2, end < 0 ? chunk.length : end)
          .replace(/^\s*\*+/gm, '')
          .trim()
      );
      at = stop;
      continue;
    }
    break;
  }
  return { rest: chunk.slice(at), skipped: at, comments };
}

/**
 * Операторы тела блока: по `;` верхнего уровня.
 *
 * @param body - Текст между фигурными скобками блока.
 * @param offset - Индекс начала `body` в файле — для номеров строк.
 * @param file - Весь текст файла.
 * @returns Операторы либо `null`, если скобки тела не сходятся.
 */
export function statementsOf(body: string, offset: number, file: string): Statement[] | null {
  const cuts: number[] = [];
  const ok = scan(body, (char, index, depth) => {
    if (depth === 0 && char === ';') cuts.push(index);
  });
  if (!ok) return null;
  const statements: Statement[] = [];
  let from = 0;
  for (const cut of [...cuts, body.length]) {
    const chunk = body.slice(from, cut);
    const { rest, skipped, comments } = leadingComments(chunk);
    const text = rest.trim();
    if (text !== '') {
      const start = from + skipped + (rest.length - rest.trimStart().length);
      statements.push({
        text,
        comments,
        line: lineAt(file, offset + start),
        start,
        end: cut,
      });
    }
    from = cut + 1;
  }
  return statements;
}

/** Вызов: вызываемое и тексты аргументов. */
export interface Call {
  readonly callee: string;
  readonly args: readonly string[];
}

/** Разобрать вызов, которым кончается текст целиком; иначе `null`. */
export function callOf(text: string): Call | null {
  const t = text.trim();
  const open = trailingCallOpen(t);
  if (open <= 0 || matchingClose(t, open) !== t.length - 1) return null;
  const inner = t.slice(open + 1, -1);
  const args = inner.trim() === '' ? [] : splitTop(inner, ',');
  if (args === null || args.some((arg) => arg === '')) return null;
  return { callee: t.slice(0, open).trim(), args };
}

/** Стрелка: заголовок, асинхронность и тело — выражением либо блоком. */
export interface Arrow {
  /** Список параметров как есть, без `async`: `()`, `(value)`, `({ model: item })`. */
  readonly params: string;
  readonly async: boolean;
  /** Тело: выражение либо текст между фигурными скобками блока. */
  readonly body: string;
  readonly block: boolean;
}

/** Разобрать стрелку; иначе `null`. */
export function arrowOf(text: string): Arrow | null {
  const t = text.trim();
  const at = topIndexOf(t, '=>');
  if (at <= 0) return null;
  const head = t.slice(0, at).trim();
  if (!isArrowHead(head)) return null;
  const rest = t.slice(at + 2).trim();
  const block = rest.startsWith('{') && matchingClose(rest, 0) === rest.length - 1;
  return {
    params: head.replace(/^async\s+/, ''),
    async: /^async\s/.test(head),
    body: block ? rest.slice(1, -1) : rest,
    block,
  };
}

/** Снять внешние скобки, охватывающие текст целиком: `((a))` → `a`. */
export function stripParens(text: string): string {
  let t = text.trim();
  while (t.startsWith('(') && matchingClose(t, 0) === t.length - 1) t = t.slice(1, -1).trim();
  return t;
}

/** Тернарный оператор верхнего уровня: условие и ветви. */
export interface Conditional {
  readonly test: string;
  readonly then: string;
  readonly otherwise: string;
}

/**
 * Разобрать `test ? then : otherwise`, где `then` — простой атом (`null`), а `otherwise` — всё
 * остальное. Знак вопроса цепочки (`?.`) и слияния (`??`) вопросом не считаются.
 */
export function conditionalOf(text: string): Conditional | null {
  const t = text.trim();
  const questions: number[] = [];
  scan(t, (char, index, depth) => {
    if (depth !== 0 || char !== '?') return;
    const next = t[index + 1];
    const prev = t[index - 1];
    if (next !== '.' && next !== '?' && prev !== '?') questions.push(index);
  });
  for (const question of questions) {
    const rest = t.slice(question + 1);
    const colon = topIndexOf(rest, ':');
    if (colon < 0) continue;
    const then = rest.slice(0, colon).trim();
    if (!/^[\w$.]+$/.test(then)) continue;
    return {
      test: t.slice(0, question).trim(),
      then,
      otherwise: rest.slice(colon + 1).trim(),
    };
  }
  return null;
}

/** Элементы литерала массива, охватывающего текст целиком; иначе `null`. */
export function arrayItems(text: string): string[] | null {
  const t = text.trim();
  if (!t.startsWith('[') || matchingClose(t, 0) !== t.length - 1) return null;
  const inner = t.slice(1, -1);
  if (inner.trim() === '') return [];
  const items = splitTop(inner, ',');
  return items === null || items.some((item) => item === '') ? null : items;
}

/** Свойство объектного литерала: ключ без кавычек и текст значения (`null` — сокращённая запись). */
export interface Property {
  readonly key: string;
  readonly value: string | null;
}

/** Свойства литерала объекта, охватывающего текст целиком; иначе `null` (распространение — тоже). */
export function objectProperties(text: string): Property[] | null {
  const t = text.trim();
  if (!t.startsWith('{') || matchingClose(t, 0) !== t.length - 1) return null;
  const inner = t.slice(1, -1);
  if (inner.trim() === '') return [];
  const parts = splitTop(inner, ',');
  if (parts === null) return null;
  const props: Property[] = [];
  for (const part of parts) {
    if (part === '' || part.startsWith('...')) return null;
    const colon = topIndexOf(part, ':');
    if (colon < 0) {
      if (!/^[A-Za-z_$][\w$]*$/.test(part)) return null;
      props.push({ key: part, value: null });
      continue;
    }
    const rawKey = part.slice(0, colon).trim();
    const quoted = wholeString(rawKey);
    const key = quoted !== null ? unescapeString(quoted) : rawKey;
    if (quoted === null && !/^[A-Za-z_$][\w$]*$|^\d+$/.test(rawKey)) return null;
    props.push({ key, value: part.slice(colon + 1).trim() });
  }
  return props;
}

/** Содержимое строкового литерала (без кавычек) → значение. */
export function unescapeString(raw: string): string {
  return raw.replace(
    /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r\n|[\s\S])/g,
    (_m, esc: string) => {
      switch (esc[0]) {
        case 'n':
          return '\n';
        case 'r':
          return esc === '\r\n' ? '' : '\r';
        case 't':
          return '\t';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case 'v':
          return '\v';
        case '0':
          return '\0';
        case '\n':
          return '';
        case 'u':
          return String.fromCodePoint(parseInt(esc.replace(/[u{}]/g, ''), 16));
        case 'x':
          return String.fromCharCode(parseInt(esc.slice(1), 16));
        default:
          return esc;
      }
    }
  );
}

/** Строковый литерал в кавычках, охватывающий текст целиком → значение; иначе `null`. */
export function stringOf(text: string): string | null {
  const raw = wholeString(text.trim());
  return raw === null ? null : unescapeString(raw);
}

/** Итог чтения литерала: значение либо «это не литерал». */
export type LiteralResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

const NOT_LITERAL: LiteralResult = { ok: false };

/**
 * Литерал значения — то, что переживает JSON: строка, число, булево, `null`, массив и объект из
 * них. Выражение, сокращённая запись свойства, распространение — не литерал.
 */
export function literalOf(text: string): LiteralResult {
  const t = stripParens(text);
  const str = stringOf(t);
  if (str !== null) return { ok: true, value: str };
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(t)) return { ok: true, value: Number(t) };
  if (t === 'true' || t === 'false') return { ok: true, value: t === 'true' };
  if (t === 'null') return { ok: true, value: null };
  const items = arrayItems(t);
  if (items !== null) {
    const values: unknown[] = [];
    for (const item of items) {
      const read = literalOf(item);
      if (!read.ok) return NOT_LITERAL;
      values.push(read.value);
    }
    return { ok: true, value: values };
  }
  const props = objectProperties(t);
  if (props !== null) {
    const value: Record<string, unknown> = {};
    for (const prop of props) {
      if (prop.value === null) return NOT_LITERAL;
      const read = literalOf(prop.value);
      if (!read.ok) return NOT_LITERAL;
      value[prop.key] = read.value;
    }
    return { ok: true, value };
  }
  return NOT_LITERAL;
}

/**
 * Снять общий отступ строк тела: тело обработчика напечатано с отступом своего блока, а в правиле
 * оно хранится от нулевой колонки. Пустые строки по краям отбрасываются.
 */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && (lines[0] as string).trim() === '') lines.shift();
  while (lines.length > 0 && (lines[lines.length - 1] as string).trim() === '') lines.pop();
  let pad = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    pad = Math.min(pad, line.length - line.trimStart().length);
  }
  const cut = Number.isFinite(pad) ? pad : 0;
  return lines.map((line) => line.slice(Math.min(cut, line.length)).trimEnd()).join('\n');
}

/**
 * Индекс скобки, закрывающей ту, что стоит по индексу `open`, — со сканом от неё, а не от начала
 * файла: несошедшаяся скобка в чужом коде выше не должна ломать чтение объявления ниже.
 */
export function closeOf(text: string, open: number): number {
  const rest = text.slice(open);
  let found = -1;
  // Парная скобка — первая закрывающая на глубине открывающей; дальше файл не важен.
  scan(rest, (char, index, depth) => {
    if (found < 0 && index > 0 && depth === 0 && CLOSE.includes(char)) found = index;
  });
  return found < 0 ? -1 : open + found;
}
