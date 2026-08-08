/**
 * Ф0 live-превью: транспиляция → линковка → резолв модулей.
 *
 * Главная проверка — не «код исполнился», а «исполнился на ИНСТАНСАХ БИЛДЕРА»: `resolveModule`
 * обязан отдавать тот же объект `@reformer/core`, что импортирует сам билдер. Второй инстанс
 * молча ломает `getNodeForSignal`, и обнаруживается это уже в рантайме превью пустыми полями.
 *
 * @module reformer-builder/preview-runtime/live/live-plumbing.test
 */

import { describe, expect, it } from 'vitest';
import { createModel } from '@reformer/core';
import { defineFormBehavior } from '@reformer/core/behaviors';
import { evalCjsModule } from './link';
import { canResolveModule, resolveModule } from './module-registry';
import { transpileTs } from './transpile';

describe('module-registry', () => {
  it('отдаёт инстансы билдера, а не копии', () => {
    expect(resolveModule('@reformer/core').createModel).toBe(createModel);
    expect(resolveModule('@reformer/core/behaviors').defineFormBehavior).toBe(defineFormBehavior);
  });

  it('поштучный валидатор резолвится через общий barrel', () => {
    expect(resolveModule('@reformer/core/validators/required').required).toBe(
      resolveModule('@reformer/core/validators').required
    );
  });

  it('кит отдаётся и по barrel, и по subpath', () => {
    expect(resolveModule('@reformer/ui-kit')).toBe(resolveModule('@reformer/ui-kit/form-wizard'));
  });

  it('неподдержанный спецификатор — понятная ошибка, а не undefined', () => {
    expect(canResolveModule('lodash')).toBe(false);
    expect(() => resolveModule('lodash')).toThrow(/lodash/);
  });
});

describe('transpileTs', () => {
  it('стирает типы и собирает CommonJS', async () => {
    const js = await transpileTs(
      `import type { FormModel } from '@reformer/core';
       export const answer: number = 42;
       export type Unused = FormModel<unknown>;`,
      'model.ts'
    );
    expect(js).toContain('exports.answer');
    expect(js).not.toContain('FormModel');
  });

  it('синтаксическая ошибка приходит с именем файла и позицией', async () => {
    await expect(transpileTs('export const = 1;', 'validation.ts')).rejects.toThrow(
      /validation\.ts:1:/
    );
  });

  it('JSX компилируется в вызовы react/jsx-runtime', async () => {
    const js = await transpileTs(`export const el = <div className="x" />;`, 'wizard.tsx');
    expect(js).toContain('react/jsx-runtime');
  });
});

describe('evalCjsModule', () => {
  it('исполняет модуль и отдаёт его экспорты', async () => {
    const js = await transpileTs(`export const greet = (n: string) => 'Привет, ' + n;`, 'x.ts');
    const exports = evalCjsModule(js, resolveModule, 'x.ts');
    expect((exports.greet as (n: string) => string)('Мир')).toBe('Привет, Мир');
  });

  it('код формы получает реальный DSL reformer', async () => {
    const js = await transpileTs(
      `import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
       interface Shape { name: string; greeting: string }
       export const formBehavior = defineFormBehavior<Shape>(({ model }) => {
         computeFrom([model.$.name], model.$.greeting, (name) => (name ? 'Привет, ' + name : ''));
       });`,
      'form-behavior.ts'
    );
    const { formBehavior } = evalCjsModule(js, resolveModule, 'form-behavior.ts');
    expect(formBehavior).toBeTruthy();

    // Поведение должно работать на модели, созданной билдером, — это и есть проверка синглтона.
    const model = createModel({ name: '', greeting: '' });
    (formBehavior as { __run: (m: unknown, p: unknown) => unknown }).__run(model, model);
    model.$.name.value = 'Мир';
    expect(model.$.greeting.value).toBe('Привет, Мир');
  });

  it('неизвестный импорт роняет исполнение с внятным текстом', async () => {
    const js = await transpileTs(`import x from 'lodash'; export const y = x;`, 'bad.ts');
    expect(() => evalCjsModule(js, resolveModule, 'bad.ts')).toThrow(/lodash/);
  });
});
