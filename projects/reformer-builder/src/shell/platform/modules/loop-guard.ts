/**
 * Сторож циклов: код формы прерывается исключением, а не вешает вкладку (ReFormer-ow29).
 *
 * Превью исполняет код формы в главном потоке — так задумано, форма и её рендер делят один
 * экземпляр ядра и React. Цена — бесконечный цикл в коде формы вешает билдер целиком, и
 * прервать его изнутри страницы нечем. А случается он чаще, чем кажется: превью собирает форму
 * через 200 мс тишины после набора, и недописанный `while (node) {}` (скобку закрыл редактор)
 * исполняется раньше, чем человек допишет тело. Подробно — `docs/plans/builder-preview-hang-protection.md`.
 *
 * ## Как
 *
 * В начало тела каждого цикла (`while`, `do…while`, `for`, `for…in`, `for…of`) выведенного JS
 * вставляется вызов сторожа. Сторож считает время синхронной задачи и, когда она идёт дольше
 * бюджета, бросает {@link LoopGuardError} с файлом и строкой цикла. Вставки только внутри строк:
 * номера строк не сдвигаются, отладка и стек остаются прежними (sucrase сохраняет строки
 * исходника, поэтому строка цикла в выводе — строка в файле человека).
 *
 * Сторож приходит модулю ЛЕКСИЧЕСКИ, параметром `ambient` линковщика: глобалы не трогаются,
 * оболочка и соседний код его не видят.
 *
 * ## Бюджет — на задачу, а не на цикл
 *
 * Время отсчитывается от первой проверки в задаче и сбрасывается следующей макрозадачей
 * (`MessageChannel`). Поэтому одинаково ловятся и вложенные циклы, и цикл из многих вызовов
 * функции, и `while (true) await x` — цепочка микрозадач до сброса не доходит. Сработав, сторож
 * бросает при каждом обороте до конца задачи: `try/catch` вокруг тела цикл не продлит.
 *
 * ## Чего не ловит
 *
 * Долгий код без циклов в коде формы: катастрофический regex, `sort` огромного массива, циклы
 * внутри библиотек (ядро, кит). Сборку от этого страхует метка незавершённой сборки превью.
 *
 * @module shell/platform/modules/loop-guard
 */

import type * as Acorn from 'acorn';
import type * as AcornWalk from 'acorn-walk';

/** Имя, под которым сторож приходит модулю. Нарочно чужое — с кодом человека не столкнётся. */
export const LOOP_GUARD_NAME = '__reformerLoopGuard__';

/** Бюджет синхронной задачи по умолчанию, мс. Цикл в форме дольше двух секунд — уже беда. */
export const LOOP_BUDGET_MS = 2000;

/** Цикл кода формы работал дольше бюджета и прерван. */
export class LoopGuardError extends Error {
  readonly file: string;
  readonly line: number;

  constructor(file: string, line: number, budgetMs: number) {
    super(
      `цикл в ${file}:${line} работает дольше ${budgetMs / 1000} с — прерван, ` +
        'чтобы не зависла вкладка'
    );
    this.name = 'LoopGuardError';
    this.file = file;
    this.line = line;
  }
}

export interface LoopGuardOptions {
  /** Бюджет синхронной задачи, мс. */
  readonly budgetMs?: number;
  /** Время проверяется раз в столько оборотов; степень двойки. */
  readonly checkEvery?: number;
  readonly now?: () => number;
  /** Запланировать сброс на следующую макрозадачу. */
  readonly schedule?: (reset: () => void) => void;
}

/** Сторож циклов одной страницы. */
export interface LoopGuard {
  /** Место цикла → номер для вызова сторожа. Одно место — один номер. */
  site(file: string, line: number): number;
  /** Сам сторож: зовётся в начале каждого оборота инструментированного цикла. */
  readonly tick: (site: number) => void;
}

/** Следующая макрозадача: `MessageChannel` без задержки таймера, иначе — таймер. */
function nextTask(reset: () => void): void {
  if (typeof MessageChannel === 'function') {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      reset();
    };
    channel.port2.postMessage(null);
    return;
  }
  setTimeout(reset, 0);
}

