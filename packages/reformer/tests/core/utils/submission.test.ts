/**
 * Отправка формы — `createSubmission` и `bundle.submission` сборки `createForm`.
 *
 * Сначала объект отправки сам по себе, на подделках зависимостей: итог по статусу проверки,
 * отмена устаревших значений, какие значения получает обработчик, сигнал `submitting`. Затем —
 * отправка через сборку: один прогон всех правил, касание полей при отказе, две отправки подряд
 * (`cancelled`), снимок значений, отмена, если модель изменилась, пока шла проверка, и отложенные
 * записи поведения того же тика.
 */

import { describe, it, expect, vi } from 'vitest';
import { deferred, tick, type Deferred } from '../../test-utils/async';
import { issueCodes } from '../../test-utils/issues';
import { createForm } from '../../../src/form/form-bundle';
import {
  compute,
  computeFrom,
  defineFormBehavior,
  enableWhen,
  onChange,
} from '../../../src/form/behaviors';
import { defineValidation, validate, validateAsync } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import type { ValidationIssue } from '../../../src/form/types/contracts';
import type { ValidationResult, ValidationStatus } from '../../../src/form/validation';
import {
  createSubmission,
  type ActionCheck,
  type SubmitResult,
} from '../../../src/form/submission';
import {
  contactsRules,
  controlledAmountRules,
  createShape,
  type Shape,
} from './shape-form.fixture';

// ─── Объект отправки на подделках зависимостей ───────────────────────────────────────────────

const sample: Shape = { amount: '1', phone: '+7' };

const resultWith = (status: ValidationStatus): ValidationResult => ({
  status,
  issues: new Map(),
  failures: [],
});

const passed = resultWith('valid');

/** Проверка, которая сразу отвечает заданным итогом. */
const checkWith = (result: ValidationResult, values: Shape, stale = false) =>
  vi.fn(async (): Promise<ActionCheck<Shape>> => ({ result, values, stale }));

