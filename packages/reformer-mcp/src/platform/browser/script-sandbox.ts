/**
 * Песочница Code Mode в браузере — Worker внутри изолированного iframe (ReFormer-m7zg).
 *
 * Под Node скрипты исполняет QuickJS-wasm (`platform/cli/quickjs-sandbox.ts`). В браузере
 * изолят V8 уже есть — Web Worker, — и по доводу статьи Cloudflare «Code Mode» (изолят без сети,
 * наружу — только вызовы хоста) он лучше: без 0.5 МБ wasm, с JIT и той семантикой JS, которую видит
 * модель. Но Worker на origin страницы песочницей НЕ является: ему доступны `fetch` с cookies
 * страницы, IndexedDB и OPFS (в билдере там ключ модели и рабочие копии проектов).
 *
 * ## Устройство
 *
 * ```text
 * хост ──MessageChannel──────────────────────────────┐
 *  └─ iframe sandbox="allow-scripts" (непрозрачный origin, CSP default-src 'none')
 *      └─ Worker из blob: ◄──────── порт канала ─────┘
 * ```
 *
 * - Непрозрачный origin (`sandbox` без `allow-same-origin`) — хранилища страницы недоступны.
 * - CSP `default-src 'none'` наследует и воркер, созданный из `blob:`: сеть, `importScripts`,
 *   динамический `import()` чужого кода закрыты.
 * - Хост и воркер говорят через порт напрямую; iframe лишь заводит воркер. Удалить iframe —
 *   убить воркер: так кончается любой скрипт, и зависший тоже.
 * - Скрипту доступны только `reformer.*` (вызовы хоста по порту) и `console`. Сеть, таймеры и
 *   прочее дополнительно убраны из глобала — для той же поверхности, что у QuickJS; граница же —
 *   origin и CSP, а не удаление имён.
 *
 * ## Время
 *
 * Как у QuickJS: общий предел и предел НЕПРЕРЫВНОГО исполнения. Хост не видит, занят воркер или
 * ждёт, поэтому воркер шлёт пульс таймером, захваченным до того, как таймеры убраны из глобала.
 * Нет пульса дольше кванта — скрипт крутится без выхода: «interrupted». Пульс есть, а скрипт не
 * кончился за общий предел — «did not finish».
 *
 * ## Память
 *
 * Предела памяти нет: браузер не даёт ограничить память воркера. Бесконтрольное выделение может
 * уронить вкладку. Решение принято осознанно (ReFormer-m7zg): скрипты пишет модель для справочных
 * вызовов, их данные — ответы инструментов, а предел времени и вывода остаются. Нужен будет предел —
 * тот же порт закрывается QuickJS-wasm в воркере.
 *
 * @module reformer-mcp/platform/browser/script-sandbox
 */

import type {
  ScriptFunction,
  ScriptOutcome,
  ScriptSandbox,
} from '../../core/codemode/run-script.js';

export interface BrowserSandboxOptions {
  /** Предел времени скрипта вместе с вызовами хоста, мс. */
  readonly timeoutMs?: number;
  /** Предел непрерывного исполнения JS — молчания пульса воркера, мс. */
  readonly cpuSliceMs?: number;
  /** Предел суммарного вывода `console`, символы. */
  readonly maxOutputChars?: number;
  /**
   * Снятие типов TypeScript: тело скрипта → программа, объявляющая
   * `async function __reformer_main__()` (как `stripTypes` Node-песочницы). Зовётся только после
   * синтаксической ошибки. Нет — скрипт исполняется как JavaScript.
   */
  readonly stripTypes?: (code: string) => string | null;
  /** Документ, в который ставится iframe. По умолчанию — `globalThis.document`. */
  readonly document?: SandboxDocument;
  /**
   * Не убирать имена из глобала воркера. ТОЛЬКО для проверки границы: тест убеждается, что сеть и
   * хранилища закрыты origin и CSP, а не тем, что имён нет.
   */
  readonly keepGlobals?: boolean;
}

/** Та часть DOM, которой пользуется песочница: пакет собирается без библиотеки DOM. */
export interface SandboxDocument {
  createElement(tag: 'iframe'): SandboxFrame;
  readonly body: { append(node: SandboxFrame): void } | null;
  readonly documentElement: { append(node: SandboxFrame): void };
}

export interface SandboxFrame {
  setAttribute(name: string, value: string): void;
  readonly style: { display: string };
  readonly contentWindow: {
    postMessage(message: unknown, targetOrigin: string, transfer: unknown[]): void;
  } | null;
  addEventListener(type: 'load', listener: () => void): void;
  remove(): void;
}

interface PortLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
}

interface ChannelLike {
  readonly port1: PortLike;
  readonly port2: unknown;
}

/** Сообщение воркера хосту. */
type WorkerMessage =
  | { readonly type: 'ready' | 'beat' }
  | { readonly type: 'log'; readonly line: string }
  | { readonly type: 'call'; readonly id: number; readonly name: string; readonly args: unknown }
  | {
      readonly type: 'done';
      readonly returned?: string;
      readonly error?: string;
      readonly syntax?: boolean;
    };

