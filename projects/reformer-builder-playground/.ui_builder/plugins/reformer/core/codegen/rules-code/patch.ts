/**
 * Точечная правка авторских файлов модуля: словаря текстов и констант источников данных.
 *
 * `validation/messages.ts` и `constants/<каталог>.ts` генерация пишет один раз и дальше не
 * трогает — это файлы человека. Но правила живут в коде, и новый текст замечания или новое
 * значение источника, заданные ассистентом, обязаны в них попасть. Поэтому файл не
 * перепечатывается, а правится ровно в одном месте: запись словаря, объявление константы,
 * строка импорта. Остальной текст — комментарии, порядок, свои записи человека — остаётся байт
 * в байт.
 *
 * Файл незнакомого вида (словаря нет, литерал не разбирается) не правится вовсе: правка вслепую
 * испортила бы работу человека. Отказ возвращается причиной — её показывают человеку.
 *
 * @module plugins/reformer/core/codegen/rules-code/patch
 */

import { printLiteral, propertyKey, quote } from '../print/js';
import { scan, splitTop, topIndexOf, wholeString } from '../print/scan';
import { messagesLiteral } from './data';
import { statementsOf, unescapeString, withoutComments } from './syntax';

/** Объявление словаря целиком — от `export` до вызова. */
const MESSAGES_STATEMENT =
  /export\s+const\s+formMessages\s*(?::[^=]+)?=\s*defineIssueMessages\s*\(/;

/** Итог правки: новый текст либо причина, по которой файл не тронут. */
export type PatchResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: string };

/** Есть ли в тексте комментарий вне строк. */
function hasComment(text: string): boolean {
  let found = false;
  scan(
    text,
    () => undefined,
    () => {
      found = true;
    }
  );
  return found;
}

/** Свойство литерала с местом в тексте литерала. */
interface PropertySpan {
  readonly key: string;
  readonly start: number;
  readonly end: number;
}

/** Свойства литерала объекта (`{ … }`) с позициями внутри него; `null` — не разбирается. */
function propertySpans(literal: string): PropertySpan[] | null {
  const cuts: number[] = [];
  const ok = scan(literal, (char, index, depth) => {
    if (depth === 1 && char === ',') cuts.push(index);
  });
  if (!ok) return null;
  const spans: PropertySpan[] = [];
  let from = 1;
  for (const cut of [...cuts, literal.length - 1]) {
    const raw = literal.slice(from, cut);
    const text = raw.trim();
    if (text !== '') {
      const colon = topIndexOf(text, ':');
      if (colon < 0) return null;
      const rawKey = text.slice(0, colon).trim();
      const quoted = wholeString(rawKey);
      const start = from + (raw.length - raw.trimStart().length);
      spans.push({
        key: quoted === null ? rawKey : unescapeString(quoted),
        start,
        end: start + text.length,
      });
    }
    from = cut + 1;
  }
  return spans;
}

/**
 * Поправить словарь текстов замечаний: записи `код → текст` (`null` — убрать запись).
 *
 * Словарь без комментариев внутри печатается заново целиком — так же, как его печатает генерация
 * (форма под prettier). С комментариями внутри правятся сами записи, а комментарии остаются.
 */
export function patchMessages(
  text: string,
  entries: Readonly<Record<string, string | null>>
): PatchResult {
  const at = messagesLiteral(text);
  if (at === null) return { ok: false, reason: 'в файле нет словаря formMessages' };
  const literal = text.slice(at.start, at.end);
  const spans = propertySpans(literal);
  if (spans === null) return { ok: false, reason: 'словарь formMessages не разбирается' };

  if (!hasComment(literal)) {
    const inner = splitTop(literal.slice(1, -1), ',') ?? [];
    const dictionary: Record<string, string> = {};
    for (const [index, span] of spans.entries()) {
      const value = (inner[index] ?? '').slice(topIndexOf(inner[index] ?? '', ':') + 1).trim();
      const raw = wholeString(value);
      // Своё выражение человека вместо строки печатью не пересказать — правим по месту.
      if (raw === null) return patchInPlace(text, at, literal, spans, entries);
      dictionary[span.key] = unescapeString(raw);
    }
    for (const [code, message] of Object.entries(entries)) {
      if (message === null) delete dictionary[code];
      else dictionary[code] = message;
    }
    const statement = MESSAGES_STATEMENT.exec(withoutComments(text));
    const head = statement?.index ?? -1;
    const close = text.indexOf(')', at.end);
    if (head < 0 || close < 0) return { ok: false, reason: 'словарь formMessages не разбирается' };
    const tail = text[close + 1] === ';' ? close + 2 : close + 1;
    const printed = printLiteral(dictionary, {
      prefix: 'export const formMessages = defineIssueMessages(',
      suffix: ');',
    });
    return { ok: true, text: `${text.slice(0, head)}${printed}${text.slice(tail)}` };
  }
  return patchInPlace(text, at, literal, spans, entries);
}

