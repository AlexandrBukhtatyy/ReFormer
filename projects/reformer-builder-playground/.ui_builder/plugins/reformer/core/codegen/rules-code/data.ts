/**
 * Тексты замечаний и значения источников данных — из авторских файлов модуля.
 *
 * - `validation/messages.ts`: словарь `export const formMessages = defineIssueMessages({ … })` —
 *   код замечания → текст. Им правило получает свой текст (`message`).
 * - `constants/<каталог>.ts`: объявления `export const NAME[: T] = <литерал>` — значения
 *   `$dataSource(NAME)`. Подписи элементов массива — функции, а не значения: их читатель
 *   пропускает.
 *
 * Оба файла пишутся генерацией один раз и дальше принадлежат человеку, поэтому читаются всегда,
 * правлены они или нет.
 *
 * @module plugins/reformer/core/codegen/rules-code/data
 */

import {
  closeOf,
  literalOf,
  objectProperties,
  statementsOf,
  stringOf,
  withoutComments,
} from './syntax';

/** Начало словаря: индекс скобки вызова `defineIssueMessages(`. */
const MESSAGES = /export\s+const\s+formMessages\s*(?::[^=]+)?=\s*defineIssueMessages\s*\(/;

/** Литерал объекта словаря и его место в тексте; `null` — словаря нет. */
export function messagesLiteral(text: string): { start: number; end: number } | null {
  const match = MESSAGES.exec(withoutComments(text));
  if (match === null) return null;
  const open = (match.index ?? 0) + match[0].length - 1;
  const close = closeOf(text, open);
  if (close < 0) return null;
  const inner = text.slice(open + 1, close);
  const lead = inner.length - inner.trimStart().length;
  const literal = inner.trim();
  if (!literal.startsWith('{')) return null;
  const start = open + 1 + lead;
  return { start, end: start + literal.length };
}

/** Словарь текстов замечаний: код → текст. Нестроковые значения пропускаются. */
export function readMessages(text: string): Record<string, string> {
  const at = messagesLiteral(text);
  if (at === null) return {};
  const props = objectProperties(text.slice(at.start, at.end));
  if (props === null) return {};
  const messages: Record<string, string> = {};
  for (const prop of props) {
    const value = prop.value === null ? null : stringOf(prop.value);
    if (value !== null) messages[prop.key] = value;
  }
  return messages;
}

/** Голова объявления константы: имя и необязательный тип. */
const CONSTANT = /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*([\s\S]+)$/;

/** Значения источников данных: имя константы → значение литерала. */
export function readConstants(text: string): Record<string, unknown> {
  const statements = statementsOf(text, 0, text);
  if (statements === null) return {};
  const values: Record<string, unknown> = {};
  for (const statement of statements) {
    const match = CONSTANT.exec(statement.text);
    if (match === null) continue;
    const read = literalOf(match[2] as string);
    if (read.ok) values[match[1] as string] = read.value;
  }
  return values;
}
