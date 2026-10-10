/**
 * Счастливый путь заявки на кредит: пользователь проходит визард шаг за шагом и отправляет заявку.
 *
 * Сценарий проверяет связку потока шагов, проверки шага и отправки на настоящей форме:
 * - переход проверяет только свой шаг и раскрывает (`touched`) только поля этого шага;
 * - доступность шагов (`canGoTo`) и причины отказа перехода (`locked`, `edge`);
 * - отправка получает `model.get()` целиком (с производными полями) и даёт статус `submitted`;
 * - выключенное поле не мешает отправке, даже если его правило из `extras` нарушено;
 * - межшаговое правило из `extras` проверяется при отправке, а предупреждение её не держит.
 * Отказы и гонки отправки, массивы, стратегии живой проверки — в соседних сценариях (`README.md`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { settle } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes, resultCodes } from '../test-utils/issues';
import {
  isFormArray,
  isFormControl,
  isFormGroup,
  type FormGroup,
  type FormNode,
} from '../../src/index';
import { runValidation } from '../../src/form/validation/index';
import { VALID_INN, passWizardTo } from './fixtures/loan-application/actions';
import { annuityPayment } from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import { LOAN_STEP_IDS } from './fixtures/loan-application/flow';
import type { LoanApplication } from './fixtures/loan-application/model';

/** Сборки текущего теста: после теста их поведение снимается. */
const assembled: LoanForm[] = [];

function build(options?: LoanFormOptions): LoanForm {
  const built = createLoanForm(options);
  assembled.push(built);
  return built;
}

afterEach(() => {
  for (const { bundle } of assembled.splice(0)) disposeForm(bundle.form);
  vi.restoreAllMocks();
});

/** Пути полей формы, которые помечены `touched`, — по дереву нод, по алфавиту. */
function touchedPaths(form: FormGroup<LoanApplication>): string[] {
  const paths: string[] = [];
  const visit = (node: FormNode<unknown>, path: string): void => {
    if (isFormGroup(node)) {
      for (const [key, child] of Object.entries(node.$)) {
        visit(child as FormNode<unknown>, path === '' ? key : `${path}.${key}`);
      }
    } else if (isFormArray(node)) {
      node.forEach((row, index) => visit(row as FormNode<unknown>, `${path}.${index}`));
    } else if (isFormControl(node) && node.touched.value) {
      paths.push(path);
    }
  };
  visit(form as FormNode<unknown>, '');
  return paths.sort();
}

/** Поля шага «Кредит», которые проверяют его правила (с полями залога за `validateWhen`). */
const LOAN_FIELDS = [
  'loan.amount',
  'loan.firstPaymentDate',
  'loan.initialPayment',
  'loan.promoCode',
  'loan.propertyValue',
  'loan.purpose',
  'loan.term',
  'loan.type',
];

/** Поля шага «Заёмщик». */
const APPLICANT_FIELDS = [
  'applicant.birthDate',
  'applicant.firstName',
  'applicant.inn',
  'applicant.lastName',
  'applicant.middleName',
  'applicant.passport.issueDate',
  'applicant.passport.issuedBy',
  'applicant.passport.number',
  'applicant.passport.series',
];

