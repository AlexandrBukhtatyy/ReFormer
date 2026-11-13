import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { describe, expect, it } from 'vitest';

import { createModuleLoader } from './loader';
import {
  createLoopGuard,
  createLoopInstrumentation,
  instrumentLoops,
  LOOP_GUARD_NAME,
  LoopGuardError,
  loopInstrumentation,
} from './loop-guard';

const parser = { acorn, walk };

/** Инструментирует и считает вызовы сторожа по строкам. */
function instrumented(js: string): { out: string; lines: number[] } {
  const lines: number[] = [];
  const out = instrumentLoops(js, parser, (line) => {
    lines.push(line);
    return lines.length - 1;
  });
  return { out, lines };
}

/** Исполняет инструментированный код с подставным сторожем и отдаёт число его вызовов. */
function ticksOf(js: string): number {
  let ticks = 0;
  new Function(LOOP_GUARD_NAME, instrumented(js).out)(() => {
    ticks += 1;
  });
  return ticks;
}

describe('вставка сторожа в циклы', () => {
  it('сторож встаёт в каждый вид цикла и зовётся на каждом обороте', () => {
    expect(ticksOf('for (let i = 0; i < 3; i++) { }')).toBe(3);
    expect(ticksOf('let i = 0; while (i < 4) { i++; }')).toBe(4);
    expect(ticksOf('let i = 0; do { i++; } while (i < 2);')).toBe(2);
    expect(ticksOf('for (const k in { a: 1, b: 2 }) { }')).toBe(2);
    expect(ticksOf('for (const v of [1, 2, 3, 4, 5]) { }')).toBe(5);
  });

  it('тело без скобок оборачивается — сторож внутри оборота, а не перед циклом', () => {
    expect(ticksOf('let s = 0; for (let i = 0; i < 3; i++) s += i;')).toBe(3);
    expect(ticksOf('let i = 0; do i++; while (i < 3);')).toBe(3);
    // Вложенные циклы без скобок: внешний 2 оборота, внутренний 2×3.
    expect(ticksOf('for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) ;')).toBe(8);
  });

  it('номера строк не сдвигаются, а место цикла — его строка', () => {
    const js = 'const a = 1;\n\nwhile (false) {}\nfor (;false;) a;\n';
    const { out, lines } = instrumented(js);

    expect(out.split('\n')).toHaveLength(js.split('\n').length);
    expect(lines).toEqual([3, 4]);
  });

  it('без слов цикла файл не разбирается и не меняется', () => {
    const js = 'exports.value = 1; /* без циклов */';
    expect(instrumented(js).out).toBe(js);
  });

  it('код, который не разбирается, остаётся как есть: о нём скажет исполнение', () => {
    const js = 'while (true) {';
    expect(instrumented(js).out).toBe(js);
  });

  it('`return` на верхнем уровне законен — это тело функции-конверта', () => {
    const { out } = instrumented('for (;;) { return 1; }');
    expect(out).toContain(`${LOOP_GUARD_NAME}(0);`);
  });
});

