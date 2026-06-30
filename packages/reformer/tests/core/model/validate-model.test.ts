/**
 * Unit tests: headless validateModel(model, schema) (M1, Ф4).
 *
 * Контракт валидатора (value, model, root). Покрывает: вложенность, cross-field, условие,
 * массивы (путь с индексом), async, validateModelSync (пропуск async), valid.
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../../src/core/model';
import { validateModel, validateModelSync } from '../../../src/core/model';
import type { ModelValidator } from '../../../src/core/model';

const InputStub = () => null;
const BoxStub = () => null;

const required: ModelValidator<unknown> = (v) =>
  v === '' || v == null ? { code: 'required', message: 'Обязательно' } : null;

interface Form {
  loanType: 'consumer' | 'mortgage';
  propertyValue: number;
  monthlyPayment: number;
  totalIncome: number;
  profile: { lastName: string };
  coBorrowers: { relationship: string; monthlyIncome: number }[];
}

const makeModel = () =>
  createModel<Form>({
    loanType: 'consumer',
    propertyValue: 0,
    monthlyPayment: 0,
    totalIncome: 100000,
    profile: { lastName: '' },
    coBorrowers: [],
  });

// Схема (как единая merged-schema): контейнеры + field-узлы (value=сигнал) + массив-секция.
const makeSchema = (model: ReturnType<typeof makeModel>) => ({
  component: BoxStub,
  children: [
    { value: model.$.profile.lastName, component: InputStub, validators: [required] },
    // условный валидатор: propertyValue обязателен только для ипотеки (читает модель)
    {
      value: model.$.propertyValue,
      component: InputStub,
      validators: [
        ((v, m) =>
          m.loanType === 'mortgage' && !v
            ? { code: 'required', message: 'Укажите стоимость' }
            : null) as ModelValidator<number, Form>,
      ],
    },
    // cross-field: платёж не больше дохода (читает root)
    {
      value: model.$.monthlyPayment,
      component: InputStub,
      validators: [
        ((v, _m, root) =>
          v > root.totalIncome
            ? { code: 'tooHigh', message: 'Платёж выше дохода' }
            : null) as ModelValidator<number, Form, Form>,
      ],
    },
    // массив созаёмщиков
    {
      component: BoxStub,
      componentProps: {
        control: model.coBorrowers,
        itemComponent: (item: {
          $: { relationship: import('@preact/signals-core').Signal<string> };
        }) => ({
          component: BoxStub,
          children: [{ value: item.$.relationship, component: InputStub, validators: [required] }],
        }),
      },
    },
  ],
});

describe('validateModel (headless, M1)', () => {
  it('собирает ошибки по путям (вложенность)', async () => {
    const model = makeModel();
    const res = await validateModel(model, makeSchema(model));
    expect(res.valid).toBe(false);
    expect(res.errors['profile.lastName']?.[0]?.code).toBe('required');
  });

  it('valid=true когда всё заполнено', async () => {
    const model = makeModel();
    model.profile.lastName = 'Иванов';
    const res = await validateModel(model, makeSchema(model));
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual({});
  });

  it('условный валидатор читает модель', async () => {
    const model = makeModel();
    model.profile.lastName = 'Иванов';
    // consumer → propertyValue не обязателен
    let res = await validateModel(model, makeSchema(model));
    expect(res.errors['propertyValue']).toBeUndefined();
    // mortgage → обязателен
    model.loanType = 'mortgage';
    res = await validateModel(model, makeSchema(model));
    expect(res.errors['propertyValue']?.[0]?.code).toBe('required');
  });

  it('cross-field читает root', async () => {
    const model = makeModel();
    model.profile.lastName = 'Иванов';
    model.monthlyPayment = 200000; // > totalIncome 100000
    const res = await validateModel(model, makeSchema(model));
    expect(res.errors['monthlyPayment']?.[0]?.code).toBe('tooHigh');
  });

  it('валидирует элементы массива (путь с индексом)', async () => {
    const model = makeModel();
    model.profile.lastName = 'Иванов';
    model.coBorrowers.push({ relationship: '', monthlyIncome: 0 });
    model.coBorrowers.push({ relationship: 'брат', monthlyIncome: 0 });
    const res = await validateModel(model, makeSchema(model));
    expect(res.errors['coBorrowers.0.relationship']?.[0]?.code).toBe('required');
    expect(res.errors['coBorrowers.1.relationship']).toBeUndefined();
  });

  it('async-валидатор', async () => {
    const model = createModel<{ login: string }>({ login: 'taken' });
    const asyncTaken: ModelValidator<string> = async (v) => {
      await new Promise((r) => setTimeout(r, 5));
      return v === 'taken' ? { code: 'taken', message: 'Занято' } : null;
    };
    const schema = {
      children: [{ value: model.$.login, component: InputStub, validators: [asyncTaken] }],
    };
    const res = await validateModel(model, schema);
    expect(res.errors['login']?.[0]?.code).toBe('taken');
  });

  it('validateModelSync пропускает async, ловит sync', () => {
    const model = makeModel();
    const res = validateModelSync(model, makeSchema(model));
    expect(res.valid).toBe(false);
    expect(res.errors['profile.lastName']?.[0]?.code).toBe('required');
  });
});

describe('validateModel — узел-ветка { when, children }', () => {
  interface BForm {
    kind: 'a' | 'b';
    aField: string;
    bField: string;
  }
  const makeB = (kind: 'a' | 'b' = 'a') => createModel<BForm>({ kind, aField: '', bField: '' });

  const bSchema = (model: ReturnType<typeof makeB>) => ({
    children: [
      {
        when: (_scope: unknown, root: BForm) => root.kind === 'a',
        children: [{ value: model.$.aField, component: InputStub, validators: [required] }],
      },
      {
        when: (_scope: unknown, root: BForm) => root.kind === 'b',
        children: [{ value: model.$.bField, component: InputStub, validators: [required] }],
      },
    ],
  });

  it('активная ветка валидируется, выключенная — пропускается', async () => {
    const model = makeB('a');
    const res = await validateModel(model, bSchema(model));
    expect(res.errors['aField']?.[0]?.code).toBe('required');
    expect(res.errors['bField']).toBeUndefined();
  });

  it('переключение условия меняет активную ветку', async () => {
    const model = makeB('b');
    const res = await validateModel(model, bSchema(model));
    expect(res.errors['aField']).toBeUndefined();
    expect(res.errors['bField']?.[0]?.code).toBe('required');
  });

  it('validateModelSync понимает узел-ветку', () => {
    const model = makeB('a');
    const res = validateModelSync(model, bSchema(model));
    expect(res.errors['aField']?.[0]?.code).toBe('required');
    expect(res.errors['bField']).toBeUndefined();
  });

  it('предикат branch читает scope элемента массива (per-item)', async () => {
    interface IForm {
      items: { flag: boolean; note: string }[];
    }
    const model = createModel<IForm>({
      items: [
        { flag: true, note: '' },
        { flag: false, note: '' },
      ],
    });
    const schema = {
      children: [
        {
          component: BoxStub,
          componentProps: {
            control: model.items,
            itemComponent: (item: {
              flag: boolean;
              $: { note: import('@preact/signals-core').Signal<string> };
            }) => ({
              children: [
                {
                  when: (scope: { flag: boolean }) => scope.flag,
                  children: [{ value: item.$.note, component: InputStub, validators: [required] }],
                },
              ],
            }),
          },
        },
      ],
    };
    const res = await validateModel(model, schema);
    expect(res.errors['items.0.note']?.[0]?.code).toBe('required'); // flag=true → валидируется
    expect(res.errors['items.1.note']).toBeUndefined(); // flag=false → ветка выключена
  });
});
