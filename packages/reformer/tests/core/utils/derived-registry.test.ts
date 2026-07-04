/**
 * Unit-тесты реестра производных сигналов.
 *
 * Покрывают F9/F25: markDerived/isDerived + обратная операция unmarkDerived с подсчётом ссылок.
 * Без unmarkDerived снятый compute навсегда замораживал бы своё целевое поле для bulk-set.
 */

import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals-core';
import { markDerived, isDerived, unmarkDerived } from '../../../src/core/utils/derived-registry';

describe('derived-registry', () => {
  it('markDerived помечает сигнал, isDerived читает пометку', () => {
    const s = signal(0);
    expect(isDerived(s)).toBe(false);
    markDerived(s);
    expect(isDerived(s)).toBe(true);
  });

  it('unmarkDerived снимает пометку (обратная операция) — поле снова доступно для bulk-set', () => {
    const s = signal(0);
    markDerived(s);
    expect(isDerived(s)).toBe(true);
    unmarkDerived(s);
    expect(isDerived(s)).toBe(false);
  });

  it('refcount: два владельца — снятие одного НЕ размораживает поле, пока жив второй compute', () => {
    const s = signal(0);
    markDerived(s); // compute A
    markDerived(s); // compute B пишет в тот же сигнал
    expect(isDerived(s)).toBe(true);

    unmarkDerived(s); // dispose A
    expect(isDerived(s)).toBe(true); // B ещё владеет — поле остаётся замороженным

    unmarkDerived(s); // dispose B — последний владелец снят
    expect(isDerived(s)).toBe(false);
  });

  it('unmarkDerived на непомеченном сигнале — безопасный no-op (не уходит в отрицательный счётчик)', () => {
    const s = signal(0);
    expect(() => unmarkDerived(s)).not.toThrow();
    expect(isDerived(s)).toBe(false);

    // лишний unmark не должен «задолжать» счётчику: после mark сигнал сразу derived
    unmarkDerived(s);
    markDerived(s);
    expect(isDerived(s)).toBe(true);
  });

  it('разные сигналы независимы', () => {
    const a = signal(0);
    const b = signal(0);
    markDerived(a);
    expect(isDerived(a)).toBe(true);
    expect(isDerived(b)).toBe(false);
    unmarkDerived(a);
    expect(isDerived(a)).toBe(false);
  });
});
