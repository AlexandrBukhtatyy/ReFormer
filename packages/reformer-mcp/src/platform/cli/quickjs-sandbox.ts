/**
 * Песочница Code Mode под Node — QuickJS, собранный в wasm.
 *
 * Внутри нет `require`, `process`, `fetch`, файлов и таймеров: только глобальные `console` и
 * `reformer`, которые ставит хост. Каждый скрипт — новый рантайм с лимитами памяти и времени;
 * после исполнения он уничтожается.
 *
 * TypeScript принимается: типы снимаются `typescript.transpileModule` (пакет уже нужен серверу для
 * проверки типов формы). Нет пакета — код исполняется как JavaScript.
 *
 * @module reformer-mcp/platform/cli/quickjs-sandbox
 */

import { createRequire } from 'node:module';
import type * as Ts from 'typescript';
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSDeferredPromise,
  type QuickJSHandle,
  type QuickJSSyncVariant,
  type QuickJSWASMModule,
} from 'quickjs-emscripten-core';
import variantModule from '@jitl/quickjs-wasmfile-release-sync';

// Пакет варианта описан одним d.ts на обе сборки, и под NodeNext TS видит его как CJS-модуль
// (`{ default }`), хотя под Node ESM грузится `index.mjs` с вариантом в экспорте по умолчанию.
const variant = variantModule as unknown as QuickJSSyncVariant;
import type {
  ScriptFunction,
  ScriptOutcome,
  ScriptSandbox,
} from '../../core/codemode/run-script.js';

export interface QuickJsSandboxOptions {
  /** Предел времени скрипта вместе с вызовами инструментов, мс. */
  readonly timeoutMs?: number;
  /**
   * Предел непрерывного исполнения JS между вызовами инструментов, мс. Отдельно от
   * {@link timeoutMs}: сборка формы с проверкой типов идёт секундами, а цикл без выхода не должен
   * держать сервер столько же.
   */
  readonly cpuSliceMs?: number;
  /** Предел памяти рантайма, байты. */
  readonly memoryBytes?: number;
  /** Предел суммарного вывода `console`, символы. */
  readonly maxOutputChars?: number;
}

const ENTRY = '__reformer_main__';

let quickjs: Promise<QuickJSWASMModule> | undefined;
const loadQuickJs = (): Promise<QuickJSWASMModule> =>
  (quickjs ??= newQuickJSWASMModuleFromVariant(variant));

let typescript: typeof Ts | null | undefined;
function loadTypescript(): typeof Ts | null {
  if (typescript === undefined) {
    try {
      typescript = createRequire(import.meta.url)('typescript') as typeof Ts;
    } catch {
      typescript = null;
    }
  }
  return typescript;
}

/** Тело скрипта в обёртке async-функции — как есть, для JavaScript. */
const wrapScript = (code: string): string => `async function ${ENTRY}() {\n${code}\n}`;

/**
 * Тело скрипта → JS без типов. Только запасной путь после синтаксической ошибки: `transpileModule`
 * теряет пустые строки, и номер строки ошибки у JavaScript, пропущенного через него, сбивался бы.
 * Нет пакета `typescript` — `null`.
 */
export function stripTypes(code: string): string | null {
  const ts = loadTypescript();
  if (!ts) return null;
  return ts.transpileModule(wrapScript(code), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
    },
    reportDiagnostics: false,
  }).outputText;
}

/** Значение из песочницы → строка вывода, как её напечатал бы `console.log`. */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value !== null && typeof value === 'object' && 'message' in value && 'name' in value) {
    const error = value as { name: unknown; message: unknown };
    return `${String(error.name)}: ${String(error.message)}`;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Ошибка из песочницы строкой: имя, сообщение и строка стека скрипта. */
function formatError(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'message' in value) {
    const error = value as { name?: unknown; message: unknown; stack?: unknown };
    const where =
      typeof error.stack === 'string'
        ? (error.stack.match(/:(\d+)(?::(\d+))?\)?\s*$/m) ?? null)
        : null;
    // Строка 1 — обёртка: в коде модели это строка на единицу меньше.
    const line = where ? ` (line ${Math.max(1, Number(where[1]) - 1)})` : '';
    return `${String(error.name ?? 'Error')}: ${String(error.message)}${line}`;
  }
  return formatValue(value);
}

