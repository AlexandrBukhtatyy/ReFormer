/**
 * Сторож циклов в настоящем браузере (ReFormer-ow29).
 *
 * Node-прогон проверяет вставку и бюджет, но не то, ради чего сторож заведён: что в главном
 * потоке браузера бесконечный цикл кода формы кончается исключением, а страница остаётся живой.
 *
 * @module shell/platform/modules/loop-guard.browser.test
 */

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { describe, expect, it } from 'vitest';

import { createModuleLoader } from './loader';
import { createLoopGuard, createLoopInstrumentation, loopInstrumentation } from './loop-guard';

describe('сторож циклов в браузере', () => {
  it('ленивая загрузка acorn приезжает', async () => {
    const instrumentation = await loopInstrumentation();
    expect(instrumentation.instrument('while (false) {}', 'a.js')).toContain(
      '__reformerLoopGuard__'
    );
  });

  it('бесконечный цикл кончается исключением, и страница продолжает работать', async () => {
    const instrumentation = createLoopInstrumentation(
      { acorn, walk },
      createLoopGuard({ budgetMs: 200 })
    );
    const started = performance.now();

    const result = await createModuleLoader().load(
      new Map([['form/behavior.js', 'exports.ready = true;\nwhile (true) {}\n']]),
      'form/behavior.js',
      { instrument: instrumentation.instrument, ambient: instrumentation.ambient }
    );

    expect(result.errors[0]?.message).toContain('form/behavior.js:2');
    expect(performance.now() - started).toBeLessThan(2000);
    // Задача кончилась — следующая макрозадача исполняется: страница не висит.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
});
