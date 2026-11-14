/**
 * Инструмент `run_script` — единственный инструмент сервера в режиме Code Mode.
 *
 * Модель пишет тело async-функции; в песочнице ей доступны глобальные `reformer` (по функции на
 * каждый инструмент обычного режима, см. {@link apiDeclaration}) и `console`. Наружу уходит только
 * то, что скрипт напечатал, и возвращённое значение: промежуточные ответы инструментов остаются в
 * песочнице и в контекст модели не попадают.
 *
 * Ошибка инструмента (`isError`) внутри скрипта — исключение с полным текстом ответа: скрипт может
 * её перехватить, а неперехваченная доходит до модели вместе с напечатанным до неё.
 *
 * Сама песочница — порт {@link ScriptSandbox}: ядро не знает, чем исполняется код (под Node —
 * QuickJS-wasm, `platform/cli/quickjs-sandbox.ts`).
 *
 * @module reformer-mcp/core/codemode/run-script
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition } from '../server/tool-catalog.js';
import { apiDeclaration, functionName, type DeclarationOverrides } from './declaration.js';

export const RUN_SCRIPT_TOOL = 'run_script';

/** Функция API, которую песочница выставляет скрипту. */
export type ScriptFunction = (args: unknown) => Promise<string>;

/** Итог исполнения скрипта. */
export interface ScriptOutcome {
  /** Строки `console.*` в порядке вывода. */
  readonly logs: string[];
  /** Значение `return` скрипта, уже строкой; `undefined` — скрипт ничего не вернул. */
  readonly returned?: string;
  /** Неперехваченная ошибка скрипта (синтаксис, исключение, лимит времени или памяти). */
  readonly error?: string;
}

/** Песочница: исполнить тело async-функции с данными глобальными функциями `reformer.*`. */
export interface ScriptSandbox {
  run(code: string, functions: Readonly<Record<string, ScriptFunction>>): Promise<ScriptOutcome>;
}

/** Вызов инструмента изнутри скрипта — для трассы сервера (модель его не видит). */
export interface InnerCall {
  readonly name: string;
  readonly ok: boolean;
  readonly chars: number;
  readonly durationMs: number;
}

/** Ключ `_meta` ответа `run_script` со списком вложенных вызовов. */
export const INNER_CALLS_META = 'reformer/innerCalls';

const PREAMBLE =
  'Run a script against the ReFormer server API. Every server tool is an async function of the global `reformer` object (declared below; the argument is one object, the result is the tool answer as text). Write the BODY of an async function: use `await`, chain several calls in one script, keep only what you need and print it with `console.log` — only printed text and a `return`ed value come back to you. No imports, no require, no network, no file access: write files with your own file tools. A tool error throws an Error with the tool answer as its message.';

/**
 * Подача `run_script` для поверхности: вводный абзац, пример в описании `code` и объявление функций.
 * Не задано — подача обычного Code Mode: его замеры остаются сравнимыми.
 */
export interface ScriptSurface {
  readonly preamble?: string;
  /** Пример тела скрипта в описании параметра `code`. */
  readonly codeExample?: string;
  readonly declarations?: DeclarationOverrides;
}

const CODE_EXAMPLE = 'console.log(await reformer.formBuild({ grammar: "base" }))';

/** Определение `run_script` для `tools/list`: вводный абзац и объявление API. */
export function runScriptToolDefinition(
  tools: readonly ToolDefinition[],
  surface: ScriptSurface = {}
): ToolDefinition {
  return {
    name: RUN_SCRIPT_TOOL,
    description: `${surface.preamble ?? PREAMBLE}\n\n${apiDeclaration(tools, surface.declarations)}`,
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: surface.codeExample
            ? `JavaScript: the body of an async function, e.g. \`${surface.codeExample}\`.`
            : `JavaScript or TypeScript: the body of an async function, e.g. \`${CODE_EXAMPLE}\`.`,
        },
      },
      required: ['code'],
    },
  };
}

/** Текст ответа инструмента: текстовые блоки через перевод строки. */
function textOf(result: CallToolResult): string {
  return result.content
    .map((block) => (block.type === 'text' ? block.text : JSON.stringify(block)))
    .join('\n');
}