export function createQuickJsSandbox(options: QuickJsSandboxOptions = {}): ScriptSandbox {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const cpuSliceMs = options.cpuSliceMs ?? 10_000;
  const memoryBytes = options.memoryBytes ?? 64 * 1024 * 1024;
  const maxOutputChars = options.maxOutputChars ?? 200_000;

  return {
    async run(code, functions): Promise<ScriptOutcome> {
      const module = await loadQuickJs();
      const runtime = module.newRuntime();
      runtime.setMemoryLimit(memoryBytes);
      let sliceDeadline = Date.now() + cpuSliceMs;
      const resume = (): void => {
        sliceDeadline = Date.now() + cpuSliceMs;
      };
      runtime.setInterruptHandler(() => Date.now() > sliceDeadline);
      const context = runtime.newContext();
      const logs: string[] = [];
      let outputChars = 0;
      let disposed = false;
      const pending = new Set<QuickJSDeferredPromise>();

      const print = (...handles: QuickJSHandle[]): void => {
        if (outputChars > maxOutputChars) return;
        const line = handles.map((handle) => formatValue(context.dump(handle))).join(' ');
        outputChars += line.length;
        logs.push(
          outputChars > maxOutputChars ? `${line.slice(0, 200)}… [output limit reached]` : line
        );
      };

      try {
        installConsole(context, print);
        installApi(
          context,
          functions,
          pending,
          () => disposed,
          () => {
            resume();
            runtime.executePendingJobs();
          }
        );

        const evaluate = (source: string) => context.evalCode(`${source}\n${ENTRY}()`, 'script.js');
        let evaluated = evaluate(wrapScript(code));
        // Синтаксическая ошибка случается до исполнения: повтор с TypeScript без побочных эффектов.
        if (
          evaluated.error &&
          (context.dump(evaluated.error) as { name?: string })?.name === 'SyntaxError'
        ) {
          let stripped: string | null = null;
          try {
            stripped = stripTypes(code);
          } catch {
            stripped = null;
          }
          if (stripped !== null) {
            const retried = evaluate(stripped);
            if (!retried.error) {
              evaluated.error.dispose();
              evaluated = retried;
            } else {
              retried.error.dispose();
            }
          }
        }
        if (evaluated.error) {
          const error = formatError(context.dump(evaluated.error));
          evaluated.error.dispose();
          return { logs, error };
        }
        // `resolvePromise` подписывается на промис внутри VM, а подписка исполняется только очередью
        // заданий: без этого скрипт, не позвавший ни одной функции хоста, ждал бы вечно.
        const settling = context.resolvePromise(evaluated.value);
        runtime.executePendingJobs();
        // Прерывание QuickJS срабатывает только пока исполняется код; скрипт, ждущий промис,
        // который никто не разрешит, ограничивают часы.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), timeoutMs);
        });
        const settled = await Promise.race([settling, timedOut]).finally(() => clearTimeout(timer));
        evaluated.value.dispose();
        if (settled === 'timeout') {
          return {
            logs,
            error: `InternalError: the script did not finish in ${timeoutMs / 1000} s`,
          };
        }
        if (settled.error) {
          const error = formatError(context.dump(settled.error));
          settled.error.dispose();
          return { logs, error };
        }
        const value = context.dump(settled.value);
        settled.value.dispose();
        return { logs, ...(value === undefined ? {} : { returned: formatValue(value) }) };
      } catch (error) {
        return { logs, error: String((error as Error)?.message ?? error) };
      } finally {
        disposed = true;
        // Скрипт кончился, не дождавшись вызова: хэндл промиса уже отдан VM (им владеет она), а
        // reject освобождает его резолверы — иначе рантайм уничтожался бы с живыми хэндлами.
        for (const deferred of pending) deferred.reject();
        context.dispose();
        runtime.dispose();
      }
    },
  };
}

function installConsole(
  context: QuickJSContext,
  print: (...handles: QuickJSHandle[]) => void
): void {
  const consoleHandle = context.newObject();
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    const fn = context.newFunction(method, (...handles) => print(...handles));
    context.setProp(consoleHandle, method, fn);
    fn.dispose();
  }
  context.setProp(context.global, 'console', consoleHandle);
  consoleHandle.dispose();
}

function installApi(
  context: QuickJSContext,
  functions: Readonly<Record<string, ScriptFunction>>,
  pending: Set<QuickJSDeferredPromise>,
  isDisposed: () => boolean,
  /** Продолжить скрипт после ответа хоста: новый квант времени и очередь заданий VM. */
  continueScript: () => void
): void {
  const api = context.newObject();
  for (const [name, implementation] of Object.entries(functions)) {
    const fn = context.newFunction(name, (argument) => {
      const value: unknown = argument === undefined ? undefined : context.dump(argument);
      const deferred = context.newPromise();
      pending.add(deferred);
      const settle = (ok: boolean, payload: string): void => {
        if (isDisposed()) return;
        const handle = ok ? context.newString(payload) : context.newError(payload);
        if (ok) deferred.resolve(handle);
        else deferred.reject(handle);
        handle.dispose();
        pending.delete(deferred);
        continueScript();
      };
      implementation(value).then(
        (text) => settle(true, text),
        (error: unknown) => settle(false, String((error as Error)?.message ?? error))
      );
      return deferred.handle;
    });
    context.setProp(api, name, fn);
    fn.dispose();
  }
  context.setProp(context.global, 'reformer', api);
  api.dispose();
}
