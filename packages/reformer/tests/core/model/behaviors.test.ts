/**
 * Unit tests: behavior на сигналах модели (M1, Ф5).
 * computeFrom / copyFrom / watchField — value-операции, model-level (без нод).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createModel,
  computeFrom,
  copyFrom,
  watchField,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
} from '../../../src/core/model';

// микротаск-флаш (transformValue/resetWhen/syncFields/revalidateWhen пишут через runOutsideEffect)
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('computeFrom (signals)', () => {
  it('вычисляет target из источников и реагирует на изменения', () => {
    const m = createModel<{ price: number; qty: number; total: number }>({
      price: 0,
      qty: 0,
      total: 0,
    });
    const stop = computeFrom([m.$.price, m.$.qty], m.$.total, (price, qty) => price * qty);
    m.price = 10;
    m.qty = 3;
    expect(m.total).toBe(30);
    stop();
    m.price = 100;
    expect(m.total).toBe(30); // после отписки не пересчитывается
  });

  it('условие when пропускает вычисление', () => {
    const m = createModel<{ a: number; b: number; sum: number; on: boolean }>({
      a: 1,
      b: 2,
      sum: 0,
      on: false,
    });
    computeFrom([m.$.a, m.$.b], m.$.sum, (a, b) => a + b, { when: () => m.on });
    expect(m.sum).toBe(0); // on=false
    m.on = true;
    m.a = 5; // триггерит пересчёт (on=true)
    expect(m.sum).toBe(7);
  });

  it('цепочка вычислений A→B', () => {
    const m = createModel<{ x: number; doubled: number; plusOne: number }>({
      x: 1,
      doubled: 0,
      plusOne: 0,
    });
    computeFrom([m.$.x], m.$.doubled, (x) => x * 2);
    computeFrom([m.$.doubled], m.$.plusOne, (d) => d + 1);
    m.x = 5;
    expect(m.doubled).toBe(10);
    expect(m.plusOne).toBe(11);
  });
});

describe('copyFrom (signals)', () => {
  it('копирует source → target', () => {
    const m = createModel<{ a: string; b: string }>({ a: '', b: '' });
    copyFrom(m.$.a, m.$.b);
    m.a = 'hello';
    expect(m.b).toBe('hello');
  });

  it('по условию when (реактивно на условие)', () => {
    const m = createModel<{ same: boolean; src: string; dst: string }>({
      same: false,
      src: 'x',
      dst: '',
    });
    copyFrom(m.$.src, m.$.dst, { when: () => m.same });
    expect(m.dst).toBe(''); // same=false
    m.same = true;
    expect(m.dst).toBe('x'); // условие изменилось → скопировалось
  });

  it('transform', () => {
    const m = createModel<{ a: string; b: string }>({ a: 'abc', b: '' });
    copyFrom(m.$.a, m.$.b, { transform: (v) => v.toUpperCase() });
    m.a = 'xy';
    expect(m.b).toBe('XY');
  });
});

describe('watchField (signals)', () => {
  it('вызывает cb на изменение, не на инициализации', () => {
    const m = createModel<{ country: string }>({ country: 'RU' });
    const cb = vi.fn();
    watchField(m.$.country, cb);
    expect(cb).not.toHaveBeenCalled();
    m.country = 'US';
    expect(cb).toHaveBeenCalledWith('US');
  });

  it('immediate вызывает cb сразу', () => {
    const m = createModel<{ x: number }>({ x: 42 });
    const cb = vi.fn();
    watchField(m.$.x, cb, { immediate: true });
    expect(cb).toHaveBeenCalledWith(42);
  });

  it('cleanup останавливает наблюдение', () => {
    const m = createModel<{ x: number }>({ x: 0 });
    const cb = vi.fn();
    const stop = watchField(m.$.x, cb);
    m.x = 1;
    stop();
    m.x = 2;
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('transformValue (signals)', () => {
  it('идемпотентно трансформирует значение поля', async () => {
    const m = createModel<{ code: string }>({ code: '' });
    transformValue(m.$.code, (v) => (v ?? '').toUpperCase());
    m.code = 'abc';
    await tick();
    expect(m.code).toBe('ABC');
  });
});

describe('resetWhen (signals)', () => {
  it('сбрасывает значение при истинном условии', async () => {
    const m = createModel<{ type: string; card: string }>({ type: 'card', card: '1234' });
    resetWhen(m.$.card, () => m.type !== 'card', { resetValue: '' });
    await tick();
    expect(m.card).toBe('1234'); // условие ложно
    m.type = 'cash';
    await tick();
    expect(m.card).toBe(''); // сброшено
  });
});

describe('syncFields (signals)', () => {
  it('двусторонняя синхронизация', async () => {
    const m = createModel<{ a: string; b: string }>({ a: '', b: '' });
    syncFields(m.$.a, m.$.b);
    m.a = 'x';
    await tick();
    expect(m.b).toBe('x');
    m.b = 'y';
    await tick();
    expect(m.a).toBe('y');
  });
});

describe('revalidateWhen (signals)', () => {
  it('вызывает колбэк при изменении зависимостей (не на инициализации)', async () => {
    const m = createModel<{ maxAmount: number }>({ maxAmount: 1000 });
    const cb = vi.fn();
    revalidateWhen([m.$.maxAmount], cb);
    await tick();
    expect(cb).not.toHaveBeenCalled();
    m.maxAmount = 500;
    await tick();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