/** Правка записей словаря по месту — когда печатать его заново нельзя. */
function patchInPlace(
  text: string,
  at: { readonly start: number; readonly end: number },
  literal: string,
  spans: readonly PropertySpan[],
  entries: Readonly<Record<string, string | null>>
): PatchResult {
  let next = literal;
  const indent = /\n([ \t]*)\S/.exec(literal)?.[1] ?? '  ';
  // С конца, чтобы позиции ещё не тронутых записей оставались верными.
  for (const span of [...spans].reverse()) {
    if (!(span.key in entries)) continue;
    const message = entries[span.key];
    if (message === null || message === undefined) {
      const after = next.slice(span.end).match(/^\s*,/)?.[0].length ?? 0;
      const before = /\n?[ \t]*$/.exec(next.slice(0, span.start))?.[0].length ?? 0;
      next = next.slice(0, span.start - before) + next.slice(span.end + after);
    } else {
      next = `${next.slice(0, span.start)}${propertyKey(span.key)}: ${quote(message)}${next.slice(span.end)}`;
    }
  }
  const known = new Set(spans.map((span) => span.key));
  const added = Object.entries(entries).filter(
    (entry): entry is [string, string] => entry[1] !== null && !known.has(entry[0])
  );
  if (added.length > 0) {
    const body = next.slice(0, -1).replace(/\s*$/, '');
    const comma = body.endsWith('{') || body.endsWith(',') ? '' : ',';
    const lines = added.map(
      ([code, message]) => `${indent}${propertyKey(code)}: ${quote(message)},`
    );
    next = `${body}${comma}\n${lines.join('\n')}\n}`;
  }
  return { ok: true, text: `${text.slice(0, at.start)}${next}${text.slice(at.end)}` };
}

/** Объявление константы: `export const NAME …`. */
const CONSTANT_HEAD = /^export\s+const\s+([A-Za-z_$][\w$]*)\b/;

/** Импорт: `import [type] { a, b } from 'mod'`. */
const IMPORT = /^import\s+(type\s+)?\{([^}]*)\}\s+from\s+(['"])([^'"]+)\3$/;

/**
 * Поправить файл констант источников данных.
 *
 * @param declarations - Имя константы → полный текст её объявления с `;` (как его печатает
 *   генерация); `null` — оставить как есть. Есть объявление — заменяется, нет — дописывается в
 *   конец (заглушка `export {};` пустого файла уступает ему место).
 * @param imports - Строки импорта, которые нужны новым объявлениям: недостающее имя дописывается
 *   в импорт того же модуля, недостающий модуль — новой строкой после последнего импорта.
 */
export function patchConstants(
  text: string,
  declarations: Readonly<Record<string, string | null>>,
  imports: readonly string[] = []
): PatchResult {
  const statements = statementsOf(text, 0, text);
  if (statements === null) return { ok: false, reason: 'файл констант не разбирается' };
  let next = text;
  const edits: { start: number; end: number; text: string }[] = [];
  const written = new Set<string>();
  for (const statement of statements) {
    const name = CONSTANT_HEAD.exec(statement.text)?.[1];
    const declaration = name === undefined ? undefined : declarations[name];
    if (name === undefined || declaration === undefined || declaration === null) continue;
    written.add(name);
    edits.push({ start: statement.start, end: statement.end + 1, text: declaration });
  }
  const appended = Object.entries(declarations)
    .filter((entry): entry is [string, string] => entry[1] !== null && !written.has(entry[0]))
    .map(([, declaration]) => declaration);
  const stub = statements.find((statement) => statement.text === 'export {}');
  if (appended.length > 0 && stub !== undefined) {
    edits.push({ start: stub.start, end: stub.end + 1, text: appended.join('\n\n') });
    appended.length = 0;
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
  }
  if (appended.length > 0) next = `${next.replace(/\s*$/, '')}\n\n${appended.join('\n\n')}\n`;
  return { ok: true, text: withImports(next, imports) };
}

/** Дописать недостающие импорты: имя — в импорт того же модуля, модуль — новой строкой. */
function withImports(text: string, imports: readonly string[]): string {
  let next = text;
  for (const line of imports) {
    const wanted = IMPORT.exec(line.trim().replace(/;$/, ''));
    if (wanted === null) continue;
    const [, type = '', names, , module] = wanted;
    const statements = statementsOf(next, 0, next) ?? [];
    const existing = statements.find((statement) => {
      const match = IMPORT.exec(statement.text);
      return match !== null && match[4] === module && (match[1] ?? '') === type;
    });
    const needed = (names ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    if (existing !== undefined) {
      const have = (IMPORT.exec(existing.text)?.[2] ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      const missing = needed.filter((name) => !have.includes(name));
      if (missing.length === 0) continue;
      const merged = [...have, ...missing].sort().join(', ');
      const replaced = `import ${type}{ ${merged} } from '${module}'`;
      next = `${next.slice(0, existing.start)}${replaced}${next.slice(existing.end)}`;
      continue;
    }
    const lastImport = [...statements]
      .reverse()
      .find((statement) => statement.text.startsWith('import '));
    const statement = `import ${type}{ ${needed.join(', ')} } from '${module}';`;
    if (lastImport !== undefined) {
      next = `${next.slice(0, lastImport.end + 1)}\n${statement}${next.slice(lastImport.end + 1)}`;
    } else {
      const first = statements[0];
      const at = first === undefined ? next.length : first.start;
      next = `${next.slice(0, at)}${statement}\n\n${next.slice(at)}`;
    }
  }
  return next;
}
