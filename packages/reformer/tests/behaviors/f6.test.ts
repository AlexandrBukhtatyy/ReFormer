/**
 * F6 — per-row операции с НОДОЙ строки в applyEach (на материализованном массиве).
 * Проверяем: enableWhen (через реестр сигнал→нода) и form.x.updateComponentProps (через rowForm).
 */

import { describe, it, expect } from 'vitest';
import { createModel, type FormModel } from '../../src/core/model';
import { createForm } from '../../src/core/utils/create-form';
import { defineFormBehavior, enableWhen, onChange, applyEach } from '../../src/behaviors';
import type { FormProxy } from '../../src/core/types';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

interface Item {
  qty: number;
  discount: number;
  unit: string;
}
interface F {
  items: Item[];
}

// Схема с МАТЕРИАЛИЗОВАННЫМ массивом: { array: model.items, item: (im) => <schema строки> }
const buildSchema = (model: FormModel<F>) => ({
  children: [
    {
      array: model.items,
      item: (im: FormModel<Item>) => ({
        children: [{ value: im.$.qty }, { value: im.$.discount }, { value: im.$.unit }],
      }),
    },
  ],
});

// доступ к ноде строки без полной типизации прокси массива
interface RowNode {
  discount: { disabled: { value: boolean } };
  unit: { componentProps: { value: Record<string, unknown> } };
}
const row = (form: FormProxy<F>, i: number) =>
  (form.items as unknown as { at(i: number): RowNode }).at(i);

describe('F6 · per-row node operations (materialized array)', () => {
  it('enableWhen на поле строки (через реестр сигнал→нода)', async () => {
    const model = createModel<F>({ items: [] });
    const rowBehavior = defineFormBehavior<Item>(({ model: r }) => {
      enableWhen(r.$.discount, () => r.qty > 10); // скидка активна только при qty > 10
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(m.$.items, rowBehavior);
    });
    const form = createForm<F>({ model, schema: buildSchema(model), behavior }) as FormProxy<F>;

    model.items.push({ qty: 5, discount: 0, unit: 'pcs' });
    await tick();
    expect(row(form, 0).discount.disabled.value).toBe(true); // qty 5 ≤ 10

    model.items.at(0).qty = 20;
    await tick();
    expect(row(form, 0).discount.disabled.value).toBe(false); // qty 20 > 10
  });

  it('form.x.updateComponentProps на ноде строки (через rowForm)', async () => {
    const model = createModel<F>({ items: [] });
    const rowBehavior = defineFormBehavior<Item>(({ model: r, form: rowForm }) => {
      onChange(r.$.qty, (q) => {
        (
          rowForm as unknown as { unit: { updateComponentProps(p: Record<string, unknown>): void } }
        ).unit.updateComponentProps({ suffix: q > 1 ? 'units' : 'unit' });
      });
    });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(m.$.items, rowBehavior);
    });
    const form = createForm<F>({ model, schema: buildSchema(model), behavior }) as FormProxy<F>;

    model.items.push({ qty: 1, discount: 0, unit: 'pcs' });
    await tick();
    model.items.at(0).qty = 5;
    await tick();
    expect(row(form, 0).unit.componentProps.value.suffix).toBe('units');
  });

  it('немат­ериализованный массив: node-операция бросает понятную ошибку', () => {
    interface G {
      items: { x: number }[];
    }
    const model = createModel<G>({ items: [] });
    const rowBehavior = defineFormBehavior<{ x: number }>(({ form: rowForm }) => {
      (
        rowForm as unknown as { x: { updateComponentProps(p: Record<string, unknown>): void } }
      ).x.updateComponentProps({ disabled: true }); // node-op на строке
    });
    const behavior = defineFormBehavior<G>(({ model: m }) => {
      applyEach(m.$.items, rowBehavior);
    });
    createForm<G>({ model, behavior }); // БЕЗ schema → массив не материализован
    expect(() => model.items.push({ x: 1 })).toThrowError(/не материализован/);
  });
});