const INIT = 'reformer-sandbox:init';
const PORT = 'reformer-sandbox:port';
/** Пульс воркера, мс: заметно меньше любого разумного кванта. */
const BEAT_MS = 100;

/**
 * Воркер песочницы. Строкой, а не функцией с `toString()`: текст уезжает в чужой контекст как
 * есть, и инструментирование покрытия или сборщик не должны дописывать в него ссылки наружу.
 * Внутри нет `${` — `String.raw` ничего не подставляет.
 */
const WORKER_SOURCE = String.raw`(() => {
  const scope = globalThis;
  // Захвачены ДО того, как имена убраны из глобала: скрипту они недоступны.
  const every = scope.setInterval.bind(scope);
  const evaluate = scope.eval;
  const DROP = [
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'importScripts',
    'Worker', 'SharedWorker', 'indexedDB', 'caches', 'BroadcastChannel', 'navigator',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'postMessage', 'close', 'onmessage',
  ];
  let port = null;
  const pending = new Map();
  let nextId = 0;

  function harden() {
    if (KEEP_GLOBALS) return;
    for (const name of DROP) {
      try { delete scope[name]; } catch (error) { /* не удаляется — затеняем ниже */ }
      if (name in scope) {
        try {
          Object.defineProperty(scope, name, { value: undefined, writable: false, configurable: false });
        } catch (error) { /* граница — origin и CSP, а не это */ }
      }
    }
  }

  function post(message) { port.postMessage(message); }

  function formatValue(value) {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value !== null && typeof value === 'object' && 'message' in value && 'name' in value) {
      return String(value.name) + ': ' + String(value.message);
    }
    try {
      const json = JSON.stringify(value, null, 2);
      return json === undefined ? String(value) : json;
    } catch (error) {
      return String(value);
    }
  }

  function formatError(value) {
    if (value !== null && typeof value === 'object' && 'message' in value) {
      const stack = typeof value.stack === 'string' ? value.stack : '';
      const where = stack.match(/script\.js:(\d+)/);
      // JavaScriptCore не пишет sourceURL кода из eval в стек, но знает строку сам — полем line.
      const raw = where ? Number(where[1]) : typeof value.line === 'number' ? value.line : NaN;
      // Строка 1 — обёртка: в коде модели это строка на единицу меньше.
      const line = Number.isFinite(raw) ? ' (line ' + Math.max(1, raw - 1) + ')' : '';
      return String(value.name === undefined ? 'Error' : value.name) + ': ' + String(value.message) + line;
    }
    return formatValue(value);
  }

  const sandboxConsole = {};
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    sandboxConsole[method] = (...values) => post({ type: 'log', line: values.map(formatValue).join(' ') });
  }

  function call(name, args) {
    let payload;
    try {
      payload = args === undefined ? undefined : JSON.parse(JSON.stringify(args));
    } catch (error) {
      return Promise.reject(new TypeError('reformer.' + name + ': the argument is not plain data'));
    }
    nextId += 1;
    const id = nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      post({ type: 'call', id, name, args: payload });
    });
  }

  function run(message) {
    const api = {};
    for (const name of message.names) api[name] = (args) => call(name, args);
    scope.reformer = api;
    scope.console = sandboxConsole;
    let main;
    try {
      main = message.program
        ? evaluate(message.code + '\n;__reformer_main__\n//# sourceURL=script.js')
        : evaluate('(async function __reformer_main__() {\n' + message.code + '\n})\n//# sourceURL=script.js');
    } catch (error) {
      post({ type: 'done', error: formatError(error), syntax: error instanceof SyntaxError });
      return;
    }
    Promise.resolve()
      .then(() => main())
      .then(
        (value) => post(value === undefined ? { type: 'done' } : { type: 'done', returned: formatValue(value) }),
        (error) => post({ type: 'done', error: formatError(error) })
      );
  }

  scope.onmessage = (event) => {
    if (port !== null || !event.data || event.data.type !== 'reformer-sandbox:port') return;
    port = event.ports[0];
    port.onmessage = (portEvent) => {
      const message = portEvent.data;
      if (message.type === 'run') {
        run(message);
      } else if (message.type === 'result') {
        const waiter = pending.get(message.id);
        if (waiter === undefined) return;
        pending.delete(message.id);
        if (message.ok) waiter.resolve(message.payload);
        else waiter.reject(new Error(message.payload));
      }
    };
    every(() => post({ type: 'beat' }), BEAT_MS);
    scope.onmessage = null;
    harden();
    post({ type: 'ready' });
  };
})();`;

