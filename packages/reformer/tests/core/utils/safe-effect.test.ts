/**
 * Unit-тесты планировщика отложенных записей safe-effect.
 *
 * Покрывают:
 * - F7  — маршрутизация ошибок: синхронный throw и async-rejection уходят в dev-лог,
 *          а не всплывают неперехваченными / не тонут как unhandledRejection; изоляция соседних записей.
 * - F7  — liveness: runOutsideEffect возвращает отменитель ещё не выполненной записи.
 * - F10 — safeCallback/safeDebouncedCallback: форвардинг аргументов, отсутствие двойного defer.
 *
 * NB: записи НЕ оборачиваются в batch() (см. заметку в safe-effect.ts) — реципрокные guard'ы слоя
 * данных (syncFields) полагаются на синхронный встречный флаш во время записи; поэтому тут проверяется
 * отсутствие batch-семантики (записи применяются по отдельности).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { tick } from '../../test-utils/async';
import {
  runOutsideEffect,
  safeCallback,
  safeDebouncedCallback,
} from '../../../src/model/safe-effect';

// setTimeout(0) — макрозадача, гарантированно после всех микрозадач текущего тика (после flush).

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runOutsideEffect', () => {
  it('откладывает fn (не выполняет синхронно) и выполняет на микротаске', async () => {
    let ran = false;
    runOutsideEffect(() => {
      ran = true;
    });
    expect(ran).toBe(false);
    await tick();
    expect(ran).toBe(true);
  });

  it('несколько отложенных записей тика применяются в порядке постановки', async () => {
    const order: number[] = [];
    runOutsideEffect(() => void order.push(1));
    runOutsideEffect(() => void order.push(2));
    runOutsideEffect(() => void order.push(3));
    expect(order).toEqual([]); // отложено
    await tick();
    expect(order).toEqual([1, 2, 3]);
  });

  it('F7: синхронный throw уходит в dev-лог и НЕ рвёт соседние записи', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let ranAfter = false;
    runOutsideEffect(() => {
      throw new Error('boom');
    });
    runOutsideEffect(() => {
      ranAfter = true;
    });
    await tick();

    expect(ranAfter).toBe(true); // изоляция: вторая запись выполнилась
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('[runOutsideEffect]'))).toBe(true);
  });

  it('F7: async-rejection маршрутизируется в обработчик, а не тонет как unhandledRejection', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runOutsideEffect(async () => {
      throw new Error('async boom');
    });
    await tick();
    await tick(); // дать rejection-микрозадаче и маршрутизации отработать

    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('[runOutsideEffect]'))).toBe(true);
  });

  it('F7 liveness: возвращённый отменитель снимает ещё не выполненную запись', async () => {
    let ran = false;
    const cancel = runOutsideEffect(() => {
      ran = true;
    });
    cancel();
    await tick();
    expect(ran).toBe(false);
  });

  it('отмена одной записи не мешает остальным записям тика', async () => {
    const order: string[] = [];
    runOutsideEffect(() => void order.push('a'));
    const cancel = runOutsideEffect(() => void order.push('b'));
    runOutsideEffect(() => void order.push('c'));
    cancel();
    await tick();
    expect(order).toEqual(['a', 'c']);
  });
});

describe('safeCallback', () => {
  it('откладывает вызов и форвардит аргументы', async () => {
    const calls: Array<[number, string]> = [];
    const wrapped = safeCallback((a: number, b: string) => {
      calls.push([a, b]);
    });
    wrapped(1, 'x');
    expect(calls).toHaveLength(0); // отложено
    await tick();
    expect(calls).toEqual([[1, 'x']]);
  });
});

describe('safeDebouncedCallback', () => {
  it('F10: нет двойного defer — тайминг делегирован withDebounce (синхронный withDebounce → синхронный вызов)', () => {
    let count = 0;
    // Синхронный withDebounce: со старым кодом callback ещё откладывался queueMicrotask'ом (двойной defer),
    // и count остался бы 0. Теперь лишнего хопа нет — callback вызывается сразу.
    const wrapped = safeDebouncedCallback(
      () => {
        count++;
      },
      (fn) => fn()
    );
    wrapped();
    expect(count).toBe(1);
  });

  it('F10: сбой callback маршрутизируется, а не пробрасывается наружу', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = safeDebouncedCallback(
      () => {
        throw new Error('deb boom');
      },
      (fn) => fn()
    );
    expect(() => wrapped()).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('[safeDebouncedCallback]'))).toBe(
      true
    );
  });
});
