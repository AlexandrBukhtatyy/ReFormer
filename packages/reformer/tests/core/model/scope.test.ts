/**
 * Область жизни реакций модели (`createScope`) и стор приложения (`createStore`) [ReFormer-lywn.2].
 *
 * Область собирает отписки операторов модели и эффектов, созданных внутри `run`, и снимает их одним
 * `dispose()`. Поведение формы, собранной внутри области, области не принадлежит — его снимает форма.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import { settle } from '../../test-utils/async';
import {
  computeFrom,
  copyFrom,
  createModel,
  createScope,
  createStore,
  getCurrentScope,
  onScopeDispose,
  shallowEqual,
  transformValue,
  watchField,
} from '../../../src/model/index';
import { createForm } from '../../../src/form/form-bundle';
import { defineFormBehavior } from '../../../src/form/behaviors';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createScope — захват операторов модели', () => {
  it('операторы, созданные в run, снимаются dispose', async () => {
    const m = createModel({ a: 1, b: 0, c: 0, code: '' });
    const seen = vi.fn();
    const scope = createScope();
    scope.run(() => {
      computeFrom([m.$.a], m.$.b, (a) => a * 10);
      copyFrom(m.$.a, m.$.c);
      watchField(m.$.a, seen);
      transformValue(m.$.code, (v) => v.toUpperCase());
    });

    m.a = 2;
    m.code = 'x';
    await settle();
    expect({ b: m.b, c: m.c, code: m.code }).toEqual({ b: 20, c: 2, code: 'X' });
    expect(seen).toHaveBeenCalledTimes(1);

    scope.dispose();
    m.a = 3;
    m.code = 'y';
    await settle();
    expect({ b: m.b, c: m.c, code: m.code }).toEqual({ b: 20, c: 2, code: 'y' });
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('вне области операторы не захватываются и работают, пока их не снимут', () => {
    const m = createModel({ a: 1, b: 0 });
    const scope = createScope();
    const stop = computeFrom([m.$.a], m.$.b, (a) => a + 1);
    scope.dispose();
    m.a = 5;
    expect(m.b).toBe(6);
    stop();
  });

  it('ручная отписка снимает оператор и убирает его из области', () => {
    const m = createModel({ a: 1 });
    const cb = vi.fn();
    const scope = createScope();
    const add = vi.spyOn(scope, 'add');
    let stop!: () => void;
    scope.run(() => {
      stop = watchField(m.$.a, cb);
    });
    expect(add).toHaveBeenCalledTimes(1);
    const remove = add.mock.results[0]!.value as () => void;
    expect(typeof remove).toBe('function');

    stop();
    m.a = 2;
    expect(cb).not.toHaveBeenCalled();
    // Повторного снятия при dispose нет — очистка уже убрана.
    expect(() => scope.dispose()).not.toThrow();
  });

  it('getCurrentScope — текущая область внутри run и undefined снаружи', () => {
    const scope = createScope();
    expect(getCurrentScope()).toBeUndefined();
    scope.run(() => expect(getCurrentScope()).toBe(scope));
    expect(getCurrentScope()).toBeUndefined();
  });
});

describe('createScope — жизненный цикл', () => {
  it('очистки выполняются в обратном порядке, dispose идемпотентен', () => {
    const order: string[] = [];
    const scope = createScope();
    scope.add(() => order.push('first'));
    scope.add(() => order.push('second'));
    scope.dispose();
    scope.dispose();
    expect(order).toEqual(['second', 'first']);
    expect(scope.disposed).toBe(true);
  });

  it('очистка, добавленная в снятую область, выполняется сразу', () => {
    const scope = createScope();
    scope.dispose();
    const cleanup = vi.fn();
    scope.add(cleanup);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('remove из add убирает очистку, не вызывая её', () => {
    const scope = createScope();
    const cleanup = vi.fn();
    const remove = scope.add(cleanup);
    remove();
    scope.dispose();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('вложенная область снимается вместе с родителем', () => {
    const parent = createScope();
    const inner = vi.fn();
    parent.run(() => {
      const child = createScope();
      child.add(inner);
    });
    parent.dispose();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('вложенная область, снятая раньше, не снимается родителем повторно', () => {
    const parent = createScope();
    const inner = vi.fn();
    let child!: ReturnType<typeof createScope>;
    parent.run(() => {
      child = createScope();
    });
    child.add(inner);
    child.dispose();
    parent.dispose();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('упавшая очистка не мешает остальным; несколько ошибок — AggregateError', () => {
    const one = createScope();
    const after = vi.fn();
    one.add(after);
    one.add(() => {
      throw new Error('сломано');
    });
    expect(() => one.dispose()).toThrow(/сломано/);
    expect(after).toHaveBeenCalledTimes(1);

    const many = createScope();
    many.add(() => {
      throw new Error('a');
    });
    many.add(() => {
      throw new Error('b');
    });
    expect(() => many.dispose()).toThrow(AggregateError);
  });
});

describe('scope.effect', () => {
  it('эффект принадлежит области; его очистка вызывается при снятии', () => {
    const s = signal(1);
    const runs: number[] = [];
    const cleanup = vi.fn();
    const scope = createScope();
    scope.effect(() => {
      runs.push(s.value);
      return cleanup;
    });
    s.value = 2;
    scope.dispose();
    s.value = 3;
    expect(runs).toEqual([1, 2]);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('операторы, созданные в колбэке эффекта, области не принадлежат', () => {
    const m = createModel({ a: 1, b: 0 });
    const scope = createScope();
    let stop: (() => void) | undefined;
    scope.run(() => {
      scope.effect(() => {
        stop = computeFrom([m.$.a], m.$.b, (a) => a * 2);
        return () => stop?.();
      });
    });
    expect(m.b).toBe(2);
    const add = vi.spyOn(scope, 'add');
    m.a = 4;
    expect(m.b).toBe(8);
    expect(add).not.toHaveBeenCalled();
    scope.dispose();
  });
});

describe('onScopeDispose', () => {
  it('внутри области — очистка при снятии', () => {
    const cleanup = vi.fn();
    const scope = createScope();
    scope.run(() => onScopeDispose(cleanup));
    expect(cleanup).not.toHaveBeenCalled();
    scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('вне области — предупреждение в разработке', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onScopeDispose(() => {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('onScopeDispose вызван вне области'));
  });
});

describe('createStore', () => {
  function createCounterStore() {
    return createStore((scope) => {
      const model = createModel({ count: 0, doubled: 0 });
      computeFrom([model.$.count], model.$.doubled, (c) => c * 2);
      const titles: number[] = [];
      scope.effect(() => {
        titles.push(model.$.count.value);
      });
      return { model, titles, increment: () => (model.count += 1) };
    });
  }

  it('API стора — то, что вернул setup, плюс dispose', () => {
    const store = createCounterStore();
    store.increment();
    expect(store.model.doubled).toBe(2);
    expect(store.titles).toEqual([0, 1]);
    expect(Object.keys(store)).toEqual(['model', 'titles', 'increment']);

    store.dispose();
    store.increment();
    expect(store.model.count).toBe(2);
    expect(store.model.doubled).toBe(2);
    expect(store.titles).toEqual([0, 1]);
  });

  it('собственный dispose из setup вызывается перед снятием области', () => {
    const order: string[] = [];
    const store = createStore(() => {
      onScopeDispose(() => order.push('scope'));
      return { dispose: () => order.push('own') };
    });
    store.dispose();
    expect(order).toEqual(['own', 'scope']);
  });

  it('setup упал — созданное им снято, ошибка пробрасывается', () => {
    const cleanup = vi.fn();
    expect(() =>
      createStore(() => {
        onScopeDispose(cleanup);
        throw new Error('setup');
      })
    ).toThrow('setup');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('setup вернул модель — понятная ошибка вместо порчи модели', () => {
    expect(() => createStore(() => createModel({ a: 1 }))).toThrow(/обычный объект/);
    expect(() => createStore(() => Object.freeze({ a: 1 }))).toThrow(/обычный объект/);
  });

  it('форма, собранная в сторе, живёт своим поведением после снятия стора', () => {
    interface Loan {
      type: 'consumer' | 'mortgage';
      rate: number;
    }
    const store = createStore(() => {
      const bundle = createForm<Loan>({
        initial: { type: 'consumer', rate: 0 },
        behavior: defineFormBehavior<Loan>(({ model }) => {
          computeFrom([model.$.type], model.$.rate, (t) => (t === 'consumer' ? 15.9 : 9.9));
        }),
      });
      return { bundle };
    });
    const { model } = store.bundle;
    expect(model.rate).toBe(15.9);

    store.dispose();
    model.type = 'mortgage';
    expect(model.rate).toBe(9.9);
  });
});

describe('shallowEqual', () => {
  it('объекты и массивы — по верхнему уровню, вложенные — по ссылке', () => {
    const inner = { x: 1 };
    expect(shallowEqual({ a: 1, b: inner }, { a: 1, b: inner })).toBe(true);
    expect(shallowEqual({ a: {} }, { a: {} })).toBe(false);
    expect(shallowEqual([1, NaN], [1, NaN])).toBe(true);
    expect(shallowEqual([1], { 0: 1 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual(null, undefined)).toBe(false);
  });
});
