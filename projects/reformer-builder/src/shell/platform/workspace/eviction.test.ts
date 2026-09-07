/**
 * Тесты политики вытеснения.
 *
 * Проверяется не «функция вернула массив», а четыре правила контракта плюс пятое,
 * без которого он не выполним: открытые закреплены, нужные открытым защищены, изменённые
 * защищены, порядок — по давности, а недостижимый потолок сообщается, а не обходится.
 *
 * @module shell/platform/workspace/eviction.test
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_EVICTION_BUDGET, planEviction, type EvictionEntry } from './eviction';

const entry = (path: string, patch: Partial<EvictionEntry> = {}): EvictionEntry => ({
  path,
  size: 100,
  lastUsedAt: 0,
  dirty: false,
  pinned: false,
  required: false,
  ...patch,
});

const budget = { files: 3, bytes: 10_000 };

describe('planEviction', () => {
  it('в пределах потолка не трогает ничего', () => {
    const plan = planEviction([entry('a'), entry('b')], budget);

    expect(plan.evict).toEqual([]);
    expect(plan.files).toBe(2);
    expect(plan.bytes).toBe(200);
    expect(plan.retainedOverBudget).toBe(false);
  });

  it('выбрасывает по давности использования, начиная с самого старого', () => {
    const plan = planEviction(
      [
        entry('new', { lastUsedAt: 30 }),
        entry('old', { lastUsedAt: 10 }),
        entry('mid', { lastUsedAt: 20 }),
        entry('newest', { lastUsedAt: 40 }),
        entry('ancient', { lastUsedAt: 5 }),
      ],
      budget
    );

    // Двух хватает, чтобы уложиться в потолок из трёх, — и это именно два самых давних.
    expect(plan.evict).toEqual(['ancient', 'old']);
    expect(plan.files).toBe(3);
  });

  it('открытые ресурсы не вытесняются никогда', () => {
    const plan = planEviction(
      [
        entry('opened-1', { pinned: true, lastUsedAt: 1 }),
        entry('opened-2', { pinned: true, lastUsedAt: 2 }),
        entry('cached-1', { lastUsedAt: 3 }),
        entry('cached-2', { lastUsedAt: 4 }),
      ],
      budget
    );

    expect(plan.evict).toEqual(['cached-1']);
  });

  it('зависимость открытого документа защищена, даже если её давно не читали', () => {
    const plan = planEviction(
      [
        entry('schema', { pinned: true, lastUsedAt: 100 }),
        // Сайдкар прочли один раз при открытии и больше не трогали — по давности он первый
        // кандидат, но без него открытая схема не соберётся.
        entry('sidecar', { required: true, lastUsedAt: 1 }),
        entry('stale-1', { lastUsedAt: 2 }),
        entry('stale-2', { lastUsedAt: 3 }),
      ],
      budget
    );

    expect(plan.evict).toEqual(['stale-1']);
    expect(plan.evict).not.toContain('sidecar');
  });

  it('изменённый ресурс не вытесняется: рабочая копия — единственное место правки', () => {
    const plan = planEviction(
      [
        entry('dirty', { dirty: true, lastUsedAt: 1 }),
        entry('clean-1', { lastUsedAt: 2 }),
        entry('clean-2', { lastUsedAt: 3 }),
        entry('clean-3', { lastUsedAt: 4 }),
      ],
      budget
    );

    expect(plan.evict).toEqual(['clean-1']);
  });

  it('считает потолок и по объёму, а не только по числу файлов', () => {
    const plan = planEviction(
      [
        entry('big-old', { size: 6_000, lastUsedAt: 1 }),
        entry('small', { size: 100, lastUsedAt: 2 }),
        entry('big-new', { size: 6_000, lastUsedAt: 3 }),
      ],
      { files: 100, bytes: 10_000 }
    );

    expect(plan.evict).toEqual(['big-old']);
    expect(plan.bytes).toBe(6_100);
  });

  it('сообщает, что потолок недостижим, вместо того чтобы нарушать защиту', () => {
    const plan = planEviction(
      [
        entry('a', { pinned: true }),
        entry('b', { pinned: true }),
        entry('c', { required: true }),
        entry('d', { dirty: true }),
      ],
      budget
    );

    expect(plan.evict).toEqual([]);
    expect(plan.files).toBe(4);
    expect(plan.retainedOverBudget).toBe(true);
  });

  it('умолчание заведомо больше одного замыкания: 200 файлов не вытесняют сами себя', () => {
    const closure = Array.from({ length: 200 }, (_, i) =>
      entry(`dep-${i}`, { size: 8_192, lastUsedAt: i })
    );

    expect(planEviction(closure, DEFAULT_EVICTION_BUDGET).evict).toEqual([]);
  });
});