/** Страница iframe: CSP и заводчик воркера. `<` экранирован — текст воркера лежит в `<script>`. */
function frameDocument(keepGlobals: boolean): string {
  const worker = `const KEEP_GLOBALS = ${keepGlobals ? 'true' : 'false'};\nconst BEAT_MS = ${BEAT_MS};\n${WORKER_SOURCE}`;
  const source = JSON.stringify(worker).replace(/</g, '\\u003c');
  const csp =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:";
  return (
    '<!doctype html><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    '<script>' +
    'addEventListener("message", (event) => {' +
    `  if (event.source !== parent || !event.data || event.data.type !== "${INIT}") return;` +
    '  const port = event.ports[0];' +
    '  try {' +
    `    const url = URL.createObjectURL(new Blob([${source}], { type: "text/javascript" }));` +
    '    const worker = new Worker(url);' +
    '    worker.onerror = (error) => port.postMessage({ type: "done", error: "InternalError: the sandbox worker failed: " + (error.message || "load error") });' +
    `    worker.postMessage({ type: "${PORT}" }, [port]);` +
    '  } catch (error) {' +
    '    port.postMessage({ type: "done", error: "InternalError: the sandbox worker did not start: " + error.message });' +
    '  }' +
    '});' +
    '</script>'
  );
}

export function createBrowserSandbox(options: BrowserSandboxOptions = {}): ScriptSandbox {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const cpuSliceMs = options.cpuSliceMs ?? 10_000;
  const maxOutputChars = options.maxOutputChars ?? 200_000;
  const keepGlobals = options.keepGlobals === true;

  return {
    run(code, functions): Promise<ScriptOutcome> {
      const doc =
        options.document ??
        (globalThis as unknown as { document?: SandboxDocument }).document ??
        null;
      const Channel = (globalThis as unknown as { MessageChannel?: new () => ChannelLike })
        .MessageChannel;
      if (doc === null || Channel === undefined) {
        return Promise.resolve({
          logs: [],
          error: 'InternalError: the browser sandbox needs a page (document and MessageChannel)',
        });
      }

      const frame = doc.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('srcdoc', frameDocument(keepGlobals));
      frame.style.display = 'none';
      const channel = new Channel();
      const port = channel.port1;
      const names = Object.keys(functions);

      return new Promise<ScriptOutcome>((resolve) => {
        const logs: string[] = [];
        let outputChars = 0;
        let settled = false;
        let retried = false;
        let lastSign = Date.now();

        const finish = (outcome: Omit<ScriptOutcome, 'logs'>): void => {
          if (settled) return;
          settled = true;
          clearTimeout(total);
          clearInterval(watch);
          port.onmessage = null;
          port.close();
          // Удалённый iframe уносит с собой и воркер — вместе с тем, что он ещё исполнял.
          frame.remove();
          resolve({ logs, ...outcome });
        };

        const total = setTimeout(() => {
          finish({ error: `InternalError: the script did not finish in ${timeoutMs / 1000} s` });
        }, timeoutMs);
        const watch = setInterval(
          () => {
            if (Date.now() - lastSign > cpuSliceMs) finish({ error: 'InternalError: interrupted' });
          },
          Math.max(BEAT_MS, Math.min(250, cpuSliceMs / 2))
        );

        const print = (line: string): void => {
          if (outputChars > maxOutputChars) return;
          outputChars += line.length;
          logs.push(
            outputChars > maxOutputChars ? `${line.slice(0, 200)}… [output limit reached]` : line
          );
        };

        const answer = (id: number, name: string, args: unknown): void => {
          const fn: ScriptFunction | undefined = functions[name];
          const reply = (ok: boolean, payload: string): void => {
            if (!settled) port.postMessage({ type: 'result', id, ok, payload });
          };
          if (fn === undefined) {
            reply(false, `reformer.${name} is not a function`);
            return;
          }
          fn(args).then(
            (text) => reply(true, text),
            (error: unknown) => reply(false, String((error as Error)?.message ?? error))
          );
        };

        const handle = (event: { readonly data: unknown }): void => {
          lastSign = Date.now();
          const message = event.data as WorkerMessage;
          switch (message.type) {
            case 'ready':
              port.postMessage({ type: 'run', code, names });
              return;
            case 'beat':
              return;
            case 'log':
              print(message.line);
              return;
            case 'call':
              answer(message.id, message.name, message.args);
              return;
            case 'done': {
              // Синтаксическая ошибка случается до исполнения: повтор без типов побочных
              // эффектов не даёт. Не вышло и без типов — остаётся первая ошибка.
              if (message.syntax === true && !retried && options.stripTypes !== undefined) {
                retried = true;
                let stripped: string | null = null;
                try {
                  stripped = options.stripTypes(code);
                } catch {
                  stripped = null;
                }
                if (stripped !== null) {
                  const first = message.error;
                  port.onmessage = (next) => {
                    const again = next.data as WorkerMessage;
                    if (again.type === 'done' && again.syntax === true) {
                      lastSign = Date.now();
                      finish({ error: first ?? again.error });
                      return;
                    }
                    handle(next);
                  };
                  port.postMessage({ type: 'run', code: stripped, program: true, names });
                  return;
                }
              }
              finish({
                ...(message.returned === undefined ? {} : { returned: message.returned }),
                ...(message.error === undefined ? {} : { error: message.error }),
              });
              return;
            }
          }
        };
        port.onmessage = handle;

        frame.addEventListener('load', () => {
          frame.contentWindow?.postMessage({ type: INIT }, '*', [channel.port2]);
        });
        (doc.body ?? doc.documentElement).append(frame);
      });
    },
  };
}
