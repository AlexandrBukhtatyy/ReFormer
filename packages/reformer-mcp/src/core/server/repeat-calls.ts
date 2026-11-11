/**
 * Повтор вызова без перемен: тот же инструмент, те же аргументы и тот же ответ, что раньше.
 *
 * Малая модель, получив ошибку, правит файл и снова шлёт в `validate_form` прежний документ:
 * проверка видит только свои аргументы, правка файла до неё не доходит. Прогон qwen3.5:4b (батч
 * 20261111T195230Z-300a) сделал так пять раз и пять раз получил тот же ответ — и ни разу не узнал,
 * что ничего не меняется (ReFormer-11oe.21). Пометка в конце ответа называет повтор, номер прежнего
 * вызова и что сделать иначе.
 *
 * Сравнивается и ответ, а не только аргументы: `form_build {"dir":"form"}` с теми же аргументами
 * после правки `form.intent.json` отвечает иначе — это не повтор.
 *
 * Состояние — на сервер (сеанс клиента), в пределах {@link REMEMBERED_CALLS} последних вызовов.
 * Ядро работает и в браузерном воркере, поэтому отпечаток — FNV-1a, а не `node:crypto`.
 *
 * @module reformer-mcp/core/server/repeat-calls
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Сколько последних вызовов помнит сервер. */
export const REMEMBERED_CALLS = 200;

/** JSON с упорядоченными ключами: `{a,b}` и `{b,a}` — одни аргументы. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** FNV-1a, 32 бита: отпечаток, а не защита — совпадение ведёт лишь к лишней пометке. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`;
}

/** Что сделать иначе — по инструменту. */
const ADVICE: Readonly<Record<string, string>> = {
  validate_form:
    'validate_form checks only its arguments: an edit of a file does not reach it — pass the ' +
    'edited document, or change the approach.',
  form_build:
    'form_build reads form.intent.json from disk: the file is the same — change it before building ' +
    'again.',
};

function answerText(result: CallToolResult): string {
  return result.content.map((item) => (item.type === 'text' ? item.text : item.type)).join('\n');
}

/** Дописать пометку в конец последнего текстового блока ответа (или отдельным блоком). */
function withNote(result: CallToolResult, note: string): CallToolResult {
  const content = [...result.content];
  const last = content.length - 1;
  const tail = content[last];
  if (tail?.type === 'text') content[last] = { ...tail, text: `${tail.text}\n\n${note}` };
  else content.push({ type: 'text', text: note });
  return { ...result, content };
}

export interface RepeatWatch {
  /**
   * Отметить завершившийся вызов; повтор без перемен — ответ с пометкой, иначе — ответ как есть.
   *
   * @param call - Номер вызова инструмента в сеансе, с 1.
   */
  observe(
    call: number,
    name: string,
    args: Record<string, unknown> | undefined,
    result: CallToolResult
  ): CallToolResult;
}

export function createRepeatWatch(limit: number = REMEMBERED_CALLS): RepeatWatch {
  /** Аргументы вызова → первый номер, число одинаковых ответов и отпечаток ответа. */
  const seen = new Map<string, { call: number; times: number; answer: string }>();

  return {
    observe(call, name, args, result) {
      const key = `${name}\u0000${fingerprint(stableJson(args ?? {}))}`;
      const answer = fingerprint(answerText(result));
      const before = seen.get(key);
      seen.delete(key);
      if (!before || before.answer !== answer) {
        seen.set(key, { call, times: 1, answer });
        if (seen.size > limit) seen.delete(seen.keys().next().value as string);
        return result;
      }
      const times = before.times + 1;
      seen.set(key, { ...before, times });
      const advice = ADVICE[name] ? ` ${ADVICE[name]}` : '';
      return withNote(
        result,
        `> Repeated call: the same arguments and the same answer as call ${before.call}` +
          `${times > 2 ? ` (${times} times now)` : ''} — nothing changed between them.${advice}`
      );
    },
  };
}
