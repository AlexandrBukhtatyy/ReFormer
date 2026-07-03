/**
 * Regression: ModelArrayNode форвардит ВСЕ state-hook'и к элементам, а не только touchAll.
 *
 * Баг (до фикса): переопределён был только `onMarkAsTouched`; `markAsUntouched`/`markAsPristine`/
 * `markAsDirty`/`disable`/`enable` были no-op на элементах (базовые сигналы игнорируются, т.к.
 * агрегатное состояние выводится из детей). Тест строит ModelArrayNode через createForm({ array, item })
 * и проверяет, что операции доезжают до per-item форм.
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../src/core/utils/create-form';
import { createModel } from '../../../src/core/model';
import type { FormModel } from '../../../src/core/model';

interface Item {
  name: string;
  qty: number;
}
interface Form {
  rows: Item[];
}

const itemSchema = (it: FormModel<Item>) => ({
  children: [{ value: it.$.name }, { value: it.$.qty }],
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function build(): any {
  const model = createModel<Form>({ rows: [] });
  const schema = {
    children: [{ array: model.rows, item: (it: FormModel<Item>) => itemSchema(it) }],
  };
  const form = createForm<Form>({ model, schema }) as any;
  form.rows.push({ name: 'a', qty: 1 });
  form.rows.push({ name: 'b', qty: 2 });
  return form;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('ModelArrayNode — state hooks форвардятся к элементам', () => {
  it('markAsUntouched доезжает до элементов (был no-op)', () => {
    const form = build();
    expect(form.rows.touched.value).toBe(false);

    form.rows.markAsTouched();
    expect(form.rows.touched.value).toBe(true);

    form.rows.markAsUntouched();
    expect(form.rows.touched.value).toBe(false); // regression guard: раньше оставался true
  });

  it('markAsDirty / markAsPristine доезжают до элементов', () => {
    const form = build();
    expect(form.rows.dirty.value).toBe(false);

    form.rows.markAsDirty();
    expect(form.rows.dirty.value).toBe(true);

    form.rows.markAsPristine();
    expect(form.rows.dirty.value).toBe(false); // regression guard
  });

  it('disable / enable доезжают до полей элементов (были no-op)', () => {
    const form = build();
    const item0 = form.rows.at(0);
    expect(item0.name.disabled.value).toBe(false);

    form.rows.disable();
    expect(item0.name.disabled.value).toBe(true); // regression guard

    form.rows.enable();
    expect(item0.name.disabled.value).toBe(false);
  });
});
