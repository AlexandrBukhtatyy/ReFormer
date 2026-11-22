import { describe, expect, it } from 'vitest';
import type { ResourceId, ResourceRef } from '../primitives/resource.js';
import { locateFormModule, type FormModuleLocator } from './form-module.js';
import type { DocumentRef } from './validation/types.js';

const doc = (path: string, providerId?: string): DocumentRef => ({
  id: path as ResourceId,
  ref: { id: path as ResourceId, path } as ResourceRef,
  kind: 'model',
  ...(providerId !== undefined ? { providerId } : {}),
});

/** Вклад стека, который берётся только за документы своего провайдера модели. */
const stack = (providerId: string, dir: string): FormModuleLocator => ({
  moduleOf: (d) => (d.providerId === providerId ? (dir as ResourceId) : null),
});

describe('место модуля формы — ответ точки', () => {
  it('отвечает первый вклад, который взялся за документ', () => {
    const locators = [stack('rjsf', 'rjsf-module'), stack('reformer', 'forms/credit')];

    expect(locateFormModule(locators, doc('forms/credit.schema.json', 'reformer'))).toBe(
      'forms/credit'
    );
    expect(locateFormModule(locators, doc('forms/x.json', 'rjsf'))).toBe('rjsf-module');
  });

  it('никто не взялся — null: спрашивающий берёт своё общее правило', () => {
    expect(locateFormModule([stack('reformer', 'm')], doc('notes.md'))).toBeNull();
    expect(locateFormModule([], doc('forms/credit.schema.json', 'reformer'))).toBeNull();
  });

  it('сбой вклада — не ответ: следующий вклад всё равно спрашивается', () => {
    const broken: FormModuleLocator = {
      moduleOf: () => {
        throw new Error('стек сломан');
      },
    };

    expect(
      locateFormModule([broken, stack('reformer', 'forms/credit')], doc('a.json', 'reformer'))
    ).toBe('forms/credit');
  });
});
