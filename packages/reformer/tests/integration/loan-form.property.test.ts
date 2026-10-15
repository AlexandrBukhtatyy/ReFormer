/**
 * Заявка на кредит на случайных данных (fast-check).
 *
 * Табличные сценарии каталога проверяют форму на одном наборе значений. Здесь те же обещания
 * держатся на любых данных — генераторы лежат в фикстуре (`fixtures/loan-application/arbitraries`):
 * - случайная верная заявка проходит визард шаг за шагом и отправку; отправлено ровно `model.get()`,
 *   и в нём всё, что ввёл пользователь;
 * - одна неверная правка верной заявки даёт ровно ожидаемые замечания — на своём поле и на тех,
 *   куда значение разносит форма (синхронизация телефона, копия почты, доля последнего созаёмщика,
 *   нагрузка, дата паспорта), — и больше нигде;
 * - случайная последовательность команд над массивом созаёмщиков (добавить, вставить, удалить,
 *   переставить, поменять местами, очистить, править строку, проверить шаг) против эталона: значения,
 *   `keyAt`, под-модель и форма строки, замечания и поведение строки едут вместе со строкой;
 * - `patch` случайного частичного черновика не трогает производные поля и поле сервера: форма с
 *   черновиком целиком равна форме с тем же черновиком без этих полей;
 * - `reset` модели и формы возвращает заявку целиком к исходным значениям: введённые поля — из
 *   снимка, производные — пересчётом поведения; после сброса модель не изменена (`isDirty`).
 *
 * Отложенные записи поведения — микротаски: их дожидается граница макротаска через `setImmediate`,
 * а не `tick()` (`setTimeout(0)` на Windows стоит около 15 мс — глубокий прогон шёл бы минуты).
 * Таймер в заявке один — задержка загрузки городов; он пишет только пропсы поля и снимается вместе
 * с формой. Каждый прогон собирает свою форму и снимает её в `finally`.
 *
 * Воспроизведение: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run loan-form.property`.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { disposeForm } from '../test-utils/dispose-form';
import { issueCodes } from '../test-utils/issues';
import { propertyParams } from '../test-utils/property';
import {
  eachLeafSignal,
  getNodeForSignal,
  isDerived,
  type FlowTransition,
  type FormBundle,
  type FormGroup,
  type FormModel,
  type SubmitResult,
} from '../../src/index';
import type { ValidationResult } from '../../src/form/validation/index';
import {
  daysFromToday,
  documentFile,
  fillLoanStep,
  yearsAgo,
} from './fixtures/loan-application/actions';
import {
  OWNED_FIELD_PATHS,
  fillGeneratedStep,
  loanDraftArb,
  validApplicationArb,
  withoutOwnedFields,
  type GeneratedApplication,
} from './fixtures/loan-application/arbitraries';
import { createLoanForm, type LoanForm } from './fixtures/loan-application/create-loan-form';
import { LOAN_STEP_IDS } from './fixtures/loan-application/flow';
import {
  LOAN_LIMITS,
  blankAddress,
  type Address,
  type CoBorrower,
  type LoanApplication,
} from './fixtures/loan-application/model';

// ─── Прогон ───────────────────────────────────────────────────────────────────────────────

/** Прогонов свойства по умолчанию; глубина — `FC_NUM_RUNS`. */
const RUNS = 25;

/** Таймаут async-свойства — с запасом на число прогонов. */
const ASYNC_TIMEOUT = Math.max(15_000, (propertyParams(RUNS).numRuns ?? RUNS) * 60);

/** Граница макротаска без задержки таймера: к её концу отработали все микротаски. */
const macrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Собрать заявку, выполнить проверку и снять форму — и при падении проверки тоже. */
async function withLoanForm(check: (built: LoanForm) => Promise<void>): Promise<void> {
  const built = createLoanForm();
  try {
    await check(built);
  } finally {
    disposeForm(built.bundle.form);
    built.bundle.validation?.controller.dispose();
  }
}

/** Заполнить все шаги сгенерированной заявки, дожидаясь поведения после каждого шага. */
async function fillAllSteps(
  model: FormModel<LoanApplication>,
  application: GeneratedApplication
): Promise<void> {
  for (const step of LOAN_STEP_IDS) {
    fillGeneratedStep(model, application, step);
    await macrotask();
  }
}

// ─── Замечания ────────────────────────────────────────────────────────────────────────────

/** Коды замечаний по путям полей. */
type IssueMap = Record<string, string[]>;

/** Непустые замечания прогона по путям полей — ошибки и предупреждения. */
function issuesByPath(result: ValidationResult): IssueMap {
  const out: IssueMap = {};
  for (const [handle, issues] of result.issues) {
    if (issues.length > 0) out[handle.__path] = issues.map((issue) => issue.code);
  }
  return out;
}

/** Замечания нескольких источников: коды одного пути — подряд. */
function mergeIssues(...maps: IssueMap[]): IssueMap {
  const out: IssueMap = {};
  for (const map of maps) {
    for (const [path, codes] of Object.entries(map)) out[path] = [...(out[path] ?? []), ...codes];
  }
  return out;
}

/** Переход потока для сравнения: у отказа — коды замечаний по путям вместо результата прогона. */
function viewOfTransition(transition: FlowTransition): unknown {
  if (transition.status === 'moved') return transition;
  const { validation, ...stayed } = transition;
  return { ...stayed, issues: validation ? issuesByPath(validation) : {} };
}

/** Итог отправки для сравнения: у отказа проверки — коды замечаний по путям. */
function viewOfSubmit(result: SubmitResult<unknown>): unknown {
  if (result.status === 'submitted' || result.status === 'failed') return result;
  return { status: result.status, issues: issuesByPath(result.validation) };
}

// ─── Верная заявка ────────────────────────────────────────────────────────────────────────

/** Телефон без разделителей — так форма пишет его в телефон для кода подписи. */
const normalizedPhone = (phone: string): string => phone.replace(/[\s()-]/g, '');

/**
 * Что пользователь ввёл — в том виде, в каком форма обязана это отправить: адрес проживания при
 * совпадении — копия регистрации, доля последнего созаёмщика — остаток до 100 %, телефон и почта
 * согласий — от контактных.
 */
