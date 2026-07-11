/**
 * F7 — детект расходящихся циклов пересчёта в compute/computeFrom.
 * Проверяем: расходящийся цикл → понятная ошибка; сходящийся и массовые мутации → НЕ ложно.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../src/state/index';
import { createForm } from '../../src/form/create-form';
import { defineFormBehavior, compute, computeFrom } from '../../src/form/behaviors';

describe('F7 · детект расходящихся циклов', () => {
  it('расходящийся взаимный compute → понятная ошибка', () => {
    interface F {
      a: number;
      b: number;
    }
    const model = createModel<F>({ a: 0, b: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.a, () => m.b + 1);
      compute(m.$.b, () => m.a + 1); // a→b→a… без стабилизации
    });
    expect(() => createForm<F>({ model, behavior })).toThrowError(/расходящийся цикл/);
  });

  it('расходящийся computeFrom-цикл → понятная ошибка', () => {
    interface F {
      a: number;
      b: number;
    }
    const model = createModel<F>({ a: 0, b: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      computeFrom([m.$.b], m.$.a, (b) => (b as number) + 1);
      computeFrom([m.$.a], m.$.b, (a) => (a as number) + 1);
    });
    expect(() => createForm<F>({ model, behavior })).toThrowError(/расходящийся цикл/);
  });

  it('сходящийся взаимный compute стабилизируется (НЕ ложное срабатывание)', () => {
    interface F {
      a: number;
      b: number;
    }
    const model = createModel<F>({ a: 1, b: 1 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.a, () => Math.max(m.b, 5));
      compute(m.$.b, () => Math.max(m.a, 3));
    });
    expect(() => createForm<F>({ model, behavior })).not.toThrow();
    expect(model.a).toBe(5);
    expect(model.b).toBe(5);
  });

  it('массовые синхронные мутации не дают ложного цикла', () => {
    interface Row {
      x: number;
    }
    interface F {
      items: Row[];
      total: number;
    }
    const model = createModel<F>({ items: [], total: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.total, () => m.items.map((i) => i.x as number).reduce((a, b) => a + b, 0));
    });
    createForm<F>({ model, behavior });

    for (let i = 0; i < 300; i++) model.items.push({ x: 1 }); // 300 синхронных пересчётов total
    expect(model.total).toBe(300); // без ложного «расходящегося цикла»
  });
});
