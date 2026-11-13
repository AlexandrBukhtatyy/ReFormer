/**
 * Живая фаза шагов потока — `validation.liveAfterStep` (ReFormer-8n96).
 *
 * Шаг молчит до первой попытки «Далее» на нём (`flow.next()`), дальше его правила проверяются в
 * выбранном режиме — пока поток стоит на нём. Здесь — составной контроллер сборки: какие правила
 * гоняет живая проверка шага, что живой только текущий шаг и возврат на шаг его перепроверяет
 * (ReFormer-jy7s), когда она снимается (отправка `afterFirstSubmit`, сброс формы, снятие сборки),
 * режим `blur`, `validating` и стратегии, при которых опция не действует.
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

  it('живой только текущий шаг: на следующем шаге правила пройденного не гоняются', async () => {
    const { model, flow, loanRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    model.amount = '5';
    expect(await flow!.next()).toMatchObject({ status: 'moved', to: 'contacts' });
    loanRuns.mockClear();

    model.amount = '';
    await tick();

    expect(loanRuns).not.toHaveBeenCalled();
  });

  it('возврат на шаг: один прогон его правил без касания, дальше шаг снова живой', async () => {
    const { form, model, flow, validating, loanRuns, contactRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    model.amount = '5';
    await flow!.next();
    model.amount = ''; // правка поведением, пока поток на другом шаге
    await tick();
    loanRuns.mockClear();

    flow!.previous();
    expect(validating.value).toBe(true);
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1);
    expect(validating.value).toBe(false);
    expect(issueCodes(form.amount)).toEqual(['amount.required']);
    loanRuns.mockClear();

    model.amount = '7';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1);
    expect(contactRuns).not.toHaveBeenCalled();
    expect(form.amount.issues.value).toEqual([]);
  });

  it('у двух живых шагов правка гоняет правила только того, где стоит поток', async () => {
    const { model, flow, loanRuns, contactRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    model.amount = '5';
    await flow!.next();
    expect(await flow!.next()).toMatchObject({ status: 'stayed', reason: 'invalid' });

    flow!.previous();
    await tick();
    loanRuns.mockClear();
    contactRuns.mockClear();
    model.amount = '9';
    await tick();
    expect(loanRuns).toHaveBeenCalledTimes(1);
    expect(contactRuns).not.toHaveBeenCalled();

    await flow!.next();
    await tick();
    loanRuns.mockClear();
    contactRuns.mockClear();
    model.email = 'a@b.c';
    await tick();
    expect(contactRuns).toHaveBeenCalledTimes(1);
    expect(loanRuns).not.toHaveBeenCalled();
  });

  it('исключение правила в перепроверке при возврате — в консоль, validating опускается', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { model, flow, validating, loanRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    model.amount = '5';
    await flow!.next();
    loanRuns.mockImplementation(() => {
      throw new Error('boom');
    });

    flow!.previous();
    await tick();

    expect(error).toHaveBeenCalledWith(
      '[@reformer/core] живой прогон шага завершился исключением',
      expect.any(Error)
    );
    expect(validating.value).toBe(false);
    error.mockRestore();
  });

  it('validate и isValidating составного контроллера — полный прогон формы', async () => {
    const { validation, loanRuns, contactRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    const { controller } = validation!;

    const pending = controller.validate();
    expect(controller.isValidating).toBe(true);
    expect(await pending).toBe(false);

    expect(controller.isValidating).toBe(false);
    expect(loanRuns).toHaveBeenCalledTimes(1);
    expect(contactRuns).toHaveBeenCalledTimes(1);
  });

  it('повторное армирование (remount) оживляет текущий шаг без лишнего прогона', async () => {
    const { model, flow, validation, loanRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    await flow!.next(); // отказ: шаг остаётся, его живая фаза включена
    validation!.controller.dispose();
    validation!.controller.start();
    loanRuns.mockClear();
    await tick();
    expect(loanRuns).not.toHaveBeenCalled();

    model.amount = 'x';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1);
  });

  it('повторный start без снятия — одна подписка: правка гоняет правила шага один раз', async () => {
    const { model, flow, validation, loanRuns } = setup({
      strategy: 'afterFirstSubmit',
      liveAfterStep: 'change',
    });
    await flow!.next();
    validation!.controller.start();
    loanRuns.mockClear();

    model.amount = 'x';
    await tick();

    expect(loanRuns).toHaveBeenCalledTimes(1);
  });

  it('debounce: живой прогон шага — после паузы, один на серию правок', async () => {
    vi.useFakeTimers();
    try {
      const { model, flow, loanRuns } = setup({
        strategy: 'afterFirstSubmit',
        liveAfterStep: 'change',
        debounce: 300,
      });
      await flow!.next();
      loanRuns.mockClear();

      model.amount = '1';
      model.amount = '12';
      await vi.advanceTimersByTimeAsync(299);
      expect(loanRuns).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(loanRuns).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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
