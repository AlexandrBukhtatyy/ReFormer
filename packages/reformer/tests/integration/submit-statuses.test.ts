/**
 * Отправка заявки на кредит — все пять статусов `bundle.submission.submit(handler)` и то, что вокруг них.
 *
 * Отправка — один прогон всех правил (шаги потока + межшаговые `extras` либо полный набор
 * `rules: 'all'`), затем обработчик со значениями `model.get()`. Здесь проверяется, как это видно
 * на настоящей форме:
 * - `submitted`, `invalid` (поле шага и межшаговое правило), `error` (сервер проверки ИНН упал),
 *   `cancelled` (вторая отправка поверх первой), `failed` (обработчик бросил);
 * - ровно один прогон правил на отправку — и при живой стратегии;
 * - `submitting` — пока работает обработчик, `validating` — пока идёт проверка;
 * - правка формы, пока отправка ждёт проверку: что уходит обработчику и что делает живая стратегия;
 * - одностраничный вариант `rules: 'all'` (композиция `apply(...схемы)`);
 * - замечания сервера после отправки: `setIssues` / `clearIssues` и `applyValidationResult` на
 *   нодах, их видимость (`shouldShowError`), снятие правкой и повторной отправкой.
 * Гонки проверки и живые стратегии — в `async-and-races` и `live-strategies`.
 */

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { settle } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import type { PathAwareSignal, SubmitResult, ValidationIssue } from '../../src/index';
import {
  applyValidationResult,
  defineValidation,
  runValidation,
  type ValidationDefinition,
  type ValidationResult,
  type ValidationStrategyKind,
} from '../../src/form/validation/index';
import { fillLoanApplication, passWizardTo } from './fixtures/loan-application/actions';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import type { LoanApplication } from './fixtures/loan-application/model';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение и стратегия снимаются. */
const assembled: LoanForm[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

afterEach(() => {
  for (const { bundle } of assembled.splice(0)) {
    bundle.validation?.controller.dispose();
    disposeForm(bundle.form);
  }
  vi.restoreAllMocks();
});

// ─── Помощники ──────────────────────────────────────────────────────────────────────────────

/** ИНН верного формата, которого нет в списках заглушки: сервер его «находит». */
const OTHER_INN = '500100732260';

/** Правила сценария со счётчиком прогонов полного набора: замечаний не дают, вызов — на прогон. */
function countingRules(): {
  runs: Mock<() => void>;
  extraRules: ValidationDefinition<LoanApplication>;
} {
  const runs = vi.fn<() => void>();
  return { runs, extraRules: defineValidation<LoanApplication>(() => runs()) };
}

/** Пути полей с замечаниями в результате прогона. */
const pathsWithIssues = (result: ValidationResult): string[] =>
  [...result.issues].filter(([, issues]) => issues.length > 0).map(([handle]) => handle.__path);

/** Результат проверки из итога отправки, которую проверка не пропустила. */
function validationOf(result: SubmitResult<unknown>): ValidationResult {
  if (!('validation' in result)) {
    throw new Error(`отправку не остановила проверка: ${result.status}`);
  }
  return result.validation;
}

// ─── Пять статусов ──────────────────────────────────────────────────────────────────────────

describe('bundle.submission.submit — пять статусов отправки', () => {
  it('SS-01: submitted — обработчик вызван один раз со значениями model.get(), правила прогнаны один раз', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const innChecks = server.callsOf('checkInn').length;
    const handler = vi.fn((values: LoanApplication) => server.api.submitApplication(values));

    const result = await bundle.submission.submit(handler);

    expect(result).toEqual({ status: 'submitted', result: { applicationNumber: 'ЗК-000001' } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(bundle.model.get());
    // Один прогон всех правил — один вопрос серверу про ИНН.
    expect(server.callsOf('checkInn')).toHaveLength(innChecks + 1);
  });

  it('SS-02: invalid по полю шага — обработчик не вызван, замечание видно; исправили — повторная отправка проходит', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { form, model } = bundle;
    const handler = vi.fn((values: LoanApplication) => server.api.submitApplication(values));
    model.email = 'ivanov@';

    const refused = await bundle.submission.submit(handler);

    expect(refused).toMatchObject({ status: 'invalid', validation: { status: 'invalid' } });
    expect(pathsWithIssues(validationOf(refused))).toEqual(['email']);
    expect(handler).not.toHaveBeenCalled();
    expect(issueCodes(form.email)).toEqual(['email']);
    expect(form.email.shouldShowError.value).toBe(true);
    // Отправка поток не трогает: пользователь остаётся на шаге проверки.
    expect(bundle.flow!.current.value).toBe('review');

    model.email = 'ivanov@example.ru';
    const accepted = await bundle.submission.submit(handler);

    expect(accepted.status).toBe('submitted');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(form.email.issues.value).toEqual([]);
  });

  it('SS-03: invalid по межшаговому правилу extras — шаги верны, залог ипотеки не покрывает кредит', async () => {
    const { bundle, rules } = build();
    await passWizardTo(bundle, 'review');
    const { form, model } = bundle;
    model.loan.type = 'mortgage';
    await settle();
    model.loan.patch({
      amount: 5_000_000,
      term: 240,
      propertyValue: 6_000_000,
      initialPayment: 1_000_000,
    });
    await settle();
    const handler = vi.fn();

    const refused = await bundle.submission.submit(handler);

    expect(refused.status).toBe('invalid');
    expect(handler).not.toHaveBeenCalled();
    // Залог включён поведением (ипотека) — и его межшаговое правило снова учитывается.
    expect(form.loan.propertyValue.issues.value).toEqual([
      { code: 'loan.collateralTooLow', params: { maxShare: 80 } },
    ]);
    expect((await runValidation(model, rules.loan)).status).toBe('valid');

    model.loan.amount = 4_800_000;
    expect((await bundle.submission.submit(handler)).status).toBe('submitted');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('SS-04: error — сервер проверки ИНН упал: обработчик не вызван, на поле ruleFailed; после восстановления отправка проходит', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { form, model } = bundle;
    server.hold('checkInn');
    const handler = vi.fn((values: LoanApplication) => server.api.submitApplication(values));
    const outage = new Error('Сервис проверки ИНН недоступен');

    const failing = bundle.submission.submit(handler);
    server.last('checkInn').reject(outage);
    const result = await failing;

    expect(result).toMatchObject({ status: 'error', validation: { status: 'error' } });
    expect(validationOf(result).failures).toEqual([
      { handle: model.$.applicant.inn, error: outage },
    ]);
    expect(handler).not.toHaveBeenCalled();
    expect(issueCodes(form.applicant.inn)).toEqual(['ruleFailed']);
    expect(form.applicant.inn.shouldShowError.value).toBe(true);

    const retry = bundle.submission.submit(handler);
    server.last('checkInn').resolve({ status: 'found' });

    expect(await retry).toEqual({
      status: 'submitted',
      result: { applicationNumber: 'ЗК-000001' },
    });
    expect(form.applicant.inn.issues.value).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('SS-05: cancelled — вторая отправка поверх первой: первая отменена вместе с запросом ИНН, обработчик вызван один раз', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    server.hold('checkInn');
    const handler = vi.fn((values: LoanApplication) => server.api.submitApplication(values));

    // Двойной клик по «Отправить».
    const first = bundle.submission.submit(handler);
    const second = bundle.submission.submit(handler);
    const [stale, fresh] = server.callsOf('checkInn').slice(-2);
    expect([stale.aborted, fresh.aborted]).toEqual([true, false]);
    fresh.resolve({ status: 'found' });

    expect(await first).toMatchObject({
      status: 'cancelled',
      validation: { status: 'cancelled', failures: [] },
    });
    expect(await second).toEqual({
      status: 'submitted',
      result: { applicationNumber: 'ЗК-000001' },
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(server.callsOf('submitApplication')).toHaveLength(1);
  });

  it('SS-06: failed — обработчик бросил (сервер не принял заявку): ошибка в результате, значения на месте, повтор проходит', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const values = bundle.model.get();
    server.hold('submitApplication');
    const outage = new Error('502 Bad Gateway');

    const sending = bundle.submission.submit((application) =>
      server.api.submitApplication(application)
    );
    await settle();
    expect(bundle.submission.submitting.value).toBe(true);
    server.last('submitApplication').reject(outage);

    expect(await sending).toEqual({ status: 'failed', error: outage });
    expect(bundle.submission.submitting.value).toBe(false);
    expect(bundle.model.get()).toEqual(values);
    expect(bundle.form.valid.value).toBe(true);

    const retry = bundle.submission.submit((application) =>
      server.api.submitApplication(application)
    );
    await settle();
    server.last('submitApplication').resolve({ applicationNumber: 'ЗК-000042' });
    expect(await retry).toEqual({
      status: 'submitted',
      result: { applicationNumber: 'ЗК-000042' },
    });
  });
});

// ─── Ход отправки ───────────────────────────────────────────────────────────────────────────

describe('bundle.submission.submit — ход отправки и один прогон правил', () => {
  it('SS-07: validating — пока идёт проверка, submitting — только пока работает обработчик', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    server.hold('checkInn');
    server.hold('submitApplication');

    const sending = bundle.submission.submit((values) => server.api.submitApplication(values));
    expect([bundle.validating.value, bundle.submission.submitting.value]).toEqual([true, false]);
    expect(bundle.form.applicant.inn.pending.value).toBe(true);

    server.last('checkInn').resolve({ status: 'found' });
    await settle();
    expect([bundle.validating.value, bundle.submission.submitting.value]).toEqual([false, true]);

    server.last('submitApplication').resolve({ applicationNumber: 'ЗК-000007' });
    expect((await sending).status).toBe('submitted');
    expect([bundle.validating.value, bundle.submission.submitting.value]).toEqual([false, false]);
  });

  it.each<ValidationStrategyKind>(['submit', 'change', 'blur', 'afterFirstSubmit'])(
    'SS-08: стратегия %s — ровно один прогон правил на отправку',
    async (strategy) => {
      const { runs, extraRules } = countingRules();
      const { bundle, server } = build({ strategy, extraRules });
      await passWizardTo(bundle, 'review');
      bundle.validation!.controller.start();
      await settle();
      runs.mockClear();
      const innChecks = server.callsOf('checkInn').length;

      const result = await bundle.submission.submit(server.api.submitApplication);
      await settle();

      expect(result.status).toBe('submitted');
      // Касания полей и замечания, которые ставит сама отправка, живой прогон не будят.
      expect(runs).toHaveBeenCalledTimes(1);
      expect(server.callsOf('checkInn')).toHaveLength(innChecks + 1);
    }
  );
});

// ─── Правка во время проверки отправки ──────────────────────────────────────────────────────

describe('bundle.submission.submit — правка формы, пока отправка ждёт проверку', () => {
  it('SS-09: правка поля во время проверки отправки отменяет её — непроверенное не уходит обработчику [ReFormer-xt4x]', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    server.hold('checkInn');
    const handler = vi.fn((values: LoanApplication) => server.api.submitApplication(values));

    // Отправка ждёт ответа сервера про ИНН, а пользователь правит почту: форма не заперта
    // (`submitting` ещё false, SS-07). Правила видели прежнюю почту.
    // Было: обработчик читал `model.get()` после проверки и получал правку, которую не проверял
    // никто, — статус `submitted`, на сервер уходила неверная почта, замечаний на поле не было.
    const sending = bundle.submission.submit(handler);
    bundle.form.email.setValue('ivanov@');
    server.last('checkInn').resolve({ status: 'found' });

    expect((await sending).status).toBe('cancelled');
    expect(handler).not.toHaveBeenCalled();
    expect(server.callsOf('submitApplication')).toHaveLength(0);

    // Повторная отправка проверяет уже новую почту и показывает замечание.
    const again = bundle.submission.submit(handler);
    server.last('checkInn').resolve({ status: 'found' });

    expect((await again).status).toBe('invalid');
    expect(issueCodes(bundle.form.email)).toEqual(['email']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('SS-10: живая стратегия change — правка во время проверки отправки отменяет её; ошибку показывает живой прогон', async () => {
    const { bundle, server } = build({ strategy: 'change' });
    await passWizardTo(bundle, 'review');
    bundle.validation!.controller.start();
    server.hold('checkInn');
    const { form } = bundle;
    const handler = vi.fn();

    const sending = bundle.submission.submit(handler);
    form.email.setValue('ivanov@');
    // Живой прогон — та же пара «модель + правила», что у отправки: он её и отменяет.
    const [stale, fresh] = server.callsOf('checkInn').slice(-2);
    expect([stale.aborted, fresh.aborted]).toEqual([true, false]);
    fresh.resolve({ status: 'found' });

    expect((await sending).status).toBe('cancelled');
    await settle();
    expect(handler).not.toHaveBeenCalled();
    expect(issueCodes(form.email)).toEqual(['email']);
    expect(form.email.shouldShowError.value).toBe(true);
  });

  it('SS-11: отменённая отправка форму не трогает', async () => {
    // Отказ отправки раскрывает замечания всех полей только при invalid и error. Результат
    // отменённого прогона не разносится, показывать ему нечего: поле без правил, которого
    // пользователь не касался, остаётся нетронутым. Раньше его метила отправка, которую сменила
    // следующая проверка.
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    server.hold('checkInn');
    const { form } = bundle;
    expect(form.sameAsRegistration.touched.value).toBe(false);

    const sending = bundle.submission.submit(vi.fn());
    const check = bundle.validate();
    server.last('checkInn').resolve({ status: 'found' });

    expect((await sending).status).toBe('cancelled');
    expect(form.sameAsRegistration.touched.value).toBe(false);
    expect((await check).status).toBe('valid');
  });
});

// ─── Одностраничный вариант ─────────────────────────────────────────────────────────────────

describe('rules: all — одностраничная анкета без потока', () => {
  it('SS-12: пустая анкета — замечания всех шагов разом, обработчик не вызван, все поля раскрыты', async () => {
    const { bundle } = build({ rules: 'all' });
    await settle();
    const { form } = bundle;
    const handler = vi.fn();

    expect(bundle.flow).toBeUndefined();
    await expect(bundle.validateStep('loan')).rejects.toThrow('Поток не задан');
    const refused = await bundle.submission.submit(handler);

    expect(refused.status).toBe('invalid');
    expect(handler).not.toHaveBeenCalled();
    expect(pathsWithIssues(validationOf(refused))).toEqual(
      expect.arrayContaining([
        'loan.amount',
        'applicant.inn',
        'phone',
        'registrationAddress.city',
        'employment.companyName',
        'documents',
        'consent.personalData',
      ])
    );
    expect([form.loan.amount.shouldShowError.value, form.documents.shouldShowError.value]).toEqual([
      true,
      true,
    ]);
  });

  it('SS-13: заполненная анкета — submitted; межшаговые правила — часть полного набора', async () => {
    const { bundle, server } = build({ rules: 'all' });
    const { model, form } = bundle;
    fillLoanApplication(model);
    await settle();

    const result = await bundle.submission.submit(server.api.submitApplication);

    expect(result).toEqual({ status: 'submitted', result: { applicationNumber: 'ЗК-000001' } });
    expect(server.last('submitApplication').args[0]).toEqual(model.get());

    // Доход семьи мал для платежа: правило extras ловит и одностраничный вариант.
    model.employment.monthlyIncome = 20_000;
    model.hasCoBorrowers = false;
    await settle();
    const refused = await bundle.submission.submit(server.api.submitApplication);

    expect(refused.status).toBe('invalid');
    expect(issueCodes(form.loan.amount)).toEqual(['loan.paymentTooHigh']);
  });
});

// ─── Замечания сервера ──────────────────────────────────────────────────────────────────────

describe('замечания сервера после отправки', () => {
  it('SS-14: setIssues из обработчика — замечание видно; правка поля его не снимает, повторная отправка снимает', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { form } = bundle;

    const result = await bundle.submission.submit(async (values) => {
      const receipt = await server.api.submitApplication(values);
      // Сервер принял заявку, но ИНН — в стоп-листе: замечание — в поле, форма не сбрасывается.
      form.applicant.inn.setIssues([{ code: 'applicant.inn.blocked' }]);
      return receipt;
    });

    expect(result.status).toBe('submitted');
    expect(issueCodes(form.applicant.inn)).toEqual(['applicant.inn.blocked']);
    // Поле уже тронуто проверкой отправки — замечание видно сразу.
    expect(form.applicant.inn.shouldShowError.value).toBe(true);
    expect([form.applicant.valid.value, form.valid.value]).toEqual([false, false]);

    // Без живой проверки замечание чистит следующий прогон правил, а не правка поля.
    form.applicant.inn.setValue(OTHER_INN);
    await settle();
    expect(issueCodes(form.applicant.inn)).toEqual(['applicant.inn.blocked']);

    const again = await bundle.submission.submit(server.api.submitApplication);

    expect(again.status).toBe('submitted');
    expect(form.applicant.inn.issues.value).toEqual([]);
    expect(form.valid.value).toBe(true);
    expect(server.last('submitApplication').args[0].applicant.inn).toBe(OTHER_INN);
  });

  it('SS-15: живая фаза afterFirstSubmit — правка поля снимает замечание сервера', async () => {
    const { bundle, server } = build({ strategy: 'afterFirstSubmit' });
    bundle.validation!.controller.start();
    await passWizardTo(bundle, 'review');
    const { form } = bundle;
    await bundle.submission.submit(async (values) => {
      const receipt = await server.api.submitApplication(values);
      form.applicant.inn.setIssues([{ code: 'applicant.inn.blocked' }]);
      return receipt;
    });
    expect(issueCodes(form.applicant.inn)).toEqual(['applicant.inn.blocked']);

    form.applicant.inn.setValue(OTHER_INN);
    await settle();

    // Живой прогон после первой отправки проверил новый ИНН и поставил полю свой результат.
    expect(server.last('checkInn').args[0]).toBe(OTHER_INN);
    expect(form.applicant.inn.issues.value).toEqual([]);
    expect(form.valid.value).toBe(true);
  });

  it('SS-16: clearIssues — замечание снимается с поля точечно, с формы — целиком, вместе с замечанием группы', async () => {
    const { bundle } = build();
    await passWizardTo(bundle, 'review');
    const { form } = bundle;
    form.email.setIssues([{ code: 'email.taken' }]);
    form.applicant.passport.number.setIssues([{ code: 'passport.lost' }]);
    form.applicant.setIssues([{ code: 'applicant.duplicate' }]);
    expect(form.valid.value).toBe(false);

    form.email.clearIssues();
    expect(form.email.issues.value).toEqual([]);
    expect(issueCodes(form.applicant)).toEqual(['applicant.duplicate', 'passport.lost']);

    form.clearIssues();
    expect([form.applicant.ownIssues.value, form.applicant.passport.number.issues.value]).toEqual([
      [],
      [],
    ]);
    expect(form.valid.value).toBe(true);
  });

  it('SS-17: applyValidationResult с ответом сервера — замечания на полях, показ — после касания; отправка их заменяет', async () => {
    const { bundle } = build({ rules: 'all' });
    const { form, model } = bundle;
    fillLoanApplication(model);
    await settle();
    // Ответ сервера на проверку черновика — в форме результата прогона, собранного вручную.
    const serverCheck: ValidationResult = {
      status: 'invalid',
      issues: new Map<PathAwareSignal<unknown>, ValidationIssue[]>([
        [model.$.email, [{ code: 'email.taken' }]],
        [model.$.applicant.passport.number, [{ code: 'passport.lost', params: { year: 2024 } }]],
      ]),
      failures: [],
    };

    applyValidationResult(serverCheck);
    expect(issueCodes(form.email)).toEqual(['email.taken']);
    // Поле не трогали: замечание есть, но не показано.
    expect(form.email.shouldShowError.value).toBe(false);

    applyValidationResult(serverCheck, { touch: true });
    expect([
      form.email.shouldShowError.value,
      form.applicant.passport.number.shouldShowError.value,
    ]).toEqual([true, true]);
    // Касание — только полей результата.
    expect(form.phone.touched.value).toBe(false);
    expect(form.valid.value).toBe(false);

    const result = await bundle.submission.submit(() => 'ok');

    expect(result.status).toBe('submitted');
    expect([form.email.issues.value, form.applicant.passport.number.issues.value]).toEqual([
      [],
      [],
    ]);
  });

  it('SS-18: поведение под вопросом [ReFormer-hn34]: замечание сервера на группе правила не перекрывают — отправка проходит при form.valid === false', async () => {
    // поведение под вопросом: прогон правил ставит замечания только тем нодам, которые проверяет.
    // Замечание сервера на группе (у неё своих правил нет) переживает повторную отправку, и статус
    // отправки расходится с `valid` формы — а док `validate()` обещает, что они совпадают. Снять
    // такое замечание может только приложение (`clearIssues`), см. SS-16.
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    const { form } = bundle;
    form.applicant.setIssues([{ code: 'applicant.duplicate' }]);

    const result = await bundle.submission.submit(server.api.submitApplication);

    expect(result.status).toBe('submitted');
    expect(form.applicant.ownIssues.value).toEqual([{ code: 'applicant.duplicate' }]);
    expect(form.valid.value).toBe(false);
  });
});