function enteredValues(application: GeneratedApplication): Record<string, unknown> {
  const { coBorrowers, documents: _documents, notifyByEmail, ...entered } = application;
  const othersShare = coBorrowers.slice(0, -1).reduce((sum, row) => sum + row.share, 0);
  return {
    ...entered,
    residenceAddress: application.sameAsRegistration
      ? application.registrationAddress
      : application.residenceAddress,
    coBorrowers: coBorrowers.map((row, index) => ({
      ...row,
      share: index === coBorrowers.length - 1 ? 100 - othersShare : row.share,
      phones: row.phones.map((number) => ({ number })),
    })),
    consent: {
      personalData: true,
      creditBureau: true,
      notifyByEmail,
      smsPhone: normalizedPhone(application.phone),
      notificationEmail: notifyByEmail ? application.email.trim().toLowerCase() : '',
    },
  };
}

describe('заявка на кредит — случайная верная заявка', () => {
  it(
    'LP-01: проходит все шаги и отправку; отправлено model.get() со всем, что ввёл пользователь',
    async () => {
      await fc.assert(
        fc.asyncProperty(validApplicationArb, async (application) => {
          await withLoanForm(async ({ bundle, server }) => {
            const flow = bundle.flow!;
            const lastStep = LOAN_STEP_IDS.length - 1;

            for (const [index, step] of LOAN_STEP_IDS.entries()) {
              fillGeneratedStep(bundle.model, application, step);
              await macrotask();
              expect(viewOfTransition(await flow.next())).toEqual(
                index < lastStep
                  ? { status: 'moved', from: step, to: LOAN_STEP_IDS[index + 1] }
                  : { status: 'stayed', step, reason: 'edge', issues: {} }
              );
            }
            const result = await bundle.submission.submit((values) =>
              server.api.submitApplication(values)
            );

            expect(viewOfSubmit(result)).toMatchObject({ status: 'submitted' });
            const [sent] = server.last('submitApplication').args;
            expect(sent).toEqual(bundle.model.get());
            expect(sent).toMatchObject(enteredValues(application));
            expect(sent.documents?.map(({ name, size, type }) => ({ name, size, type }))).toEqual(
              application.documents
            );
            // В верной заявке нет ни ошибок, ни предупреждений.
            expect(issueCodes(bundle.form)).toEqual([]);
          });
        }),
        propertyParams(RUNS)
      );
    },
    ASYNC_TIMEOUT
  );
});

// ─── Одна неверная правка ─────────────────────────────────────────────────────────────────

/** Правка одного поля верной заявки на неверное значение и замечания, которых она требует. */
interface Violation extends fc.WithToStringMethod {
  /** Правка модели — как ввёл бы пользователь. */
  readonly apply: (model: FormModel<LoanApplication>) => void;
  /** Все непустые замечания полной проверки — по значениям формы после правки. */
  readonly expected: (values: LoanApplication) => IssueMap;
}

function violation(
  label: string,
  apply: Violation['apply'],
  expected: IssueMap | Violation['expected']
): Violation {
  return {
    apply,
    expected: typeof expected === 'function' ? expected : () => expected,
    [fc.toStringMethod]: () => label,
  };
}

/** Записать значение в поле по пути — как поле ввода пишет в свой сигнал. */
function writeField(model: FormModel<LoanApplication>, path: string, value: unknown): void {
  const signal = model.signalAt(path);
  if (signal === undefined) throw new Error(`в модели заявки нет поля «${path}»`);
  signal.value = value;
}

/** Правка одного поля: его коды и замечания полей, на которые значение влияет (`also`). */
function fieldViolation(
  path: string,
  value: unknown,
  codes: string[],
  also: Violation['expected'] = () => ({})
): Violation {
  return violation(
    `${path} = ${fc.stringify(value)}`,
    (model) => writeField(model, path, value),
    (values) => mergeIssues({ [path]: codes }, also(values))
  );
}

/** Нагрузка по производному полю формы: выше 50 % — отказ, выше 40 % — предупреждение. */
function debtLoadIssues({ paymentToIncomeRatio: ratio }: LoanApplication): IssueMap {
  if (ratio > 50) return { 'loan.amount': ['loan.paymentTooHigh'] };
  if (ratio > 40) return { 'loan.amount': ['loan.highDebtLoad'] };
  return {};
}

/** Залог покрывает кредит: сумма ипотеки — не больше 80 % стоимости залога. */
function collateralIssues({ loan }: LoanApplication): IssueMap {
  const tooLow = loan.type === 'mortgage' && (loan.amount ?? 0) > (loan.propertyValue ?? 0) * 0.8;
  return tooLow ? { 'loan.propertyValue': ['loan.collateralTooLow'] } : {};
}

/** Доли созаёмщиков после досчёта формой: от 1 до 100 %. */
function shareIssues({ coBorrowers }: LoanApplication): IssueMap {
  const out: IssueMap = {};
  coBorrowers.forEach((row, index) => {
    const codes = [
      ...(row.share < 1 ? ['coBorrower.share.min'] : []),
      ...(row.share > 100 ? ['max'] : []),
    ];
    if (codes.length > 0) out[`coBorrowers.${index}.share`] = codes;
  });
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Паспорт выдают с 14 лет: дата выдачи раньше 14-летия — замечание на дате выдачи. */
function passportIssues({ applicant: { birthDate, passport } }: LoanApplication): IssueMap {
  if (!ISO_DATE.test(birthDate) || !ISO_DATE.test(passport.issueDate)) return {};
  const fourteenth = `${Number(birthDate.slice(0, 4)) + 14}${birthDate.slice(4)}`;
  return passport.issueDate < fourteenth
    ? { 'applicant.passport.issueDate': ['applicant.passport.issuedTooEarly'] }
    : {};
}

const digit = fc.constantFrom(...'0123456789');
const text = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.string({ minLength, maxLength });
const digitString = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.string({ unit: digit, minLength, maxLength });
const cyrillic = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.string({ unit: fc.constantFrom(...'абвгдеёжзиклмнопрстуфхцчшщыэюя'), minLength, maxLength });
const latin = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), minLength, maxLength });

/** Правки одного поля (или одной строки массива): в списке шага у каждого поля равный вес. */
const oneOf = (...edits: fc.Arbitrary<Violation>[]): fc.Arbitrary<Violation> => fc.oneof(...edits);