const NO_OUTPUT =
  '(the script printed nothing — print what you need with console.log, or return a value)';

export interface RunScriptOptions {
  /**
   * Скрипт ничего не напечатал — отдать ответ последнего вызова. Связка с guided: малая модель
   * часто вызывала `formStart` без `console.log` и тратила шаг, чтобы узнать план.
   */
  readonly echoLast?: boolean;
  /** Пустой второй `edits` в вызове `formEdit` выбросить — см. {@link dropEmptyEdits}. */
  readonly dropEmptyEdits?: boolean;
}

/**
 * Вызов `formEdit({ …, "edits":[…], "edits":[] })`: в JS побеждает последний ключ, и правки тихо
 * терялись — модель приписывала пустой список из строки «собрать», трижды слала одно правило и не
 * видела его (L3-refund, 20261113T210742Z-5a45). Пустой `edits` при другом `edits` в том же вызове
 * выбрасывается до запуска.
 */
export function dropEmptyEdits(code: string): { code: string; dropped: number } {
  let dropped = 0;
  const key = String.raw`["']?edits["']?\s*:`;
  const parts = code.split(/(?=\bformEdit\s*\()/);
  const out = parts.map((part) => {
    if (!/^formEdit\s*\(/.test(part)) return part;
    if ((part.match(new RegExp(key, 'g')) ?? []).length < 2) return part;
    return part.replace(new RegExp(String.raw`,\s*${key}\s*\[\s*\]`, 'g'), () => {
      dropped++;
      return '';
    });
  });
  return { code: out.join(''), dropped };
}

/**
 * Исполнить `run_script`.
 *
 * @param args - аргументы вызова (`{ code }`)
 * @param tools - инструменты, доступные скрипту (их же объявляет описание)
 * @param callTool - вызов инструмента обычного каталога
 * @param sandbox - песочница
 */
export async function runScriptTool(
  args: Record<string, unknown> | undefined,
  tools: readonly ToolDefinition[],
  callTool: (name: string, args: Record<string, unknown>) => Promise<CallToolResult>,
  sandbox: ScriptSandbox,
  options: RunScriptOptions = {}
): Promise<CallToolResult> {
  const code = args?.code;
  if (typeof code !== 'string' || code.trim() === '') {
    return {
      content: [{ type: 'text', text: 'run_script: pass the script text in "code".' }],
      isError: true,
    };
  }

  const inner: InnerCall[] = [];
  let last: { fn: string; text: string } | undefined;
  const functions: Record<string, ScriptFunction> = {};
  for (const tool of tools) {
    const fn = functionName(tool.name);
    functions[fn] = async (value) => {
      if (
        value !== undefined &&
        (value === null || typeof value !== 'object' || Array.isArray(value))
      ) {
        throw new TypeError(
          `reformer.${fn} takes one object argument, e.g. reformer.${fn}({ ... }), not ${JSON.stringify(value)}`
        );
      }
      const started = Date.now();
      const result = await callTool(tool.name, (value ?? {}) as Record<string, unknown>);
      const text = textOf(result);
      last = { fn, text };
      inner.push({
        name: tool.name,
        ok: result.isError !== true,
        chars: text.length,
        durationMs: Date.now() - started,
      });
      if (result.isError === true) throw new Error(text);
      return text;
    };
  }

  const fixed = options.dropEmptyEdits ? dropEmptyEdits(code) : { code, dropped: 0 };
  const outcome = await sandbox.run(fixed.code, functions);
  const parts = [
    ...(fixed.dropped > 0
      ? [
          `(a second, empty "edits":[] dropped — in JS it replaced the edits of the same call; one "edits" per call)`,
        ]
      : []),
    ...outcome.logs,
  ];
  if (outcome.returned !== undefined) parts.push(outcome.returned);
  if (outcome.error !== undefined) parts.push(`✗ script error: ${outcome.error}`);
  const text =
    parts.length > 0
      ? parts.join('\n')
      : options.echoLast && last
        ? `(the script printed nothing — reformer.${last.fn} answered:)\n${last.text}`
        : NO_OUTPUT;
  return {
    content: [{ type: 'text', text }],
    ...(outcome.error !== undefined ? { isError: true } : {}),
    _meta: { [INNER_CALLS_META]: inner },
  };
}