export function createLoopGuard(options: LoopGuardOptions = {}): LoopGuard {
  const budget = options.budgetMs ?? LOOP_BUDGET_MS;
  const mask = (options.checkEvery ?? 256) - 1;
  const now = options.now ?? (() => performance.now());
  const schedule = options.schedule ?? nextTask;

  const sites: { readonly file: string; readonly line: number }[] = [];
  const known = new Map<string, number>();
  let count = 0;
  /** Время первой проверки в текущей задаче; `-1` — проверок в ней ещё не было. */
  let started = -1;
  let tripped = false;

  const reset = (): void => {
    started = -1;
    tripped = false;
  };
  const failure = (site: number): LoopGuardError => {
    const at = sites[site];
    return new LoopGuardError(at?.file ?? '?', at?.line ?? 0, budget);
  };

  return {
    site(file, line) {
      const key = `${file}:${line}`;
      const existing = known.get(key);
      if (existing !== undefined) return existing;
      sites.push({ file, line });
      known.set(key, sites.length - 1);
      return sites.length - 1;
    },

    tick(site) {
      if (tripped) throw failure(site);
      count = (count + 1) & 0x3fffffff;
      if ((count & mask) !== 0) return;
      const at = now();
      if (started < 0) {
        started = at;
        schedule(reset);
        return;
      }
      if (at - started > budget) {
        tripped = true;
        throw failure(site);
      }
    },
  };
}

/** Парсер, которым инструментируется код: acorn и его обход. */
export interface LoopParser {
  readonly acorn: Pick<typeof Acorn, 'parse'>;
  readonly walk: Pick<typeof AcornWalk, 'simple'>;
}

/** Есть ли в тексте хоть одно слово цикла. Нет — разбирать незачем: таких файлов почти все. */
const LOOP_WORD = /\b(?:for|while|do)\b/;

type LoopNode =
  | Acorn.WhileStatement
  | Acorn.DoWhileStatement
  | Acorn.ForStatement
  | Acorn.ForInStatement
  | Acorn.ForOfStatement;

/**
 * Вставляет вызов сторожа в начало тела каждого цикла.
 *
 * Код, который не разбирается, возвращается как есть: исполнение скажет о нём то же, что и без
 * сторожа, — подменять его ошибку своей было бы хуже.
 *
 * @param site - Строка цикла в этом файле → номер места у сторожа.
 */
export function instrumentLoops(
  js: string,
  parser: LoopParser,
  site: (line: number) => number,
  name: string = LOOP_GUARD_NAME
): string {
  if (!LOOP_WORD.test(js)) return js;
  let ast: Acorn.Program;
  try {
    ast = parser.acorn.parse(js, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      // Конверт CommonJS — тело функции: `return` на верхнем уровне законен.
      allowReturnOutsideFunction: true,
      allowHashBang: true,
      locations: true,
    });
  } catch {
    return js;
  }

  const edits: (readonly [number, string])[] = [];
  const visit = (node: LoopNode): void => {
    const call = `${name}(${site(node.loc?.start.line ?? 0)});`;
    const body = node.body;
    if (body.type === 'BlockStatement') {
      edits.push([body.start + 1, call]);
    } else {
      // Тело без скобок оборачивается: вызов обязан стоять ВНУТРИ оборота, а не перед циклом.
      edits.push([body.start, `{${call}`], [body.end, '}']);
    }
  };
  parser.walk.simple(ast, {
    WhileStatement: visit,
    DoWhileStatement: visit,
    ForStatement: visit,
    ForInStatement: visit,
    ForOfStatement: visit,
  });
  if (edits.length === 0) return js;

  // С конца: вставка не сдвигает позиции тех, что левее.
  edits.sort((a, b) => b[0] - a[0]);
  let out = js;
  for (const [at, text] of edits) out = out.slice(0, at) + text + out.slice(at);
  return out;
}

/** Что получает загрузчик: преобразование кода и окружение со сторожем. */
export interface LoopInstrumentation {
  readonly instrument: (js: string, fileName: string) => string;
  readonly ambient: Readonly<Record<string, unknown>>;
}

/** Собирает инструментирование над готовым парсером и сторожем. */
export function createLoopInstrumentation(
  parser: LoopParser,
  guard: LoopGuard = createLoopGuard()
): LoopInstrumentation {
  return {
    instrument: (js, fileName) => instrumentLoops(js, parser, (line) => guard.site(fileName, line)),
    ambient: { [LOOP_GUARD_NAME]: guard.tick },
  };
}

let loading: Promise<LoopInstrumentation> | undefined;

/**
 * Инструментирование страницы: acorn грузится лениво, один раз, сторож — один на страницу (бюджет
 * задачи общий для всех форм). Неудачная загрузка не запоминается.
 */
export function loopInstrumentation(): Promise<LoopInstrumentation> {
  loading ??= Promise.all([import('acorn'), import('acorn-walk')]).then(
    ([acorn, walk]) => createLoopInstrumentation({ acorn, walk }),
    (error: unknown) => {
      loading = undefined;
      throw error;
    }
  );
  return loading;
}