/** Шаг «Кредит»: цель, срок, сумма, дата первого платежа, промокод, взнос по ипотеке. */
function loanViolations({ loan }: GeneratedApplication): fc.Arbitrary<Violation>[] {
  const limits = LOAN_LIMITS[loan.type];
  const amount = loan.amount ?? 0;
  const term = loan.term ?? 0;
  const propertyValue = loan.propertyValue ?? 0;
  return [
    oneOf(
      fc.constant(fieldViolation('loan.purpose', '', ['required'])),
      text(1, 9).map((value) => fieldViolation('loan.purpose', value, ['minLength'])),
      text(201, 240).map((value) => fieldViolation('loan.purpose', value, ['maxLength']))
    ),
    oneOf(
      // Дробный срок рядом с верным: платёж почти тот же, нагрузка порог не переходит.
      fc.constant(fieldViolation('loan.term', term < 360 ? term + 0.5 : term - 0.5, ['integer'])),
      fc
        .integer({ min: 361, max: 600 })
        .map((value) => fieldViolation('loan.term', value, ['loan.term.max']))
    ),
    oneOf(
      // Сумма не кратна тысяче; у ипотеки на пределе залога она ещё и перестаёт им покрываться.
      fc
        .integer({ min: 1, max: 999 })
        .map((delta) =>
          fieldViolation(
            'loan.amount',
            amount + 999 <= limits.max ? amount + delta : amount - delta,
            ['loan.amount.step'],
            collateralIssues
          )
        ),
      fc
        .integer({ min: 1, max: limits.min / 1000 })
        .map((thousands) =>
          fieldViolation('loan.amount', limits.min - thousands * 1000, ['loan.amount.min'])
        )
    ),
    oneOf(
      fc.constant(fieldViolation('loan.firstPaymentDate', '', ['required'])),
      fc
        .integer({ min: 1, max: 30 })
        .map((days) =>
          fieldViolation('loan.firstPaymentDate', daysFromToday(-days), ['date_past'])
        ),
      fc
        .integer({ min: 100, max: 300 })
        .map((days) =>
          fieldViolation('loan.firstPaymentDate', daysFromToday(days), [
            'loan.firstPaymentDate.max',
          ])
        ),
      fc
        .constantFrom('2031-02-30', 'завтра')
        .map((value) => fieldViolation('loan.firstPaymentDate', value, ['date_invalid']))
    ),
    loan.type === 'mortgage'
      ? oneOf(
          fc.constant(
            fieldViolation('loan.initialPayment', 0, ['nonZero', 'loan.initialPayment.tooLow'])
          ),
          fc.constant(
            fieldViolation('loan.initialPayment', null, ['loan.initialPayment.required'])
          ),
          fc
            .integer({ min: 1, max: 1000 })
            .map((extra) =>
              fieldViolation('loan.initialPayment', propertyValue + extra, [
                'loan.initialPayment.tooHigh',
              ])
            ),
          fc
            .integer({ min: 1, max: Math.ceil(propertyValue * 0.15) - 1 })
            .map((value) =>
              fieldViolation('loan.initialPayment', value, ['loan.initialPayment.tooLow'])
            )
        )
      : // Промокод ипотеки стирает поведение — неверным он бывает только у других видов.
        oneOf(
          fc
            .string({ unit: fc.constantFrom(...'ABCXYZ0189'), minLength: 1, maxLength: 3 })
            .map((value) => fieldViolation('loan.promoCode', value, ['loan.promoCode.format'])),
          fc.constant(fieldViolation('loan.promoCode', 'ЛЕТО-2024', ['loan.promoCode.format']))
        ),
  ];
}

/** Шаг «Заёмщик»: имена, ИНН, паспорт, дата рождения (с правилом о 14-летии). */
function applicantViolations(): fc.Arbitrary<Violation>[] {
  const requiredName = fc.constantFrom('applicant.lastName', 'applicant.firstName');
  const anyName = fc.constantFrom(
    'applicant.lastName',
    'applicant.firstName',
    'applicant.middleName'
  );
  return [
    oneOf(
      requiredName.map((path) => fieldViolation(path, '', ['required'])),
      fc
        .tuple(requiredName, cyrillic(1, 1))
        .map(([path, value]) => fieldViolation(path, value, ['minLength'])),
      fc
        .tuple(anyName, cyrillic(51, 60))
        .map(([path, value]) => fieldViolation(path, value, ['maxLength'])),
      fc
        .tuple(anyName, latin(2, 20))
        .map(([path, value]) => fieldViolation(path, value, ['name.cyrillic']))
    ),
    oneOf(
      fc.constant(fieldViolation('applicant.inn', '', ['applicant.inn.required'])),
      fc
        .oneof(digitString(1, 11), digitString(13, 15))
        .map((value) => fieldViolation('applicant.inn', value, ['applicant.inn.format']))
    ),
    oneOf(
      fc
        .oneof(digitString(1, 3), digitString(5, 6))
        .map((value) =>
          fieldViolation('applicant.passport.series', value, ['passport.series.format'])
        ),
      fc
        .oneof(digitString(1, 5), digitString(7, 8))
        .map((value) =>
          fieldViolation('applicant.passport.number', value, ['passport.number.format'])
        ),
      fc.constant(fieldViolation('applicant.passport.issuedBy', '', ['required'])),
      text(1, 9).map((value) => fieldViolation('applicant.passport.issuedBy', value, ['minLength']))
    ),
    // Дата рождения двигает и 14-летие: паспорт может оказаться выданным слишком рано.
    oneOf(
      fc.constant(fieldViolation('applicant.birthDate', '', ['applicant.birthDate.required'])),
      fc
        .integer({ min: 77, max: 95 })
        .map((years) =>
          fieldViolation(
            'applicant.birthDate',
            yearsAgo(years),
            ['applicant.birthDate.maxAge'],
            passportIssues
          )
        ),
      fc
        .integer({ min: 1, max: 17 })
        .map((years) =>
          fieldViolation(
            'applicant.birthDate',
            yearsAgo(years),
            ['applicant.birthDate.minAge'],
            passportIssues
          )
        ),
      fc
        .integer({ min: 1, max: 100 })
        .map((days) =>
          fieldViolation(
            'applicant.birthDate',
            daysFromToday(days),
            ['date_future', 'applicant.birthDate.minAge'],
            passportIssues
          )
        )
    ),
  ];
}

