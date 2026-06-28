/**
 * Unit tests: state-операции behavior (enableWhen/disableWhen) и in-form роутинг валидации
 * (validateFormModel) — через реестр сигнал→нода (M1, Ф5/Ф4-хвост).
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../src/core/utils/create-form';
import { createModel, enableWhen, disableWhen, validateFormModel } from '../../../src/core/model';
import type { ModelValidator } from '../../../src/core/model';

const InputStub = () => null;
// микротаск-флаш (enableWhen пишет состояние через runOutsideEffect = queueMicrotask)
const tick = () => new Promise((r) => setTimeout(r, 0));

const required: ModelValidator<unknown> = (v) =>
  v === '' || v == null ? { code: 'required', message: 'Обязательно' } : null;

interface LoanForm {
  loanType: 'consumer' | 'mortgage';
  propertyValue: number;
}

const buildLoan = () => {
  const model = createModel<LoanForm>({ loanType: 'consumer', propertyValue: 0 });
  const schema = {
    children: [
      { value: model.$.loanType, component: InputStub },
      { value: model.$.propertyValue, component: InputStub },
    ],
  };
  const form = createForm<LoanForm>({ model, schema });
  return { model, form };
};

describe('enableWhen / disableWhen (signals + registry)', () => {
  it('enableWhen включает/выключает поле по условию над моделью', async () => {
    const { model, form } = buildLoan();
    enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage');
    await tick();
    expect(form.propertyValue.disabled.value).toBe(true); // consumer → disabled

    model.loanType = 'mortgage';
    await tick();
    expect(form.propertyValue.disabled.value).toBe(false); // mortgage → enabled
  });

  it('resetOnDisable сбрасывает значение при выключении', async () => {
    const { model, form } = buildLoan();
    model.loanType = 'mortgage';
    enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', {
      resetOnDisable: true,
    });
    await tick();
    form.propertyValue.setValue(5_000_000);
    expect(model.propertyValue).toBe(5_000_000);

    model.loanType = 'consumer'; // → disable + reset
    await tick();
    expect(form.propertyValue.disabled.value).toBe(true);
    expect(model.propertyValue).toBe(0); // сброшено к initial
  });

  it('disableWhen — инверсия', async () => {
    const { model, form } = buildLoan();
    disableWhen(model.$.propertyValue, () => model.loanType === 'consumer');
    await tick();
    expect(form.propertyValue.disabled.value).toBe(true);
    model.loanType = 'mortgage';
    await tick();
    expect(form.propertyValue.disabled.value).toBe(false);
  });
});

describe('validateFormModel (in-form роутинг ошибок)', () => {
  it('роутит ошибки в ноды и очищает при исправлении', async () => {
    const model = createModel<{ email: string }>({ email: '' });
    const schema = {
      children: [{ value: model.$.email, component: InputStub, validators: [required] }],
    };
    const form = createForm<{ email: string }>({ model, schema });

    let res = await validateFormModel(model, schema);
    expect(res.valid).toBe(false);
    expect(form.email.invalid.value).toBe(true);
    expect(form.email.errors.value.length).toBeGreaterThan(0);

    model.email = 'a@b.c';
    res = await validateFormModel(model, schema);
    expect(res.valid).toBe(true);
    expect(form.email.invalid.value).toBe(false);
    expect(form.email.errors.value.length).toBe(0);
  });
});
