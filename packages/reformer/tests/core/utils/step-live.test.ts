/**
 * Живая фаза шагов потока — `validation.liveAfterStep` (ReFormer-8n96).
 *
 * Шаг молчит до первой попытки «Далее» на нём (`flow.next()`), дальше его правила проверяются в
 * выбранном режиме. Здесь — составной контроллер сборки: какие правила гоняет живая проверка шага,
 * когда она снимается (отправка `afterFirstSubmit`, сброс формы, снятие сборки), режим `blur`,
 * `validating` и стратегии, при которых опция не действует.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createForm } from '../../../src/form/form-bundle';
import { defineValidation, validate } from '../../../src/form/validation';
import type { FormValidation } from '../../../src/form/form-level';
import type { ValidationIssue } from '../../../src/form/types/index';
import { tick } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';

interface Shape {
  amount: string;
  email: string;
}

const required =
  (code: string) =>
  (value: string): ValidationIssue | null =>
    value ? null : { code };

/** Правила двух шагов со счётчиками исполнения схемы шага. */
function stepRules() {
  const loanRuns = vi.fn();
  const contactRuns = vi.fn();
  const loan = defineValidation<Shape>(({ model }) => {
    loanRuns();
    validate(model.$.amount, [required('amount.required')]);
  });
  const contacts = defineValidation<Shape>(({ model }) => {
    contactRuns();
    validate(model.$.email, [required('email.required')]);
  });
  return { loan, contacts, loanRuns, contactRuns };
}

const bundles: { dispose(): void }[] = [];
afterEach(() => {
  for (const bundle of bundles.splice(0)) bundle.dispose();
});

function setup(validation: Omit<FormValidation<Shape>, 'rules'>) {
  const rules = stepRules();
  const bundle = createForm<Shape>({
    initial: { amount: '', email: '' },
    flow: {
      steps: [
        { id: 'loan', rules: rules.loan },
        { id: 'contacts', rules: rules.contacts },
      ],
    },
    validation,
  });
  bundles.push(bundle);
  bundle.validation!.controller.start();
  return { ...bundle, ...rules };
}

describe('liveAfterStep — живая фаза шага', () => {
  it('до «Далее» шаг молчит; после — правка прогоняет правила только этого шага', async () => {
    const { form, model, flow, loanRuns, contactRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    model.amount = 'x';
    await tick();
    expect(loanRuns).not.toHaveBeenCalled();

    model.amount = '';
    await flow!.next(); // отказ: шаг остаётся
    expect(issueCodes(form.amount)).toEqual(['amount.required']);
    loanRuns.mockClear();

    model.amount = '5';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1);
    expect(contactRuns).not.toHaveBeenCalled();
    expect(form.amount.issues.value).toEqual([]);
  });

  it('afterFirstSubmit: после отправки живая вся форма — правило шага не гоняется дважды', async () => {
    const { model, flow, submission, loanRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    await flow!.next();
    expect((await submission.submit(vi.fn())).status).toBe('invalid');
    loanRuns.mockClear();

    model.amount = '5';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1); // прогон формы; живой шага снят
  });

  it('стратегия submit: шаг остаётся живым и после отправки', async () => {
    const { model, flow, submission, loanRuns, contactRuns } = setup({
      strategy: 'submit',
      liveAfterStep: 'change',
    });
    await flow!.next();
    await submission.submit(vi.fn());
    loanRuns.mockClear();
    contactRuns.mockClear();

    model.amount = '5';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1);
    expect(contactRuns).not.toHaveBeenCalled();
  });

  it('сброс формы возвращает шагу тихую фазу', async () => {
    const { form, model, flow, loanRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    await flow!.next();
    form.reset();
    loanRuns.mockClear();

    model.amount = 'x';
    await tick();

    expect(loanRuns).not.toHaveBeenCalled();
  });

  it('режим blur: ввод без ухода не проверяет, уход из поля — проверяет', async () => {
    const { form, model, flow, loanRuns } = setup({ liveAfterStep: 'blur' });
    await flow!.next();
    loanRuns.mockClear();

    model.amount = '5';
    await tick();
    expect(loanRuns).not.toHaveBeenCalled();

    form.amount.markAsTouched();
    await tick();
    expect(loanRuns).toHaveBeenCalledTimes(1);
  });

  it('снятие сборки снимает и живую проверку шагов', async () => {
    const { model, flow, loanRuns, dispose } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    await flow!.next();
    dispose();
    loanRuns.mockClear();

    model.amount = '5';
    await tick();

    expect(loanRuns).not.toHaveBeenCalled();
  });

  it('стратегия change: форма живая и так — живой прогон шага не добавляется', async () => {
    const { model, flow, loanRuns } = setup({ strategy: 'change', liveAfterStep: 'change' });
    await flow!.next();
    loanRuns.mockClear();

    model.amount = '5';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1); // только прогон формы
  });
});
