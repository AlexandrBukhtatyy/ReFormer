/**
 * Regression: массив под-форм форвардит операции состояния к строкам, а не только markAsTouched.
 *
 * Баг (до фикса): переопределён был только `onMarkAsTouched`; `markAsUntouched`, `disable`,
 * `enable` были no-op на строках (агрегатное состояние выводится из детей). Тест строит массив
 * через createFormFromModel (узел { model, item }) и проверяет, что операции доезжают до строк.
 */

import { describe, it, expect } from 'vitest';
import { createFormFromModel } from '../../../src/form/create-form';
import { createModel } from '../../../src/model/index';
import type { FormModel } from '../../../src/model/index';

interface Item {
  name: string;
  qty: number;
}
interface Form {
  rows: Item[];
}

const itemSchema = (it: FormModel<Item>) => ({
  children: [{ model: it.$.name }, { model: it.$.qty }],
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function build(): any {
  const model = createModel<Form>({ rows: [] });
  const schema = {
    children: [{ model: model.$.rows, item: (it: FormModel<Item>) => itemSchema(it) }],
  };
  const form = createFormFromModel<Form>({ model, schema }) as any;
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

  it('dirty массива — из строк; reset строки делает массив чистым', () => {
    const form = build();
    expect(form.rows.dirty.value).toBe(false);

    form.rows.at(0)?.name.setValue('changed');
    expect(form.rows.dirty.value).toBe(true);

    form.rows.at(0)?.reset();
    expect(form.rows.dirty.value).toBe(false);
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
