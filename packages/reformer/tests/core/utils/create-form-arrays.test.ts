/**
 * Unit tests: массивы под M1 — model-owned + per-item createForm.
 *
 * Массив принадлежит модели (push/removeAt/length реактивны). Форма элемента строится
 * рекурсивно через createForm({ model: model.arr.at(i), schema: itemComponent(item) }),
 * привязываясь к сигналам под-модели элемента (запись доезжает в model.arr[i]).
 * Родительский createForm массив не материализует.
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../src/form/create-form';
import { createModel } from '../../../src/state/index';
import { required } from '../../../src/form/validation/validators/index';
import type { FormModel } from '../../../src/state/index';

const InputStub = () => null;
const BoxStub = () => null;

interface CoBorrower {
  personalData: { lastName: string };
  relationship: string;
  monthlyIncome: number;
}
interface Form {
  loanAmount: number;
  coBorrowers: CoBorrower[];
}

// Схема элемента массива (как itemComponent в RendererFormArraySection).
const itemSchema = (item: FormModel<CoBorrower>) => ({
  component: BoxStub,
  children: [
    { value: item.$.personalData.lastName, component: InputStub },
    { value: item.$.relationship, component: InputStub, validators: [required()] },
    { value: item.$.monthlyIncome, component: InputStub },
  ],
});

describe('Массивы под M1 (model-owned + per-item createForm)', () => {
  it('родительский createForm с массивом строится (массив пропускается, скаляры работают)', () => {
    const model = createModel<Form>({ loanAmount: 0, coBorrowers: [] });
    const form = createForm<Form>({
      model,
      schema: { children: [{ value: model.$.loanAmount, component: InputStub }] },
    });
    form.loanAmount.setValue(500000);
    expect(model.loanAmount).toBe(500000);
    // массив не материализован в родителе
    expect((form as unknown as Record<string, unknown>).coBorrowers).toBeUndefined();
  });

  it('форма элемента массива привязана к под-модели (запись доезжает в модель)', () => {
    const model = createModel<Form>({ loanAmount: 0, coBorrowers: [] });
    model.coBorrowers.push({ personalData: { lastName: '' }, relationship: '', monthlyIncome: 0 });

    const item = model.coBorrowers.at(0)!;
    const itemForm = createForm<CoBorrower>({ model: item, schema: itemSchema(item) });

    itemForm.relationship.setValue('брат');
    itemForm.personalData.lastName.setValue('Петров');
    itemForm.monthlyIncome.setValue(120000);

    expect(model.get().coBorrowers[0]).toEqual({
      personalData: { lastName: 'Петров' },
      relationship: 'брат',
      monthlyIncome: 120000,
    });
  });

  it('сигнал элемента знает полный путь с индексом', () => {
    const model = createModel<Form>({ loanAmount: 0, coBorrowers: [] });
    model.coBorrowers.push({ personalData: { lastName: '' }, relationship: '', monthlyIncome: 0 });
    const item = model.coBorrowers.at(0)!;
    expect(item.$.relationship.__path).toBe('coBorrowers.0.relationship');
    expect((model.coBorrowers as unknown as { __path: string }).__path).toBe('coBorrowers');
  });

  it('removeAt сдвигает индексы; новая под-модель пишет в правильный слот', () => {
    const model = createModel<Form>({ loanAmount: 0, coBorrowers: [] });
    model.coBorrowers.push({ personalData: { lastName: 'A' }, relationship: '', monthlyIncome: 0 });
    model.coBorrowers.push({ personalData: { lastName: 'B' }, relationship: '', monthlyIncome: 0 });
    model.coBorrowers.removeAt(0);

    const item = model.coBorrowers.at(0)!;
    const itemForm = createForm<CoBorrower>({ model: item, schema: itemSchema(item) });
    expect(itemForm.personalData.lastName.value.value).toBe('B');
    itemForm.relationship.setValue('друг');
    expect(model.get().coBorrowers[0].relationship).toBe('друг');
  });

  it('createForm с array-узлом материализует form.<array> как ModelArrayNode', () => {
    const model = createModel<Form>({ loanAmount: 0, coBorrowers: [] });
    const schema = {
      children: [
        { value: model.$.loanAmount, component: InputStub },
        // массив-узел: { array: model.<path>, item: (itemModel) => schema }
        { array: model.coBorrowers, item: (it: FormModel<CoBorrower>) => itemSchema(it) },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<Form>({ model, schema }) as any;

    expect(form.coBorrowers).toBeDefined();
    expect(form.coBorrowers.length.value).toBe(0);

    form.coBorrowers.push({
      personalData: { lastName: 'Иванов' },
      relationship: 'брат',
      monthlyIncome: 100,
    });
    expect(form.coBorrowers.length.value).toBe(1);
    expect(model.get().coBorrowers[0].personalData.lastName).toBe('Иванов');

    const item0 = form.coBorrowers.at(0);
    expect(item0.relationship.value.value).toBe('брат');
    item0.relationship.setValue('сестра');
    expect(model.get().coBorrowers[0].relationship).toBe('сестра');

    form.coBorrowers.removeAt(0);
    expect(form.coBorrowers.length.value).toBe(0);
  });
});