describe('createSubmission — на подделках зависимостей', () => {
  it.each(['invalid', 'error', 'cancelled'] as const)(
    'проверка %s — обработчик не вызывается, итог несёт результат проверки',
    async (status) => {
      const result = resultWith(status);
      const handler = vi.fn();
      const submission = createSubmission<Shape>({
        check: checkWith(result, sample),
        values: () => sample,
      });

      expect(await submission.submit(handler)).toEqual({ status, validation: result });
      expect(handler).not.toHaveBeenCalled();
    }
  );

  it('проверка прошла, но значения устарели — cancelled, обработчик не вызывается', async () => {
    const handler = vi.fn();
    const submission = createSubmission<Shape>({
      check: checkWith(passed, sample, true),
      values: () => sample,
    });

    expect(await submission.submit(handler)).toEqual({
      status: 'cancelled',
      validation: { ...passed, status: 'cancelled' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('обработчик получает значения проверки, а не values()', async () => {
    const checked: Shape = { amount: '1', phone: '+7' };
    const values = vi.fn((): Shape => ({ amount: 'другое', phone: '' }));
    const submission = createSubmission<Shape>({ check: checkWith(passed, checked), values });

    expect(await submission.submit((received) => received)).toEqual({
      status: 'submitted',
      result: checked,
    });
    expect(values).not.toHaveBeenCalled();
  });

  it('без проверки — values() после правки в том же тике, что и вызов', async () => {
    let current: Shape = { amount: '1', phone: '' };
    const submission = createSubmission<Shape>({ check: undefined, values: () => current });

    const sending = submission.submit((received) => received.amount);
    current = { amount: '2', phone: '' };

    expect(await sending).toEqual({ status: 'submitted', result: '2' });
  });

  it('submitting: false во время проверки, true во время обработчика, сброшен после исключения', async () => {
    const checking = deferred<ActionCheck<Shape>>();
    const submission = createSubmission<Shape>({
      check: () => checking.promise,
      values: () => sample,
    });
    const error = new Error('500');
    let during: boolean | undefined;

    const sending = submission.submit(() => {
      during = submission.submitting.value;
      throw error;
    });
    expect(submission.submitting.value).toBe(false);
    checking.resolve({ result: passed, values: sample, stale: false });

    expect(await sending).toEqual({ status: 'failed', error });
    expect(during).toBe(true);
    expect(submission.submitting.value).toBe(false);
  });

  it('две отправки подряд — submitting держится, пока работает хотя бы один обработчик', async () => {
    const submission = createSubmission<Shape>({ check: undefined, values: () => sample });
    const first = deferred<void>();
    const second = deferred<void>();

    const firstSending = submission.submit(() => first.promise);
    const secondSending = submission.submit(() => second.promise);
    await tick();
    expect(submission.submitting.value).toBe(true);

    first.resolve();
    await firstSending;
    expect(submission.submitting.value).toBe(true);

    second.resolve();
    await secondSending;
    expect(submission.submitting.value).toBe(false);
  });
});

// ─── Отправка через сборку ───────────────────────────────────────────────────────────────────

describe('bundle.submission — submit', () => {
  it('submitted: обработчик получает значения модели, результат — его ответ', async () => {
    const bundle = createShape({ amount: '100', phone: '+7' });
    const handler = vi.fn(async (values: Shape) => `заявка ${values.amount}`);

    const result = await bundle.submission.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: 'заявка 100' });
    expect(handler).toHaveBeenCalledWith({ amount: '100', phone: '+7' });
  });

  it('invalid: обработчик не вызывается, поля помечены тронутыми', async () => {
    const bundle = createShape();
    const handler = vi.fn();

    const result = await bundle.submission.submit(handler);

    expect(result).toMatchObject({ status: 'invalid', validation: { status: 'invalid' } });
    expect(handler).not.toHaveBeenCalled();
    expect(bundle.form.amount.touched.value).toBe(true);
    expect(bundle.form.amount.shouldShowError.value).toBe(true);
  });

  it('error: правило не вернуло результат — обработчик не вызывается', async () => {
    const failing = defineValidation<Shape>(({ model }) => {
      validateAsync(model.$.amount, [() => Promise.reject(new Error('сеть'))]);
    });
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: failing });
    const handler = vi.fn();

    expect((await bundle.submission.submit(handler)).status).toBe('error');
    expect(handler).not.toHaveBeenCalled();
  });

  it('failed: исключение обработчика — в результате, а не наружу', async () => {
    const bundle = createShape({ amount: '1', phone: '1' });
    const error = new Error('500');

    expect(
      await bundle.submission.submit(() => {
        throw error;
      })
    ).toEqual({ status: 'failed', error });
    expect(bundle.submission.submitting.value).toBe(false);
  });

  it('ровно один прогон правил на отправку', async () => {
    const rule = vi.fn(() => null);
    const counted = defineValidation<Shape>(({ model }) => {
      validate(model.$.amount, [rule]);
    });
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: counted });

    await bundle.submission.submit(() => 'ok');

    expect(rule).toHaveBeenCalledTimes(1);
  });

  it('submitting — пока работает обработчик', async () => {
    const bundle = createShape({ amount: '1', phone: '1' });
    let during = false;

    await bundle.submission.submit(() => {
      during = bundle.submission.submitting.value;
    });

    expect(during).toBe(true);
    expect(bundle.submission.submitting.value).toBe(false);
  });
});