/** Шаг «Контакты»: телефон и почта (с полями согласий, куда их разносит форма) и адреса. */
function contactViolations(application: GeneratedApplication): fc.Arbitrary<Violation>[] {
  const notification =
    (codes: string[]) =>
    (values: LoanApplication): IssueMap =>
      values.consent.notifyByEmail ? { 'consent.notificationEmail': codes } : {};
  const addressViolations = (group: 'registrationAddress' | 'residenceAddress') =>
    oneOf(
      fc.constant(fieldViolation(`${group}.region`, '', ['address.region.required'])),
      fc.constant(fieldViolation(`${group}.city`, '', ['address.city.required'])),
      text(1, 2).map((value) => fieldViolation(`${group}.street`, value, ['minLength'])),
      fc.constant(fieldViolation(`${group}.postalCode`, '', ['address.postalCode.required'])),
      digitString(1, 5).map((value) =>
        fieldViolation(`${group}.postalCode`, value, ['address.postalCode.format'])
      )
    );
  return [
    // Телефон для кода подписи синхронизирован с контактным в обе стороны.
    oneOf(
      digitString(3, 9).map((value) =>
        fieldViolation('phone', value, ['phone'], () => ({ 'consent.smsPhone': ['phone'] }))
      ),
      fc.constant(
        fieldViolation('phone', '', ['phone.required'], () => ({
          'consent.smsPhone': ['consent.smsPhone.required'],
        }))
      ),
      digitString(3, 9).map((value) =>
        fieldViolation('consent.smsPhone', value, ['phone'], () => ({ phone: ['phone'] }))
      )
    ),
    // Почта для уведомлений — копия контактной, пока уведомления включены.
    oneOf(
      fc
        .tuple(latin(1, 10), latin(1, 10))
        .map(([local, domain]) =>
          fieldViolation('email', `${local}@${domain}`, ['email'], notification(['email']))
        ),
      fc.constant(fieldViolation('email', '', ['email.required'], notification(['required'])))
    ),
    addressViolations('registrationAddress'),
    // Адрес проживания проверяется, только когда он отдельный.
    ...(application.sameAsRegistration ? [] : [addressViolations('residenceAddress')]),
  ];
}

/** Шаг «Работа»: работодатель и доход работающего, строки прежних мест работы. */
function employmentViolations({ employment }: GeneratedApplication): fc.Arbitrary<Violation>[] {
  const jobs = employment.previousJobs.length;
  const job = fc.integer({ min: 0, max: Math.max(0, jobs - 1) });
  const years = (index: number): string => `employment.previousJobs.${index}.years`;
  return [
    ...(employment.status === 'unemployed'
      ? []
      : [
          oneOf(
            fc.constant(
              fieldViolation('employment.companyName', '', ['employment.companyName.required'])
            ),
            fc.constant(
              fieldViolation('employment.position', '', ['employment.position.required'])
            ),
            latin(2, 12).map((value) =>
              fieldViolation('employment.companySite', value, ['employment.companySite.url'])
            )
          ),
          // Доход меняет нагрузку: замечание о платеже ложится на сумму кредита.
          oneOf(
            fc
              .integer({ min: 0, max: 9_999 })
              .map((value) =>
                fieldViolation(
                  'employment.monthlyIncome',
                  value,
                  ['employment.monthlyIncome.min'],
                  debtLoadIssues
                )
              ),
            fc.constant(
              fieldViolation(
                'employment.monthlyIncome',
                null,
                ['employment.monthlyIncome.required'],
                debtLoadIssues
              )
            )
          ),
        ]),
    ...(jobs === 0
      ? []
      : [
          oneOf(
            job.map((index) => fieldViolation(years(index), null, ['required'])),
            fc
              .tuple(job, fc.integer({ min: -10, max: -1 }))
              .map(([index, value]) => fieldViolation(years(index), value, ['nonNegative'])),
            fc
              .tuple(job, fc.integer({ min: 61, max: 99 }))
              .map(([index, value]) => fieldViolation(years(index), value, ['max'])),
            fc
              .tuple(job, fc.integer({ min: 0, max: 59 }))
              .map(([index, value]) => fieldViolation(years(index), value + 0.5, ['integer'])),
            job.map((index) =>
              fieldViolation(`employment.previousJobs.${index}.company`, '', [
                'previousJob.company.required',
              ])
            )
          ),
        ]),
  ];
}

/** Шаг «Семья и созаёмщики»: иждивенцы, поля строк, доли, телефоны и пустой список. */
function familyViolations({ coBorrowers }: GeneratedApplication): fc.Arbitrary<Violation>[] {
  const row = fc.integer({ min: 0, max: Math.max(0, coBorrowers.length - 1) });
  const indexesWhere = (
    matches: (coBorrower: GeneratedApplication['coBorrowers'][number]) => boolean
  ): number[] => coBorrowers.flatMap((coBorrower, index) => (matches(coBorrower) ? [index] : []));
  const withPhones = indexesWhere((coBorrower) => coBorrower.phones.length > 0);
  const separate = indexesWhere((coBorrower) => !coBorrower.livesWithApplicant);
  return [
    oneOf(
      fc.constant(fieldViolation('dependents', null, ['required'])),
      fc.integer({ min: 11, max: 30 }).map((value) => fieldViolation('dependents', value, ['max'])),
      fc
        .integer({ min: -5, max: -1 })
        .map((value) => fieldViolation('dependents', value, ['nonNegative'])),
      fc
        .integer({ min: 0, max: 9 })
        .map((value) => fieldViolation('dependents', value + 0.5, ['integer']))
    ),
    ...(coBorrowers.length === 0
      ? []
      : [
          oneOf(
            row.map((index) =>
              fieldViolation(`coBorrowers.${index}.fullName`, '', ['coBorrower.fullName.required'])
            ),
            fc
              .tuple(row, text(1, 4))
              .map(([index, value]) =>
                fieldViolation(`coBorrowers.${index}.fullName`, value, ['minLength'])
              ),
            row.map((index) =>
              fieldViolation(`coBorrowers.${index}.relation`, null, [
                'coBorrower.relation.required',
              ])
            )
          ),
          fc
            .tuple(row, fc.integer({ min: 0, max: 9_999 }))
            .map(([index, value]) =>
              fieldViolation(
                `coBorrowers.${index}.monthlyIncome`,
                value,
                ['coBorrower.monthlyIncome.min'],
                debtLoadIssues
              )
            ),
          // Отметка «есть созаёмщики» стоит, а список пуст: замечание — на отметке, а доход семьи
          // без созаёмщиков меняет нагрузку.
          fc.constant(
            violation(
              'coBorrowers.clear()',
              (model) => model.coBorrowers.clear(),
              (values) =>
                mergeIssues({ hasCoBorrowers: ['coBorrowers.empty'] }, debtLoadIssues(values))
            )
          ),
        ]),
    // Долю не последнего созаёмщика правит пользователь, долю последнего досчитывает форма:
    // 0 % — замечание на своей строке, больше 100 % — ещё и отрицательный остаток у последней.
    ...(coBorrowers.length < 2
      ? []
      : [
          fc
            .tuple(
              fc.integer({ min: 0, max: coBorrowers.length - 2 }),
              fc.oneof(fc.constant(0), fc.integer({ min: 101, max: 150 }))
            )
            .map(([index, value]) =>
              violation(
                `coBorrowers.${index}.share = ${value}`,
                (model) => writeField(model, `coBorrowers.${index}.share`, value),
                shareIssues
              )
            ),
        ]),
    ...(withPhones.length === 0
      ? []
      : [
          fc
            .tuple(fc.constantFrom(...withPhones), digitString(3, 9))
            .map(([index, value]) =>
              fieldViolation(`coBorrowers.${index}.phones.0.number`, value, ['phone'])
            ),
        ]),
    // Отдельно живущему созаёмщику телефон обязателен: замечание ложится на сам массив телефонов.
    ...(separate.length === 0
      ? []
      : [
          fc
            .constantFrom(...separate)
            .map((index) =>
              violation(
                `coBorrowers.${index}.phones.clear()`,
                (model) => model.coBorrowers.at(index).phones.clear(),
                { [`coBorrowers.${index}.phones`]: ['coBorrower.phones.required'] }
              )
            ),
        ]),
  ];
}

