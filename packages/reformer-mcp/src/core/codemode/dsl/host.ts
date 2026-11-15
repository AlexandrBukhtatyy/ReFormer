/**
 * Хостовая сторона конструктора: вызов `form_edit` от `f.save()`.
 *
 * Правки из песочницы несут служебные ключи:
 * - `$via` — текст цепочки, которая записала правку (`f.add("phone", "Телефон").mask(…)`);
 * - `$error` — ошибка самого конструктора (неизвестный метод), правки нет;
 * - `{ $lambda, $scope }` — исходник лямбды в ключе выражения.
 *
 * Лямбды разбираются здесь (`lowerLambda`); правки с ошибками на сервер не идут. Остальные уходят
 * одним `form_edit`, и строки ответа `- ✓ op: …` / `- ✗ edit N op: …` подписываются цепочками: модель
 * видит, какую строку своего скрипта править. Не совпало число строк с числом правок — ответ остаётся
 * как есть: формат строк держит `guided.ts`, и сломать ответ хуже, чем не подписать его.
 *
 * @module reformer-mcp/core/codemode/dsl/host
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { lowerLambda, type LambdaScope, type TypeScriptModule } from './lambda.js';

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const SCOPES = new Set<LambdaScope>(['model', 'values', 'value', 'item']);

interface Prepared {
  /** Правка без служебных ключей; `undefined` — правка не ушла на сервер. */
  readonly edit?: Rec;
  readonly via?: string;
  readonly error?: string;
}

/** Правка из песочницы → правка `form_edit` или ошибка против её цепочки. */
function prepare(raw: unknown, ts: TypeScriptModule | null): Prepared {
  if (!isRecord(raw)) return { edit: raw as Rec };
  const via = typeof raw.$via === 'string' ? raw.$via : undefined;
  if (typeof raw.$error === 'string') return { via, error: raw.$error };
  const edit: Rec = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === '$via') continue;
    if (isRecord(value) && typeof value.$lambda === 'string') {
      const scope = SCOPES.has(value.$scope as LambdaScope)
        ? (value.$scope as LambdaScope)
        : 'model';
      const lowered = lowerLambda(ts, value.$lambda, scope);
      if ('error' in lowered) return { via, error: `${key}: ${lowered.error}` };
      // `.setOnChange(source, m => …, value)`: условие — тело реакции onChange.
      const assign = isRecord(value.$assign) ? value.$assign : undefined;
      edit[key] =
        assign && typeof assign.field === 'string'
          ? `if (${lowered.expr}) model.${assign.field} = ${JSON.stringify(assign.value)};`
          : lowered.expr;
      continue;
    }
    edit[key] = value;
  }
  return { edit, via };
}

/** Строка исхода одной правки в ответе `form_edit`. */
const OUTCOME = /^- (✓|✗ edit \d+) ([\w?]+): /;

/** Текст ответа: текстовые блоки через перевод строки. */
const textOf = (result: CallToolResult): string =>
  result.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');

/**
 * Вызвать `form_edit` правками конструктора.
 *
 * @param args - аргументы `formEdit` из песочницы (`{ dir, edits }`)
 * @param call - вызов инструмента каталога
 * @param ts - модуль TypeScript для лямбд (`null` — лямбды не принимаются)
 */
export async function dslFormEdit(
  args: Rec,
  call: (name: string, args: Rec) => Promise<CallToolResult>,
  ts: TypeScriptModule | null
): Promise<CallToolResult> {
  const edits = Array.isArray(args.edits) ? (args.edits as unknown[]) : null;
  if (edits === null) return await call('form_edit', args);
  const prepared = edits.map((raw) => prepare(raw, ts));
  const sent = prepared.filter((item) => item.error === undefined);
  const failed = prepared.length - sent.length;
  if (failed === 0 && sent.every((item) => item.via === undefined)) {
    return await call('form_edit', { ...args, edits: sent.map((item) => item.edit) });
  }
  if (sent.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: [
            `form_edit: 0 of ${prepared.length} edits applied.`,
            ...prepared.map((item) => `- ✗ ${item.via ?? 'edit'}: ${item.error ?? ''}`),
            'Nothing was sent: fix those calls and run the script again.',
          ].join('\n'),
        },
      ],
      isError: true,
    };
  }
  const result = await call('form_edit', { ...args, edits: sent.map((item) => item.edit) });
  const lines = textOf(result).split('\n');
  const outcomeLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => OUTCOME.test(line));
  if (outcomeLines.length !== sent.length) {
    // Формат ответа не тот: ошибки конструктора — перед ответом, строки сервера — как есть.
    const errors = prepared
      .filter((item) => item.error !== undefined)
      .map((item) => `- ✗ ${item.via ?? 'edit'}: ${item.error}`);
    return withText(result, [...errors, ...lines].join('\n'));
  }
  const relabeled = new Map<number, string>();
  outcomeLines.forEach(({ line, index }, k) => {
    const via = sent[k].via;
    if (via === undefined) return;
    relabeled.set(
      index,
      line.replace(
        OUTCOME,
        (_match, mark: string) => `- ${mark.startsWith('✓') ? '✓' : '✗'} ${via}: `
      )
    );
  });
  // Ошибки конструктора — на свои места среди строк исходов, по порядку правок.
  const out: string[] = [];
  let next = 0;
  let firstOutcome = outcomeLines[0]?.index ?? lines.length;
  for (let index = 0; index < lines.length; index++) {
    if (index === firstOutcome) {
      for (const item of prepared) {
        if (item.error !== undefined) {
          out.push(`- ✗ ${item.via ?? 'edit'}: ${item.error}`);
          continue;
        }
        const target = outcomeLines[next++];
        if (target) out.push(relabeled.get(target.index) ?? target.line);
      }
      firstOutcome = -1;
      continue;
    }
    if (outcomeLines.some((outcome) => outcome.index === index)) continue;
    out.push(index === 0 ? recount(lines[0], failed) : lines[index]);
  }
  return withText(result, out.join('\n'));
}

/** Заголовок `form_edit: A of B edits applied.` с правками, которые не ушли на сервер. */
function recount(header: string, failed: number): string {
  if (failed === 0) return header;
  return header.replace(
    /^form_edit: (\d+) of (\d+) edits applied\./,
    (_match, applied: string, total: string) =>
      `form_edit: ${applied} of ${Number(total) + failed} edits applied.`
  );
}

function withText(result: CallToolResult, text: string): CallToolResult {
  return { ...result, content: [{ type: 'text', text }] };
}

/**
 * Код инструмента — тело async-функции; async-стрелка или функция-выражение тоже принимаются, как
 * у Cloudflare: `async () => { … }` становится `return await (async () => { … })()`.
 */
export function asBody(code: string): string {
  const trimmed = code.trim();
  const isFunction =
    /^(async\s+)?function\b/.test(trimmed) ||
    /^(async\s+)?(\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(trimmed);
  return isFunction ? `return await (${trimmed.replace(/;\s*$/, '')})();` : code;
}