describe('сторож циклов', () => {
  /** Часы теста и ручной сброс задачи. */
  function clock() {
    let time = 0;
    let reset: (() => void) | undefined;
    const guard = createLoopGuard({
      budgetMs: 100,
      checkEvery: 1,
      now: () => time,
      schedule: (next) => {
        reset = next;
      },
    });
    return {
      guard,
      advance: (ms: number) => {
        time += ms;
      },
      nextTask: () => reset?.(),
    };
  }

  it('задача дольше бюджета прерывается ошибкой с файлом и строкой цикла', () => {
    const { guard, advance } = clock();
    const site = guard.site('validation/form.ts', 12);

    guard.tick(site);
    advance(150);

    expect(() => guard.tick(site)).toThrowError(LoopGuardError);
    try {
      guard.tick(site);
    } catch (error) {
      expect(error).toMatchObject({ file: 'validation/form.ts', line: 12 });
      expect((error as Error).message).toContain('validation/form.ts:12');
    }
  });

  it('сработав, бросает до конца задачи — try/catch вокруг тела цикл не продлит', () => {
    const { guard, advance, nextTask } = clock();
    const site = guard.site('a.ts', 1);
    guard.tick(site);
    advance(150);
    expect(() => guard.tick(site)).toThrow();

    // Время больше не идёт, а сторож всё равно бросает: задача та же.
    expect(() => guard.tick(site)).toThrow();

    nextTask();
    expect(() => guard.tick(site)).not.toThrow();
  });

  it('бюджет — на задачу: новая задача начинает отсчёт заново', () => {
    const { guard, advance, nextTask } = clock();
    const site = guard.site('a.ts', 1);

    guard.tick(site);
    advance(80);
    guard.tick(site);
    nextTask();
    guard.tick(site);
    advance(80);

    expect(() => guard.tick(site)).not.toThrow();
  });

  it('одно место — один номер', () => {
    const guard = createLoopGuard();
    expect(guard.site('a.ts', 3)).toBe(guard.site('a.ts', 3));
    expect(guard.site('a.ts', 3)).not.toBe(guard.site('a.ts', 4));
  });
});

describe('сторож в загрузчике', () => {
  it('бесконечный цикл в модуле — ошибка с файлом и строкой, а не зависание', async () => {
    const instrumentation = createLoopInstrumentation(parser, createLoopGuard({ budgetMs: 50 }));
    const loader = createModuleLoader();

    const result = await loader.load(
      new Map([['form/validation.js', 'exports.a = 1;\nwhile (true) {}\n']]),
      'form/validation.js',
      { instrument: instrumentation.instrument, ambient: instrumentation.ambient }
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ file: 'form/validation.js', phase: 'evaluate' });
    expect(result.errors[0].message).toContain('form/validation.js:2');
  });

  it('цикл из микрозадач тоже прерывается: до сброса задачи он не доходит', async () => {
    const instrumentation = createLoopInstrumentation(parser, createLoopGuard({ budgetMs: 50 }));
    const loader = createModuleLoader();

    const result = await loader.load(
      new Map([['spin.js', 'exports.done = (async () => { while (true) { await 0; } })();']]),
      'spin.js',
      { instrument: instrumentation.instrument, ambient: instrumentation.ambient }
    );

    await expect((result.entry as { done: Promise<unknown> }).done).rejects.toThrowError(
      LoopGuardError
    );
  });

  it('в кэш идёт перевод без вставок: кэш хранит файл, а не оснастку загрузки', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register({
      id: 'id',
      applies: (fileName) => fileName.endsWith('.ts'),
      transpile: (code) => ({ js: code }),
    });
    const instrumentation = createLoopInstrumentation(parser);
    const source = 'let n = 0;\nfor (let i = 0; i < 3; i++) { n++; }\nexports.n = n;';

    const result = await loader.load(new Map([['a.ts', source]]), 'a.ts', {
      instrument: instrumentation.instrument,
      ambient: instrumentation.ambient,
    });

    expect(result.entry).toEqual({ n: 3 });
    expect(result.compiled.get('a.ts')).toBe(source);
  });

  it('JSON не инструментируется — это данные', async () => {
    const loader = createModuleLoader();
    const result = await loader.load(
      new Map([
        ['main.js', 'exports.data = require("./data.json");'],
        ['data.json', '{ "for": "while (true) {}" }'],
      ]),
      'main.js',
      {
        // Ломает только JSON: дойди до него преобразование — модуль упал бы.
        instrument: (js, fileName) =>
          fileName.endsWith('.json') ? 'throw new Error("инструментировали JSON")' : js,
      }
    );

    expect(result.entry).toEqual({ data: { for: 'while (true) {}' } });
  });

  it('ленивая загрузка отдаёт инструментирование и кэширует его', async () => {
    const first = await loopInstrumentation();
    expect(await loopInstrumentation()).toBe(first);
    expect(first.ambient[LOOP_GUARD_NAME]).toBeTypeOf('function');
  });
});