/** Шаг «Документы и согласия»: файлы, интересы, рекомендатели, согласия. */
function documentViolations({ references }: GeneratedApplication): fc.Arbitrary<Violation>[] {
  const reference = fc.integer({ min: 0, max: Math.max(0, references.length - 1) });
  const files = (label: string, make: () => File[] | null, codes: string[]): Violation =>
    violation(`documents: ${label}`, (model) => writeField(model, 'documents', make()), {
      documents: codes,
    });
  return [
    oneOf(
      fc.constant(files('нет файлов', () => null, ['documents.required'])),
      fc.constant(
        files('один файл', () => [documentFile('паспорт.pdf', 1024)], ['documents.minFiles'])
      ),
      fc
        .integer({ min: 6, max: 8 })
        .map((count) =>
          files(
            `${count} файлов`,
            () =>
              Array.from({ length: count }, (_, index) => documentFile(`лист-${index}.pdf`, 1024)),
            ['maxFiles']
          )
        ),
      fc.constant(
        files(
          'текстовый файл',
          () => [
            documentFile('заметки.txt', 1024, 'text/plain'),
            documentFile('справка.pdf', 1024),
          ],
          ['fileType']
        )
      ),
      fc.constant(
        files(
          'пустой файл',
          () => [documentFile('пусто.pdf', 0), documentFile('справка.pdf', 1024)],
          ['minFileSize']
        )
      )
    ),
    fc.constant(
      fieldViolation(
        'interests',
        ['deposit', 'card', 'insurance', 'investments'],
        ['interests.tooMany']
      )
    ),
    fc
      .constantFrom('consent.personalData', 'consent.creditBureau')
      .map((path) => fieldViolation(path, false, [`${path}.required`])),
    ...(references.length === 0
      ? []
      : [
          oneOf(
            reference.map((index) => fieldViolation(`references.${index}.name`, '', ['required'])),
            fc
              .tuple(reference, text(1, 2))
              .map(([index, value]) =>
                fieldViolation(`references.${index}.name`, value, ['minLength'])
              ),
            fc
              .tuple(reference, digitString(3, 9))
              .map(([index, value]) =>
                fieldViolation(`references.${index}.phone`, value, ['phone'])
              )
          ),
        ]),
  ];
}

/** Правки шага «Заёмщик» от заявки не зависят — строятся один раз. */
const APPLICANT_VIOLATIONS = applicantViolations();

/**
 * Верная заявка и одна неверная правка, применимая к ней. Сначала выбирается шаг, затем правка
 * шага: иначе правки строк созаёмщиков и занятости терялись бы среди полутора десятков правок
 * каждого из остальных шагов.
 */
const applicationWithViolationArb = validApplicationArb.chain((application) => {
  const bySteps = [
    loanViolations(application),
    APPLICANT_VIOLATIONS,
    contactViolations(application),
    employmentViolations(application),
    familyViolations(application),
    documentViolations(application),
  ];
  return fc
    .oneof(...bySteps.filter((edits) => edits.length > 0).map((edits) => fc.oneof(...edits)))
    .map((edit) => ({ application, edit }));
});

describe('заявка на кредит — одна неверная правка верной заявки', () => {
  it(
    'LP-02: полная проверка даёт ровно ожидаемые коды на ожидаемых путях — и в результате, и на нодах; прежние значения их гасят',
    async () => {
      await fc.assert(
        fc.asyncProperty(applicationWithViolationArb, async ({ application, edit }) => {
          await withLoanForm(async ({ bundle }) => {
            const { model } = bundle;
            await fillAllSteps(model, application);
            expect(issuesByPath(await bundle.validate())).toEqual({});
            const valid = model.get();

            edit.apply(model);
            await macrotask();
            const result = await bundle.validate();

            const expected = edit.expected(model.get());
            expect(issuesByPath(result)).toEqual(expected);
            expect(result.status).toBe('invalid');
            for (const [path, codes] of Object.entries(expected)) {
              const node = getNodeForSignal(model.signalAt(path) as object);
              expect(node && issueCodes(node), path).toEqual(codes);
            }
            expect(bundle.form.valid.value).toBe(false);

            // Прежние значения гасят замечания — в результате прогона и на нодах.
            model.set(valid);
            await macrotask();
            expect(issuesByPath(await bundle.validate())).toEqual({});
            expect(issueCodes(bundle.form)).toEqual([]);
            expect(bundle.form.valid.value).toBe(true);
          });
        }),
        propertyParams(RUNS)
      );
    },
    ASYNC_TIMEOUT
  );
});

// ─── Массив созаёмщиков против эталона ────────────────────────────────────────────────────

/** Телефон и адрес, с которыми строка созаёмщика проходит правила. */
const ROW_PHONE = '+7 (900) 765-43-21';
const ROW_ADDRESS: Address = {
  region: 'Москва',
  city: 'Москва',
  street: 'ул. Ленина, д. 1',
  postalCode: '101000',
};

