/**
 * Unit-тесты планировщика отложенных записей safe-effect.
 *
 * Покрывают:
 * - F7  — маршрутизация ошибок: синхронный throw и async-rejection уходят в dev-лог,
 *          а не всплывают неперехваченными / не тонут как unhandledRejection; изоляция соседних записей.
 * - F7  — liveness: runOutsideEffect возвращает отменитель ещё не выполненной записи.
 * - F10 — safeCallback/safeDebouncedCallback: форвардинг аргументов, отсутствие двойного defer.
 * - deferredWritesSettled — ожидание отложенных записей тика вместе с порождёнными ими.
 * - runAssemblyWrites — записи, отложенные сборкой, выполняются до её возврата.
 *
 * NB: записи НЕ оборачиваются в batch() (см. заметку в safe-effect.ts) — реципрокные guard'ы слоя
 * данных (syncFields) полагаются на синхронный встречный флаш во время записи; поэтому тут проверяется
 * отсутствие batch-семантики (записи применяются по отдельности).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { tick } from '../../test-utils/async';
import {
  deferredWrites,
  deferredWritesSettled,
  runAssemblyWrites,
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

describe('deferredWritesSettled', () => {
  it('отложенных записей нет — ждать нечего', () => {
    expect(deferredWritesSettled()).toBeUndefined();
  });

  it('дожидается записи, поставленной до вызова', async () => {
    const log: string[] = [];
    runOutsideEffect(() => void log.push('запись'));

    await deferredWritesSettled();

    expect(log).toEqual(['запись']);
    expect(deferredWritesSettled()).toBeUndefined();
  });

  it('дожидается цепочки: запись ставит следующую, та — ещё одну', async () => {
    const log: string[] = [];
    runOutsideEffect(() => {
      log.push('первая');
      runOutsideEffect(() => {
        log.push('вторая');
        runOutsideEffect(() => void log.push('третья'));
      });
    });

    await deferredWritesSettled();

    expect(log).toEqual(['первая', 'вторая', 'третья']);
  });

  it('отменённая запись ожидание не держит', async () => {
    const job = vi.fn();
    const cancel = runOutsideEffect(job);
    const writes = deferredWrites();
    writes.schedule(job);
    cancel();
    writes.cancelAll();

    await deferredWritesSettled();

    expect(job).not.toHaveBeenCalled();
    expect(deferredWritesSettled()).toBeUndefined();
  });

  it('запись после await в async-задании в ожидание не входит — это уже не тот же тик', async () => {
    const log: string[] = [];
    runOutsideEffect(async () => {
      await tick();
      log.push('после запроса');
    });

    await deferredWritesSettled();
    const atSettle = [...log];
    await tick(5);

    expect({ atSettle, later: log }).toEqual({ atSettle: [], later: ['после запроса'] });
  });
});

describe('runAssemblyWrites', () => {
  it('записи, отложенные сборкой, выполнены до возврата — вместе с порождёнными ими', () => {
    const order: string[] = [];
    const result = runAssemblyWrites(() => {
      runOutsideEffect(() => {
        order.push('first');
        runOutsideEffect(() => void order.push('chained'));
      });
      order.push('build');
      return 'form';
    });
    expect(result).toBe('form');
    expect(order).toEqual(['build', 'first', 'chained']);
    expect(deferredWritesSettled()).toBeUndefined();
  });

  it('отменённая запись сборки не выполняется', () => {
    const ran = vi.fn();
    runAssemblyWrites(() => {
      const cancel = runOutsideEffect(ran);
      cancel();
    });
    expect(ran).not.toHaveBeenCalled();
  });

  it('после сборки записи снова откладываются на микротаск', async () => {
    runAssemblyWrites(() => undefined);
    let ran = false;
    runOutsideEffect(() => void (ran = true));
    expect(ran).toBe(false);
    await tick();
    expect(ran).toBe(true);
  });

  it('вложенная сборка свои записи не выполняет — это делает внешняя', () => {
    const order: string[] = [];
    runAssemblyWrites(() => {
      runAssemblyWrites(() => void runOutsideEffect(() => void order.push('inner')));
      order.push('after inner');
    });
    expect(order).toEqual(['after inner', 'inner']);
  });

  it('сборка упала — её записи идут на микротаск, а отменитель продолжает действовать', async () => {
    const kept = vi.fn();
    const dropped = vi.fn();
    let cancel = (): void => undefined;
    expect(() =>
      runAssemblyWrites(() => {
        runOutsideEffect(kept);
        cancel = runOutsideEffect(dropped);
        throw new Error('сбой сборки');
      })
    ).toThrow('сбой сборки');
    expect(kept).not.toHaveBeenCalled();

    cancel();
    await tick();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });

  it('бесконечная цепочка записей сборку не подвешивает — остаток уходит на микротаски', async () => {
    let runs = 0;
    let stop = false;
    const loop = (): void => {
      runs++;
      if (!stop) runOutsideEffect(loop);
    };
    runAssemblyWrites(() => void runOutsideEffect(loop));
    expect(runs).toBe(1000);

    stop = true;
    await deferredWritesSettled();
    expect(runs).toBe(1001);
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