describe('визард заявки — счастливый путь', () => {
  it('WH-01: шаг за шагом — каждый переход проверяет свой шаг и ведёт на следующий', async () => {
    const { bundle, server } = build();
    const flow = bundle.flow!;
    expect([flow.current.value, flow.isFirst.value]).toEqual(['loan', true]);

    const transitions = await passWizardTo(bundle, 'review');

    expect(transitions).toEqual(
      LOAN_STEP_IDS.slice(0, -1).map((from, index) => ({
        status: 'moved',
        from,
        to: LOAN_STEP_IDS[index + 1],
      }))
    );
    expect([flow.current.value, flow.isLast.value, flow.index.value]).toEqual(['review', true, 6]);
    expect([...flow.completed.value]).toEqual(LOAN_STEP_IDS.slice(0, -1));
    expect(flow.validating.value).toBe(false);
    expect(bundle.form.valid.value).toBe(true);
    // ИНН проверен сервером один раз — правилом своего шага.
    expect(server.callsOf('checkInn').map((call) => call.args[0])).toEqual([VALID_INN]);
  });

  it('WH-02: незаполненный шаг не пускает дальше и показывает ошибки только своих полей', async () => {
    const { bundle } = build();
    const { form } = bundle;

    const transition = await bundle.flow!.next();

    expect(transition).toMatchObject({ status: 'stayed', step: 'loan', reason: 'invalid' });
    expect(issueCodes(form.loan.amount)).toEqual(['loan.amount.required']);
    expect(form.loan.amount.shouldShowError.value).toBe(true);
    expect(form.applicant.lastName.issues.value).toEqual([]);
    expect(bundle.flow!.current.value).toBe('loan');
  });

  it('WH-03: touched — только у полей проверенного шага', async () => {
    const { bundle } = build();
    expect(touchedPaths(bundle.form)).toEqual([]);

    await passWizardTo(bundle, 'applicant');
    // поведение под вопросом [ReFormer-y5g8]: поля залога выключены и скрыты (не ипотека), но правила шага касаются
    // их до гейта `validateWhen` — они тоже становятся touched, и после включения их ошибка видна
    // с первой же проверки, хотя пользователь этих полей не видел.
    expect(touchedPaths(bundle.form)).toEqual(LOAN_FIELDS);

    await passWizardTo(bundle, 'contacts');
    expect(touchedPaths(bundle.form)).toEqual([...LOAN_FIELDS, ...APPLICANT_FIELDS].sort());
    expect(bundle.form.phone.touched.value).toBe(false);
  });

  it('WH-04: причины отказа — `edge` на краях потока, `locked` для шага за непройденным', async () => {
    const { bundle } = build();
    const flow = bundle.flow!;

    expect(flow.previous()).toEqual({ status: 'stayed', step: 'loan', reason: 'edge' });
    expect(flow.goTo('documents')).toEqual({ status: 'stayed', step: 'loan', reason: 'locked' });

    await passWizardTo(bundle, 'review');
    const last = await flow.next();

    // У шага проверки правил нет: он проходится, но дальше идти некуда.
    expect(last).toMatchObject({ status: 'stayed', step: 'review', reason: 'edge' });
    expect(flow.completed.value.has('review')).toBe(true);
    expect(flow.current.value).toBe('review');
  });

  it('WH-05: canGoTo — первый шаг доступен всегда, остальные — после прохождения предыдущего', async () => {
    const { bundle } = build();
    const flow = bundle.flow!;
    const available = (): string[] => LOAN_STEP_IDS.filter((id) => flow.canGoTo(id));

    expect(available()).toEqual(['loan']);
    expect(flow.canGoTo('unknown')).toBe(false);

    await passWizardTo(bundle, 'contacts');
    expect(available()).toEqual(['loan', 'applicant', 'contacts']);

    // Возврат назад забывает пройденные после цели шаги.
    expect(flow.goTo('applicant')).toEqual({ status: 'moved', from: 'contacts', to: 'applicant' });
    expect(available()).toEqual(['loan', 'applicant']);
    expect(flow.goTo('contacts')).toMatchObject({ status: 'stayed', reason: 'locked' });
    expect(await flow.next()).toEqual({ status: 'moved', from: 'applicant', to: 'contacts' });
  });

  it('WH-06: отправка — обработчик получает model.get() целиком, статус submitted', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    let submittingInHandler = false;

    const result = await bundle.submit((values) => {
      submittingInHandler = bundle.submitting.value;
      return server.api.submitApplication(values);
    });

    expect(result).toEqual({ status: 'submitted', result: { applicationNumber: 'ЗК-000001' } });
    const [sent] = server.last('submitApplication').args;
    expect(sent).toEqual(bundle.model.get());
    // Производные поля уходят вместе с данными.
    expect(sent.loan.monthlyPayment).toBe(annuityPayment(500_000, 36, 15.9));
    expect(sent.applicant.fullName).toBe('Иванов Иван Иванович');
    expect([submittingInHandler, bundle.submitting.value]).toEqual([true, false]);
    expect(server.callsOf('submitApplication')).toHaveLength(1);
  });

  it('WH-07: выключенное поле не мешает отправке — правило залога из extras у потребительского кредита', async () => {
    const { bundle, server, rules } = build({
      seed: (model) => {
        model.applicationNumber = 'ЗК-000042';
      },
    });
    await passWizardTo(bundle, 'review');
    const { form, model } = bundle;
    expect(form.loan.propertyValue.disabled.value).toBe(true);

    // Само правило нарушено: независимый раннер доступность полей не учитывает.
    const standalone = await runValidation(model, rules.crossStep);
    expect(resultCodes(standalone, model.$.loan.propertyValue)).toEqual(['loan.collateralTooLow']);

    const result = await bundle.submit(server.api.submitApplication);

    expect(result.status).toBe('submitted');
    expect(form.loan.propertyValue.issues.value).toEqual([]);
    // Поле, выключенное схемой, уходит в отправку со своим значением.
    expect(form.applicationNumber.disabled.value).toBe(true);
    expect(server.last('submitApplication').args[0].applicationNumber).toBe('ЗК-000042');
  });

  it('WH-08: межшаговое правило из extras — шаги пройдены, отправка его ловит', async () => {
    const { bundle, rules } = build();
    await passWizardTo(bundle, 'review');
    // Доход семьи мал для платежа: каждый шаг верен сам по себе, нарушено отношение их данных.
    bundle.model.employment.monthlyIncome = 20_000;
    bundle.model.hasCoBorrowers = false;
    await settle();
    expect(bundle.model.paymentToIncomeRatio).toBe(88);
    const handler = vi.fn();

    const result = await bundle.submit(handler);

    expect(result).toMatchObject({ status: 'invalid', validation: { status: 'invalid' } });
    expect(handler).not.toHaveBeenCalled();
    expect(bundle.form.loan.amount.issues.value).toEqual([
      { code: 'loan.paymentTooHigh', params: { ratio: 88, limit: 50 } },
    ]);
    expect(bundle.form.loan.amount.shouldShowError.value).toBe(true);
    expect((await runValidation(bundle.model, rules.loan)).status).toBe('valid');
  });

  it('WH-09: предупреждение из extras показывается, но отправку не держит', async () => {
    const { bundle, server } = build();
    await passWizardTo(bundle, 'review');
    bundle.model.employment.monthlyIncome = 40_000;
    bundle.model.hasCoBorrowers = false;
    await settle();

    const result = await bundle.submit(server.api.submitApplication);

    expect(result.status).toBe('submitted');
    expect(bundle.form.loan.amount.issues.value).toEqual([
      { code: 'loan.highDebtLoad', severity: 'warning', params: { ratio: 44 } },
    ]);
    expect(bundle.form.loan.amount.valid.value).toBe(true);
  });
});