describe('bundle.submission — submit: статусы и значения', () => {
  it('cancelled: две отправки подряд — первая отменена второй, обработчик вызван один раз', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '' }, validation: rules });
    const handler = vi.fn(() => 'ok');

    const first = bundle.submission.submit(handler);
    const second = bundle.submission.submit(handler);
    answers[1].resolve(null);

    expect(await first).toMatchObject({ status: 'cancelled', validation: { status: 'cancelled' } });
    expect(await second).toEqual({ status: 'submitted', result: 'ok' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each<[SubmitResult<string>['status'], () => Promise<SubmitResult<string>>]>([
    ['submitted', () => createShape({ amount: '1', phone: '1' }).submission.submit(() => 'ok')],
    ['invalid', () => createShape().submission.submit(() => 'ok')],
    [
      'error',
      () =>
        createForm<Shape>({
          initial: { amount: '1', phone: '' },
          validation: defineValidation<Shape>(({ model }) => {
            validateAsync(model.$.amount, [() => Promise.reject(new Error('сеть'))]);
          }),
        }).submission.submit(() => 'ok'),
    ],
    [
      'cancelled',
      async () => {
        const { answers, rules } = controlledAmountRules();
        const bundle = createForm<Shape>({
          initial: { amount: '1', phone: '' },
          validation: rules,
        });
        const first = bundle.submission.submit(() => 'ok');
        void bundle.submission.submit(() => 'ok');
        answers[1].resolve(null);
        return first;
      },
    ],
    [
      'failed',
      () =>
        createShape({ amount: '1', phone: '1' }).submission.submit(() => {
          throw new Error('500');
        }),
    ],
  ])('статус %s', async (status, send) => {
    expect((await send()).status).toBe(status);
  });

  it('обработчик получает снимок model.get(): правка модели в обработчике снимок не меняет', async () => {
    const bundle = createShape({ amount: '100', phone: '+7' });
    let received: Shape | undefined;

    await bundle.submission.submit((values) => {
      received = values;
      bundle.model.amount = '200';
    });

    expect(received).toEqual({ amount: '100', phone: '+7' });
    expect(Object.getPrototypeOf(received)).toBe(Object.prototype);
    expect(bundle.model.amount).toBe('200');
  });

  it('значения выключенного поля в снимке есть: его правила не считаются, но данные — модели', async () => {
    const bundle = createForm<Shape>({
      initial: { amount: '', phone: '+7' },
      behavior: defineFormBehavior<Shape>(({ model }) => {
        enableWhen(model.$.phone, () => model.amount !== '');
      }),
      validation: contactsRules,
    });
    await tick();
    const handler = vi.fn((values: Shape) => values.phone);

    expect(bundle.form.phone.disabled.value).toBe(true);
    expect(await bundle.submission.submit(handler)).toEqual({ status: 'submitted', result: '+7' });
    expect(handler).toHaveBeenCalledWith(bundle.model.get());
  });

  it('ровно один прогон правил на отправку: правила шагов и extras — по разу', async () => {
    const loanRule = vi.fn(() => null);
    const contactsRule = vi.fn(() => null);
    const extrasRule = vi.fn(() => null);
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      flow: {
        steps: [
          {
            id: 'loan',
            rules: defineValidation<Shape>(({ model }) => validate(model.$.amount, [loanRule])),
          },
          {
            id: 'contacts',
            rules: defineValidation<Shape>(({ model }) => validate(model.$.phone, [contactsRule])),
          },
        ],
      },
      validation: {
        extras: defineValidation<Shape>(({ model }) => validate(model.$.amount, [extrasRule])),
      },
    });

    expect((await bundle.submission.submit(() => 'ok')).status).toBe('submitted');
    expect(loanRule).toHaveBeenCalledTimes(1);
    expect(contactsRule).toHaveBeenCalledTimes(1);
    expect(extrasRule).toHaveBeenCalledTimes(1);
  });

  it('стратегия blur: отправка — ровно один прогон правил [ReFormer-lzhc]', async () => {
    const loginFree = vi.fn(async () => null);
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '1' },
      validation: {
        rules: defineValidation<Shape>(({ model }) => validateAsync(model.$.amount, [loginFree])),
        strategy: 'blur',
      },
    });
    const stop = bundle.validation!.controller.start();
    try {
      await bundle.submission.submit(() => 'ok');
      await tick();

      // Было 2: касание полей самой отправкой (`touch: true`) будило живой прогон blur.
      expect(loginFree).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
  });
});