/** Строка эталона: что ввёл пользователь и что форма обязана держать за строкой. */
interface ReferenceRow {
  /** Уникальное ФИО — по нему строка узнаётся в значениях. */
  readonly fullName: string;
  readonly monthlyIncome: number;
  /** Под-модель и форма строки на момент добавления: при перестановках они те же. */
  readonly model: FormModel<CoBorrower>;
  readonly form: FormGroup<CoBorrower>;
  /** Ключ строки (`keyAt`) на момент добавления. */
  readonly key: string;
  share: number;
  isPrimaryContact: boolean;
  livesWithApplicant: boolean;
  /** Коды замечаний строки от последней проверки шага; новая строка — без замечаний. */
  issues: string[];
}

/** Эталон массива созаёмщиков. */
interface RowsReference {
  rows: ReferenceRow[];
  /** Под-модели удалённых строк: их поведение должно быть снято. */
  removed: Array<FormModel<CoBorrower>>;
  /** Замечание «отмечены созаёмщики, а список пуст» от последней проверки шага. */
  listEmpty: boolean;
  /** Сколько строк добавлено за прогон — для уникальных имён. */
  added: number;
}

/** Через что идёт команда: массив модели или нода массива формы. */
type Via = 'model' | 'form';

/** Долю последней строки досчитывает форма: остаток до 100 %. */
function settleShares(reference: RowsReference): void {
  const last = reference.rows[reference.rows.length - 1];
  if (last === undefined) return;
  last.share = 100 - reference.rows.slice(0, -1).reduce((sum, row) => sum + row.share, 0);
}

/** Замечания строки при проверке шага: короткое ФИО и доля вне 1–100 %. */
function rowIssues(row: ReferenceRow): { fullName: string[]; share: string[] } {
  return {
    fullName: row.fullName.length < 5 ? ['minLength'] : [],
    share: [
      ...(row.share < 1 ? ['coBorrower.share.min'] : []),
      ...(row.share > 100 ? ['max'] : []),
    ],
  };
}

/** Условие `hideWhen` адреса в области строки; у снятого поведения условия нет. */
function addressHidden(
  bundle: FormBundle<LoanApplication>,
  rowModel: FormModel<CoBorrower>
): boolean | undefined {
  return bundle.render.controller
    .scopeOf(rowModel)
    .__overrideMaps.conditionRegistry.get('co-borrower-address')?.();
}

/** Дождаться отложенных записей и сверить массив с эталоном — одним сравнением. */
async function verifyRows(
  reference: RowsReference,
  bundle: FormBundle<LoanApplication>
): Promise<void> {
  await macrotask();
  const { model, form } = bundle;

  const actual = model.coBorrowers.toArray().map((values, index) => {
    const rowForm = form.coBorrowers.at(index);
    const rowModel = model.coBorrowers.at(index);
    const expected = reference.rows[index];
    return {
      fullName: values.fullName,
      monthlyIncome: values.monthlyIncome,
      share: values.share,
      isPrimaryContact: values.isPrimaryContact,
      livesWithApplicant: values.livesWithApplicant,
      phones: values.phones,
      key: form.coBorrowers.keyAt(index),
      sameModel: rowModel === expected?.model,
      sameForm: rowForm === expected?.form,
      issues: rowForm ? issueCodes(rowForm) : undefined,
      addressDisabled: rowForm?.address.disabled.value,
      addressHidden: addressHidden(bundle, rowModel),
    };
  });

  expect(actual).toEqual(
    reference.rows.map((row) => ({
      fullName: row.fullName,
      monthlyIncome: row.monthlyIncome,
      share: row.share,
      isPrimaryContact: row.isPrimaryContact,
      livesWithApplicant: row.livesWithApplicant,
      phones: [{ number: ROW_PHONE }],
      key: row.key,
      sameModel: true,
      sameForm: true,
      issues: row.issues,
      addressDisabled: row.livesWithApplicant,
      addressHidden: row.livesWithApplicant,
    }))
  );
  expect({
    length: form.coBorrowers.length,
    distinctKeys: new Set(actual.map((row) => row.key)).size,
    totalIncome: model.totalIncome,
    valid: form.coBorrowers.valid.value,
    listIssues: issueCodes(form.hasCoBorrowers),
    behaviorsOfRemoved: reference.removed.filter(
      (rowModel) => addressHidden(bundle, rowModel) !== undefined
    ).length,
  }).toEqual({
    length: reference.rows.length,
    distinctKeys: reference.rows.length,
    totalIncome: reference.rows.reduce((sum, row) => sum + row.monthlyIncome, 0),
    valid: reference.rows.every((row) => row.issues.length === 0),
    listIssues: reference.listEmpty ? ['coBorrowers.empty'] : [],
    behaviorsOfRemoved: 0,
  });
}

/** Команда над массивом созаёмщиков: правит форму и эталон, затем сверяет их. */
type RowsCommand = fc.AsyncCommand<RowsReference, FormBundle<LoanApplication>>;

/** Что вводят в новую строку. */
interface NewRow {
  /** Позиция вставки — по модулю длины плюс один: в конец или между строк. */
  readonly at: number;
  readonly via: Via;
  readonly livesWithApplicant: boolean;
  readonly share: number;
  readonly isPrimaryContact: boolean;
  /** Короткое ФИО — строка с замечанием `minLength` при проверке шага. */
  readonly shortName: boolean;
  readonly monthlyIncome: number;
  /** Лишний символ в телефоне — его убирает поведение строки телефона. */
  readonly junkInPhone: boolean;
}

class AddRow implements RowsCommand {
  constructor(private readonly row: NewRow) {}

  check(): boolean {
    return true;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    const { model, form } = bundle;
    const { row } = this;
    const index = row.at % (reference.rows.length + 1);
    reference.added += 1;
    const fullName = row.shortName ? `С${reference.added}` : `Созаёмщик ${reference.added}`;

    model.hasCoBorrowers = true;
    if (row.via === 'model') model.coBorrowers.insertAt(index);
    else form.coBorrowers.insert(index);
    const rowModel = model.coBorrowers.at(index);
    rowModel.patch({
      fullName,
      relation: 'spouse',
      monthlyIncome: row.monthlyIncome,
      share: row.share,
      isPrimaryContact: row.isPrimaryContact,
      livesWithApplicant: row.livesWithApplicant,
      address: row.livesWithApplicant ? blankAddress() : ROW_ADDRESS,
    });
    rowModel.phones.push();
    rowModel.phones.at(0).number = row.junkInPhone ? `${ROW_PHONE}x` : ROW_PHONE;

    // Основной контакт один: новая отметка снимает прежнюю.
    if (row.isPrimaryContact) {
      for (const other of reference.rows) other.isPrimaryContact = false;
    }
    reference.rows.splice(index, 0, {
      fullName,
      monthlyIncome: row.monthlyIncome,
      livesWithApplicant: row.livesWithApplicant,
      model: rowModel,
      form: form.coBorrowers.at(index) as FormGroup<CoBorrower>,
      key: form.coBorrowers.keyAt(index),
      share: row.share,
      isPrimaryContact: row.isPrimaryContact,
      issues: [],
    });
    settleShares(reference);
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return `add(${JSON.stringify(this.row)})`;
  }
}

