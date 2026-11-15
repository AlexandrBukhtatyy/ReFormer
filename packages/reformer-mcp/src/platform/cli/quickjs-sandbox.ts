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
/** Модуль `typescript`, если он установлен: снятие типов, место синтаксической ошибки, лямбды. */
export function loadTypescript(): typeof Ts | null {
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

/**
 * Где синтаксическая ошибка: сообщение разборщика TypeScript и кусок кода вокруг места. QuickJS
 * называет только строку, а скрипт малой модели — одна строка: после «expecting ':' (line 1)» она
 * бросала API и писала файлы руками (батч 20261114T192434Z-731c). Нет пакета `typescript` — `null`.
 */
export function syntaxPlace(code: string): string | null {
  const ts = loadTypescript();
  if (!ts) return null;
  const wrapped = wrapScript(code);
  const { diagnostics } = ts.transpileModule(wrapped, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
    reportDiagnostics: true,
  });
  const first = diagnostics?.find((diagnostic) => diagnostic.start !== undefined);
  if (!first || first.start === undefined) return null;
  const at = Math.min(code.length, Math.max(0, first.start - wrapped.indexOf(code)));
  const flat = (text: string): string => text.replace(/\s+/g, ' ');
  const before = flat(code.slice(Math.max(0, at - 60), at));
  const after = flat(code.slice(at, at + 30));
  return `${ts.flattenDiagnosticMessageText(first.messageText, ' ')} — at character ${at + 1}: …${before}⟪here⟫${after}…`;
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
    async run(code, functions, around = {}): Promise<ScriptOutcome> {
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

        // Прелюдия — до скрипта и отдельным файлом: номера строк ошибок скрипта не сдвигаются.
        if (around.prelude !== undefined) {
          const prelude = context.evalCode(around.prelude, 'prelude.js');
          if (prelude.error) {
            const error = formatError(context.dump(prelude.error));
            prelude.error.dispose();
            return { logs, error: `the server prelude failed: ${error}` };
          }
          prelude.value.dispose();
        }
        const deadline = Date.now() + timeoutMs;
        /** Эпилог после скрипта: в оставшееся время, его вывод — в те же строки. */
        const finish = async (failed: boolean): Promise<string | undefined> => {
          if (around.epilogue === undefined) return undefined;
          resume();
          const started = context.evalCode(`(${around.epilogue})(${failed})`, 'epilogue.js');
          if (started.error) {
            const error = formatError(context.dump(started.error));
            started.error.dispose();
            return error;
          }
          const finished = context.resolvePromise(started.value);
          runtime.executePendingJobs();
          let epilogueTimer: ReturnType<typeof setTimeout> | undefined;
          const late = new Promise<'timeout'>((resolve) => {
            epilogueTimer = setTimeout(
              () => resolve('timeout'),
              Math.max(0, deadline - Date.now())
            );
          });
          const done = await Promise.race([finished, late]).finally(() =>
            clearTimeout(epilogueTimer)
          );
          started.value.dispose();
          if (done === 'timeout')
            return `InternalError: the script did not finish in ${timeoutMs / 1000} s`;
          if (done.error) {
            const error = formatError(context.dump(done.error));
            done.error.dispose();
            return error;
          }
          done.value.dispose();
          return undefined;
        };
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
            // Снятие типов — работа хоста (первый раз ещё и загрузка `typescript`), а не скрипта:
            // квант непрерывного исполнения начинается заново, иначе под нагрузкой повтор
            // прерывался бы, не начавшись.
            resume();
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
          const dumped = context.dump(evaluated.error) as { name?: string };
          let error = formatError(dumped);
          evaluated.error.dispose();
          if (dumped?.name === 'SyntaxError') {
            let place: string | null = null;
            try {
              place = syntaxPlace(code);
            } catch {
              place = null;
            }
            if (place) error = `${error}; ${place}`;
          }
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
          await finish(true);
          return { logs, error };
        }
        const value = context.dump(settled.value);
        settled.value.dispose();
        const epilogueError = await finish(false);
        return {
          logs,
          ...(value === undefined ? {} : { returned: formatValue(value) }),
          ...(epilogueError === undefined ? {} : { error: epilogueError }),
        };
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
    const fn = context.newFunction(name, (argument, ...rest) => {
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
      // Второй аргумент функция не читает: правки во втором объекте молча терялись, а модель видела
      // «✓» (L2-registration-lite, 20261113T202315Z-dab0) — теперь это ошибка вызова.
      const called =
        rest.length > 0
          ? Promise.reject(
              new Error(
                `reformer.${name} takes ONE object — put everything into it, e.g. reformer.${name}({ dir: "form", edits: [ … ] }); ${rest.length} more argument(s) ignored`
              )
            )
          : implementation(value);
      called.then(
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