describe('bundle.submission — submit: модель изменилась, пока шла проверка', () => {
  /** Отправка, которая ждёт ответа async-правила суммы. */
  function pendingSubmit(initial: Shape = { amount: '1', phone: '+7' }) {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({ initial, validation: rules });
    const handler = vi.fn((values: Shape) => values.phone);
    return { answers, bundle, handler, sending: bundle.submission.submit(handler) };
  }

  it('правка во время async-правила: cancelled, обработчик не вызван [ReFormer-xt4x]', async () => {
    const { answers, bundle, handler, sending } = pendingSubmit();

    bundle.form.phone.setValue('+7 900');
    answers[0].resolve(null);

    // Было: submitted — обработчик получал телефон, которого правила не видели.
    expect(await sending).toMatchObject({
      status: 'cancelled',
      validation: { status: 'cancelled', failures: [] },
    });
    expect(handler).not.toHaveBeenCalled();
    expect(bundle.submission.submitting.value).toBe(false);
  });

  it('правка пришла после макротаска — так правит пользователь: cancelled', async () => {
    const { answers, bundle, handler, sending } = pendingSubmit();
    await tick();

    bundle.model.phone = '+7 900';
    answers[0].resolve(null);

    expect((await sending).status).toBe('cancelled');
    expect(handler).not.toHaveBeenCalled();
  });

  it('значение изменили и вернули: модель та же, что видели правила, — submitted', async () => {
    const { answers, bundle, handler, sending } = pendingSubmit();

    bundle.form.phone.setValue('+7 900');
    bundle.form.phone.setValue('+7');
    answers[0].resolve(null);

    expect(await sending).toEqual({ status: 'submitted', result: '+7' });
    expect(handler).toHaveBeenCalledWith({ amount: '1', phone: '+7' });
  });

  it('повторная отправка после отмены проверяет уже новые значения', async () => {
    const { answers, rules } = controlledAmountRules();
    const bundle = createForm<Shape>({
      initial: { amount: '1', phone: '+7' },
      validation: defineValidation<Shape>((scope) => {
        rules(scope);
        validate(scope.model.$.phone, [required()]);
      }),
    });
    const handler = vi.fn(() => 'ok');
    const first = bundle.submission.submit(handler);
    bundle.form.phone.setValue('');
    answers[0].resolve(null);
    expect((await first).status).toBe('cancelled');

    const second = bundle.submission.submit(handler);
    answers[1].resolve(null);

    expect((await second).status).toBe('invalid');
    expect(issueCodes(bundle.form.phone)).toEqual(['required']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('без правил сверять нечего: обработчик получает модель на момент вызова', async () => {
    const bundle = createForm<Shape>({ initial: { amount: '1', phone: '+7' } });
    const handler = vi.fn((values: Shape) => values.phone);

    const sending = bundle.submission.submit(handler);
    bundle.form.phone.setValue('+7 900');

    expect(await sending).toEqual({ status: 'submitted', result: '+7 900' });
  });

  it('число NaN равно самому себе: отправка не отменяется', async () => {
    interface Rate {
      rate: number;
    }
    const bundle = createForm<Rate>({
      initial: { rate: Number.NaN },
      validation: defineValidation<Rate>(({ model }) => {
        validate(model.$.rate, [() => null]);
      }),
    });

    expect((await bundle.submission.submit(() => 'ok')).status).toBe('submitted');
  });
});

describe('bundle.submission — submit: отложенные записи поведения того же тика', () => {
  interface Loan {
    amount: number;
    /** Комиссия и сумма к выдаче — расчёты: пишутся сразу, вместе с правкой суммы. */
    fee: number;
    payout: number;
    /** Строка итога — `onChange` суммы к выдаче: запись отложена на микротаск. */
    summary: string;
    /** Квитанция — `onChange` строки итога: второе звено отложенной цепочки. */
    receipt: string;
    /** Залог нужен только крупной сумме; у выключенного поля значение сбрасывается — отложенно. */
    pledge: string;
  }

  const INITIAL: Loan = { amount: 100, fee: 0, payout: 0, summary: '', receipt: '', pledge: '' };

  /** Значения заявки с суммой `amount`, когда отработали все записи поведения. */
  const settledLoan = (amount: number, pledge = ''): Loan => {
    const payout = amount - amount / 10;
    return {
      amount,
      fee: amount / 10,
      payout,
      summary: `к выдаче ${payout}`,
      receipt: `Квитанция: к выдаче ${payout}`,
      pledge,
    };
  };

  function createLoan(answers?: Deferred<ValidationIssue | null>[]) {
    return createForm<Loan>({
      initial: INITIAL,
      behavior: defineFormBehavior<Loan>(({ model }) => {
        computeFrom([model.$.amount], model.$.fee, (amount) => amount / 10);
        compute(model.$.payout, () => model.amount - model.fee);
        onChange(
          model.$.payout,
          (payout) => {
            model.summary = `к выдаче ${payout}`;
          },
          { immediate: true }
        );
        onChange(
          model.$.summary,
          (summary) => {
            model.receipt = `Квитанция: ${summary}`;
          },
          { immediate: true }
        );
        enableWhen(model.$.pledge, () => model.amount >= 1000, { resetOnDisable: true });
      }),
      validation: defineValidation<Loan>(({ model }) => {
        validate(model.$.amount, [required()]);
        if (answers) {
          validateAsync(model.$.amount, [
            () => {
              const answer = deferred<ValidationIssue | null>();
              answers.push(answer);
              return answer.promise;
            },
          ]);
        }
      }),
    });
  }

  it('отправка сразу после сборки: первые записи поведения выполнены самой сборкой', async () => {
    const bundle = createLoan();
    const handler = vi.fn((values: Loan) => values.receipt);

    // Без ожидания после сборки: строка итога и квитанция уже записаны — сборка выполняет первые
    // записи поведения до возврата, а не оставляет их микротаску.
    expect(bundle.model.receipt).toBe('Квитанция: к выдаче 90');
    expect(await bundle.submission.submit(handler)).toEqual({
      status: 'submitted',
      result: 'Квитанция: к выдаче 90',
    });
    expect(handler).toHaveBeenCalledWith(settledLoan(100));
  });

  it('правка и отправка в одном тике: цепочка записей доходит до обработчика целиком', async () => {
    const bundle = createLoan();
    await tick();
    const handler = vi.fn((values: Loan) => values);

    bundle.form.amount.setValue(500);
    const result = await bundle.submission.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: settledLoan(500) });
  });

  it('правка условия и отправка в одном тике: сброс выключенного поля её не отменяет', async () => {
    const bundle = createLoan();
    bundle.model.amount = 2000;
    await tick();
    bundle.form.pledge.setValue('автомобиль');
    await tick();
    const handler = vi.fn((values: Loan) => values.pledge);

    bundle.form.amount.setValue(300);
    const result = await bundle.submission.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: '' });
    expect(bundle.form.pledge.disabled.value).toBe(true);
  });

  it('то же с async-правилом: записи того же тика отправку не отменяют', async () => {
    const answers: Deferred<ValidationIssue | null>[] = [];
    const bundle = createLoan(answers);
    const handler = vi.fn((values: Loan) => values);

    const sending = bundle.submission.submit(handler);
    await tick();
    answers[0].resolve(null);

    expect(await sending).toEqual({ status: 'submitted', result: settledLoan(100) });
  });

  it('записи отработали, а потом пришла правка: cancelled', async () => {
    const answers: Deferred<ValidationIssue | null>[] = [];
    const bundle = createLoan(answers);
    const handler = vi.fn(() => 'ok');

    const sending = bundle.submission.submit(handler);
    await tick();
    bundle.form.amount.setValue(700);
    await tick();
    answers[0].resolve(null);

    expect((await sending).status).toBe('cancelled');
    expect(handler).not.toHaveBeenCalled();
  });

  it('запись поведения после запроса — уже не тот же тик: cancelled', async () => {
    interface Address {
      zip: string;
      /** Город подставляет поведение по индексу — после ответа справочника. */
      city: string;
    }
    const lookup = deferred<string>();
    const zipCheck = deferred<ValidationIssue | null>();
    const bundle = createForm<Address>({
      initial: { zip: '', city: '' },
      behavior: defineFormBehavior<Address>(({ model }) => {
        onChange(model.$.zip, async () => {
          model.city = await lookup.promise;
        });
      }),
      validation: defineValidation<Address>(({ model }) => {
        validateAsync(model.$.zip, [() => zipCheck.promise]);
      }),
    });
    const handler = vi.fn(() => 'ok');

    bundle.form.zip.setValue('101000');
    const sending = bundle.submission.submit(handler);
    await tick();
    lookup.resolve('Москва');
    await tick();
    zipCheck.resolve(null);

    expect((await sending).status).toBe('cancelled');
    expect(bundle.model.city).toBe('Москва');
    expect(handler).not.toHaveBeenCalled();
  });
});