class RemoveRow implements RowsCommand {
  constructor(
    private readonly at: number,
    private readonly via: Via
  ) {}

  check(reference: Readonly<RowsReference>): boolean {
    return reference.rows.length > 0;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    const index = this.at % reference.rows.length;
    (this.via === 'model' ? bundle.model.coBorrowers : bundle.form.coBorrowers).removeAt(index);

    reference.removed.push(...reference.rows.splice(index, 1).map((row) => row.model));
    settleShares(reference);
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return `removeAt(${this.at}) через ${this.via}`;
  }
}

class MoveRow implements RowsCommand {
  constructor(
    private readonly from: number,
    private readonly to: number,
    private readonly via: Via
  ) {}

  check(reference: Readonly<RowsReference>): boolean {
    return reference.rows.length > 1;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    const from = this.from % reference.rows.length;
    const to = this.to % reference.rows.length;
    (this.via === 'model' ? bundle.model.coBorrowers : bundle.form.coBorrowers).move(from, to);

    reference.rows.splice(to, 0, ...reference.rows.splice(from, 1));
    settleShares(reference);
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return `move(${this.from}, ${this.to}) через ${this.via}`;
  }
}

class SwapRows implements RowsCommand {
  constructor(
    private readonly first: number,
    private readonly second: number,
    private readonly via: Via
  ) {}

  check(reference: Readonly<RowsReference>): boolean {
    return reference.rows.length > 1;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    const first = this.first % reference.rows.length;
    const second = this.second % reference.rows.length;
    (this.via === 'model' ? bundle.model.coBorrowers : bundle.form.coBorrowers).swap(first, second);

    const { rows } = reference;
    [rows[first], rows[second]] = [rows[second], rows[first]];
    settleShares(reference);
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return `swap(${this.first}, ${this.second}) через ${this.via}`;
  }
}

/** Что правят в строке: живёт ли с заёмщиком, основной ли контакт, доля. */
type RowEdit =
  | { readonly field: 'livesWithApplicant'; readonly value: boolean }
  | { readonly field: 'isPrimaryContact'; readonly value: boolean }
  | { readonly field: 'share'; readonly value: number };

/**
 * Правка поля строки — через под-модель или ноду поля. Поведение строки (доступность и видимость
 * адреса, один основной контакт, досчёт доли) обязано ответить, где бы строка ни стояла.
 */
class EditRow implements RowsCommand {
  constructor(
    private readonly at: number,
    private readonly edit: RowEdit,
    private readonly via: Via
  ) {}

  check(reference: Readonly<RowsReference>): boolean {
    return reference.rows.length > 0;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    const row = reference.rows[this.at % reference.rows.length];
    const { edit } = this;
    const throughModel = this.via === 'model';

    switch (edit.field) {
      case 'livesWithApplicant':
        // Отдельно живущему нужен адрес — его вводят вместе с отметкой.
        if (!edit.value) row.model.address.patch(ROW_ADDRESS);
        if (throughModel) row.model.livesWithApplicant = edit.value;
        else row.form.livesWithApplicant.setValue(edit.value);
        row.livesWithApplicant = edit.value;
        break;
      case 'isPrimaryContact':
        if (throughModel) row.model.isPrimaryContact = edit.value;
        else row.form.isPrimaryContact.setValue(edit.value);
        // Основной контакт один: новая отметка снимает прежнюю, снятая — никого не назначает.
        if (edit.value) for (const other of reference.rows) other.isPrimaryContact = false;
        row.isPrimaryContact = edit.value;
        break;
      case 'share':
        if (throughModel) row.model.share = edit.value;
        else row.form.share.setValue(edit.value);
        row.share = edit.value;
        break;
    }
    settleShares(reference);
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return `edit(${this.at}, ${JSON.stringify(this.edit)}) через ${this.via}`;
  }
}

class ClearRows implements RowsCommand {
  /** `uncheck` — снять отметку «есть созаёмщики»: список очищает поведение формы. */
  constructor(private readonly via: Via | 'uncheck') {}

  check(): boolean {
    return true;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    if (this.via === 'model') bundle.model.coBorrowers.clear();
    else if (this.via === 'form') bundle.form.coBorrowers.clear();
    else bundle.model.hasCoBorrowers = false;

    reference.removed.push(...reference.rows.map((row) => row.model));
    reference.rows = [];
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return `clear через ${this.via}`;
  }
}

class ValidateStep implements RowsCommand {
  check(): boolean {
    return true;
  }

  async run(reference: RowsReference, bundle: FormBundle<LoanApplication>): Promise<void> {
    const result = await bundle.validateStep('co-borrowers');

    reference.listEmpty = bundle.model.hasCoBorrowers && reference.rows.length === 0;
    const expected: IssueMap = reference.listEmpty ? { hasCoBorrowers: ['coBorrowers.empty'] } : {};
    reference.rows.forEach((row, index) => {
      const { fullName, share } = rowIssues(row);
      row.issues = [...fullName, ...share];
      if (fullName.length > 0) expected[`coBorrowers.${index}.fullName`] = fullName;
      if (share.length > 0) expected[`coBorrowers.${index}.share`] = share;
    });
    expect(issuesByPath(result)).toEqual(expected);
    await verifyRows(reference, bundle);
  }

  toString(): string {
    return 'validateStep';
  }
}

const viaArb = fc.constantFrom<Via>('model', 'form');
const positionArb = fc.nat({ max: 5 });

const addRowArb: fc.Arbitrary<RowsCommand> = fc
  .record({
    at: positionArb,
    via: viaArb,
    livesWithApplicant: fc.boolean(),
    share: fc.integer({ min: 0, max: 60 }),
    isPrimaryContact: fc.boolean(),
    shortName: fc.boolean(),
    monthlyIncome: fc.integer({ min: 10_000, max: 500_000 }),
    junkInPhone: fc.boolean(),
  })
  .map((row) => new AddRow(row));

