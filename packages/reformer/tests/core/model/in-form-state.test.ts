/**
 * Unit tests: state-операции behavior (enableWhen/disableWhen) через реестр сигнал→нода (M1).
 * (In-form роутинг валидации теперь тестируется в `validate-model-schema.test.ts` — новый контракт.)
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../src/form/create-form';
import { createModel } from '../../../src/state/index';
import { enableWhen, disableWhen } from '../../../src/form/index';

const InputStub = () => null;
// микротаск-флаш (enableWhen пишет состояние через runOutsideEffect = queueMicrotask)
const tick = () => new Promise((r) => setTimeout(r, 0));

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