const rowEditArb: fc.Arbitrary<RowEdit> = fc.oneof(
  fc.boolean().map((value) => ({ field: 'livesWithApplicant' as const, value })),
  fc.boolean().map((value) => ({ field: 'isPrimaryContact' as const, value })),
  fc.integer({ min: 0, max: 60 }).map((value) => ({ field: 'share' as const, value }))
);

/**
 * Команда с весами: «добавить» чаще остальных, «очистить» — реже, иначе строкам нечего
 * переставлять и замечаниям не с чем ехать.
 */
const rowsCommandArb: fc.Arbitrary<RowsCommand> = fc.oneof(
  { weight: 5, arbitrary: addRowArb },
  {
    weight: 2,
    arbitrary: fc.tuple(positionArb, viaArb).map(([at, via]) => new RemoveRow(at, via)),
  },
  {
    weight: 3,
    arbitrary: fc
      .tuple(positionArb, positionArb, viaArb)
      .map(([from, to, via]) => new MoveRow(from, to, via)),
  },
  {
    weight: 3,
    arbitrary: fc
      .tuple(positionArb, positionArb, viaArb)
      .map(([first, second, via]) => new SwapRows(first, second, via)),
  },
  {
    weight: 4,
    arbitrary: fc
      .tuple(positionArb, rowEditArb, viaArb)
      .map(([at, edit, via]) => new EditRow(at, edit, via)),
  },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom<Via | 'uncheck'>('model', 'form', 'uncheck')
      .map((via) => new ClearRows(via)),
  },
  { weight: 2, arbitrary: fc.constant<RowsCommand>(new ValidateStep()) }
);

/** Последовательность команд: длина — до предела при любом `size`, а не «несколько команд». */
const rowsCommandsArb = fc.commands([rowsCommandArb], { maxCommands: 24, size: 'max' });

describe('заявка на кредит — массив созаёмщиков под случайными командами', () => {
  it(
    'LP-03: значения, keyAt, под-модель и форма строки, замечания и поведение строк согласованы с эталоном',
    async () => {
      await fc.assert(
        fc.asyncProperty(rowsCommandsArb, async (commands) => {
          await withLoanForm(async ({ bundle }) => {
            const reference: RowsReference = { rows: [], removed: [], listEmpty: false, added: 0 };
            await verifyRows(reference, bundle);

            await fc.asyncModelRun(() => ({ model: reference, real: bundle }), commands);
          });
        }),
        propertyParams(RUNS)
      );
    },
    ASYNC_TIMEOUT
  );
});

// ─── Черновик и сброс ─────────────────────────────────────────────────────────────────────

/** Пути полей модели, помеченных производными, — по алфавиту. */
function derivedPaths(model: FormModel<LoanApplication>): string[] {
  const paths: string[] = [];
  eachLeafSignal(model, (signal) => {
    if (isDerived(signal)) paths.push(signal.__path);
  });
  return paths.sort();
}

/**
 * Значения модели для сравнения двух форм: документы — описаниями. У каждого `File` своё время
 * создания, и два одинаковых документа разных форм иначе не равны.
 */
function comparableValues(model: FormModel<LoanApplication>): unknown {
  const values = model.get();
  return {
    ...values,
    documents: values.documents?.map(({ name, size, type }) => ({ name, size, type })) ?? null,
  };
}

describe('заявка на кредит — черновик и сброс', () => {
  it(
    'LP-04: patch случайного частичного черновика не трогает производные поля и поле сервера',
    async () => {
      await fc.assert(
        fc.asyncProperty(validApplicationArb, loanDraftArb, async (application, draft) => {
          await withLoanForm(async (full) => {
            await withLoanForm(async (stripped) => {
              // Две одинаковые заполненные заявки с номером от сервера.
              for (const { bundle } of [full, stripped]) {
                await fillAllSteps(bundle.model, application);
                bundle.model.applicationNumber = 'ЗК-000042';
              }

              full.bundle.model.patch(draft);
              stripped.bundle.model.patch(withoutOwnedFields(draft));
              await macrotask();

              // Черновик с полями формы действует ровно как черновик без них.
              expect(comparableValues(full.bundle.model)).toEqual(
                comparableValues(stripped.bundle.model)
              );
              expect(full.bundle.model.applicationNumber).toBe('ЗК-000042');
              expect(derivedPaths(full.bundle.model)).toEqual(OWNED_FIELD_PATHS);
            });
          });
        }),
        propertyParams(RUNS)
      );
    },
    ASYNC_TIMEOUT
  );

  it(
    'LP-05: reset модели и формы возвращает введённые поля к исходным значениям',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validApplicationArb,
          loanDraftArb,
          fc.constantFrom('model' as const, 'form' as const),
          async (application, draft, target) => {
            await withLoanForm(async ({ bundle }) => {
              const { model, form } = bundle;
              await macrotask();
              // Заявка целиком: производные поля сброс не пишет — их пересчитывает поведение, когда
              // источники возвращаются к исходным [ReFormer-e9rw].
              const initial = model.get();

              await fillAllSteps(model, application);
              model.patch(draft);
              await macrotask();
              await bundle.validate();
              if (target === 'model') model.reset();
              else form.reset();
              await macrotask();

              expect(model.get()).toEqual(initial);
              // Сброс модели возвращает её к снимку: изменённой она больше не считается.
              if (target === 'model') expect(model.isDirty()).toBe(false);
              // Сброс формы возвращает и состояние нод; сброс модели нод не касается.
              if (target === 'form') {
                expect({
                  touched: form.touched.value,
                  dirty: form.dirty.value,
                  issues: issueCodes(form),
                }).toEqual({ touched: false, dirty: false, issues: [] });
              }
            });
          }
        ),
        propertyParams(RUNS)
      );
    },
    ASYNC_TIMEOUT
  );

  // Было: сброс формы писал ноды по порядку и без batch — срок сброшен, `computeFrom` тут же ставил
  // ставку 15,9 %, а следом нода самой ставки возвращалась к значению своего создания (0, до
  // первого прогона поведения), и пересчитать её было уже нечему. Тот же случай на нетронутой
  // заявке — `reset-and-loading.test.ts` (RL-11, RL-12).
  it('LP-06: form.reset() заполненной заявки оставляет производные поля согласованными с вычислением — ставка без срока 15,9 % [ReFormer-e9rw]', async () => {
    await withLoanForm(async ({ bundle }) => {
      const { model, form } = bundle;
      await macrotask();
      fillLoanStep(model, { term: 120 });
      await macrotask();

      form.reset();
      await macrotask();

      expect(model.loan.interestRate).toBe(15.9);
    });
  });
});
