/**
 * Тексты замечаний заявки на кредит: правила шагов → резолвер → строка на языке пользователя.
 *
 * Правила заявки несут только код и параметры, текст по коду собирает `resolveIssueMessage`:
 * словарь формы → `validation.<код>` локали → встроенный английский → сам код. Здесь проверяется,
 * что это работает на НАСТОЯЩИХ замечаниях: наборы нарушений заполненной заявки вызывают каждое
 * замечание, которое могут выдать правила шагов, и каждое получает текст на русском и английском
 * без возврата к коду и без неподставленных аргументов. Рядом — то, что видно только на данных
 * формы: `plural` и `select` словаря формы на параметрах правил, функции словаря, подготовка дат,
 * перечней и размеров файлов, смена языка без повторной проверки, локаль из загрузчика (ядро
 * чанком, словарь приложения с «сервера»), хранилище языка с устаревшим ответом и откатом при
 * ошибке, описатели `msg` в пропсах и текстовых узлах схемы. Ветви самих модулей i18n — в
 * юнит-тестах `tests/i18n/`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  compileSchema,
  type CompiledContainerNode,
  type CompiledSchema,
  type SchemaNodeId,
  type ValidationIssue,
} from '../../src/index';
import { runValidation, type ValidationResult } from '../../src/form/validation/index';
import {
  createI18n,
  createLocaleLoader,
  createLocaleStore,
  createMessageFormatter,
  defineMessages,
  extendLocale,
  fetchMessages,
  formatPattern,
  msg,
  parseMessage,
  resolveIssueMessage,
  resolveLocalized,
  validateLocale,
  type I18nHandle,
  type IssueMessages,
} from '../../src/i18n';
import { loadCoreLocale } from '../../src/locale/index';
import { ru as coreRu } from '../../src/locale/ru';
import { computed, isSignal } from '../../src/signals';
import { settle } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import {
  addCoBorrower,
  daysFromToday,
  documentFile,
  fillEmploymentStep,
  fillLoanStep,
  passWizardTo,
  yearsAgo,
} from './fixtures/loan-application/actions';
import { createLoanServer, type LoanServerOptions } from './fixtures/loan-application/api';
import { Summary } from './fixtures/loan-application/components';
import { createLoanForm, type LoanForm } from './fixtures/loan-application/create-loan-form';
import { createLocaleServer, type LocaleServer } from './fixtures/loan-application/locale-server';
import {
  LOAN_APP_MESSAGES,
  loanIssueMessages,
  loanLocales,
} from './fixtures/loan-application/messages';
import { createLoanModel } from './fixtures/loan-application/model';

// ─── Сборки теста и их уборка ───────────────────────────────────────────────────────────────

/** Сборки текущего теста: после теста их поведение снимается. */
const assembled: LoanForm[] = [];

function build(server?: LoanServerOptions): LoanForm {
  const built = createLoanForm(server === undefined ? {} : { server: createLoanServer(server) });
  assembled.push(built);
  return built;
}

afterEach(() => {
  for (const { bundle } of assembled.splice(0)) disposeForm(bundle.form);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const MEGABYTE = 1024 * 1024;

/** ИНН верного формата, которого нет в реестре налоговой. */
const UNKNOWN_INN = '771234567890';
/** ИНН верного формата, проверка которого падает сетевой ошибкой. */
const FAILING_INN = '771234567891';

const ru = createI18n(loanLocales.ru);
const en = createI18n(loanLocales.en);

/** Замечание прогона с кодом `code` на поле `handle`; нет — исключение с тем, что есть. */
function issueAt(result: ValidationResult, handle: unknown, code: string): ValidationIssue {
  const found = (result.issues.get(handle as never) ?? []).find((issue) => issue.code === code);
  if (found === undefined) {
    const codes = (result.issues.get(handle as never) ?? []).map((issue) => issue.code);
    throw new Error(`на поле нет замечания «${code}», есть: ${codes.join(', ') || 'ничего'}`);
  }
  return found;
}

// ─── Все замечания правил шагов ───────────────────────────────────────────────────────────

/** Набор нарушений: что сделать с заявкой, чтобы её правила ответили замечаниями. */
interface BrokenApplication {
  readonly name: string;
  /** Пройти визард с верными данными до шага проверки перед нарушением. */
  readonly filled: boolean;
  readonly server?: LoanServerOptions;
  readonly violate: (loan: LoanForm) => void | Promise<void>;
}

/**
 * Наборы нарушений: вместе они вызывают каждое замечание, которое могут выдать правила шагов и
 * межшаговые правила. Поле проверяется всеми своими правилами сразу, поэтому один набор задевает
 * много кодов; условные ветки (ипотека, отдельный адрес, созаёмщики, работа) открыты.
 */
const BROKEN_APPLICATIONS: readonly BrokenApplication[] = [
  {
    name: 'пустая заявка с открытыми ветками',
    filled: false,
    violate: ({ bundle }) => {
      const { model } = bundle;
      model.loan.type = 'mortgage';
      model.sameAsRegistration = false;
      model.employment.previousJobs.push();
      model.hasCoBorrowers = true;
      model.coBorrowers.push();
      model.coBorrowers.push();
      bundle.form.references.push();
      model.consent.notifyByEmail = true;
      model.dependents = null;
    },
  },
  {
    name: 'неверные форматы и нижние пределы',
    filled: true,
    violate: ({ bundle }) => {
      const { model } = bundle;
      model.loan.patch({
        type: 'mortgage',
        amount: 400_500,
        term: 3,
        purpose: 'Ремонт',
        firstPaymentDate: '2024-02-30',
        propertyValue: 900_000,
        initialPayment: 0,
      });
      model.applicant.patch({
        lastName: 'Ivanov',
        firstName: 'И',
        middleName: 'Ivanovich',
        birthDate: yearsAgo(17),
        inn: '123',
        passport: { series: '45', number: '12', issueDate: '1997-06-30', issuedBy: 'ОВД' },
      });
      model.phone = '12345';
      model.email = 'ivanov@';
      model.registrationAddress.patch({ postalCode: '12', street: 'ул' });
      model.employment.patch({ companySite: 'ромашка', monthlyIncome: 5_000 });
      model.employment.previousJobs.at(0).years = 3.5;
      const coBorrower = model.coBorrowers.at(0);
      coBorrower.patch({ fullName: 'Иван', monthlyIncome: 5_000 });
      coBorrower.phones.at(0).number = '123';
      model.dependents = 1.5;
      model.$.documents.value = [documentFile('notes.txt', 0, 'text/plain')];
      model.$.interests.value = ['deposit', 'card', 'insurance', 'investments'];
      model.references.at(0).patch({ name: 'Пё', phone: '123' });
      model.consent.notifyByEmail = true;
    },
  },
  {
    name: 'верхние пределы',
    filled: true,
    violate: ({ bundle }) => {
      const { model } = bundle;
      model.loan.patch({
        amount: 7_000_500,
        term: 400.5,
        purpose: 'Р'.repeat(201),
        firstPaymentDate: daysFromToday(120),
        promoCode: 'весна',
      });
      model.applicant.patch({
        lastName: 'И'.repeat(51),
        birthDate: yearsAgo(80),
        passport: { issueDate: daysFromToday(1), issuedBy: 'О'.repeat(201) },
      });
      model.employment.previousJobs.at(0).years = 61;
      addCoBorrower(model);
      model.coBorrowers.at(0).share = 150;
      model.dependents = 11;
      model.$.documents.value = [
        documentFile('scan.pdf', 11 * MEGABYTE),
        ...Array.from({ length: 5 }, (_, index) => documentFile(`page-${index}.pdf`, 2 * MEGABYTE)),
      ];
    },
  },
  {
    name: 'межшаговые правила и ответ сервера',
    filled: true,
    server: { unknownInns: [UNKNOWN_INN] },
    violate: async ({ bundle }) => {
      const { model } = bundle;
      model.employment.monthlyIncome = 20_000;
      model.hasCoBorrowers = false;
      await settle();
      // Отметка снова стоит, а список очищен поведением — правило «созаёмщики не указаны».
      model.hasCoBorrowers = true;
      model.applicant.patch({ birthDate: daysFromToday(1), inn: UNKNOWN_INN });
    },
  },
  {
    name: 'предупреждение о нагрузке',
    filled: true,
    violate: ({ bundle }) => {
      bundle.model.employment.monthlyIncome = 40_000;
      bundle.model.hasCoBorrowers = false;
    },
  },
  {
    name: 'ипотека: взнос и залог',
    filled: true,
    violate: ({ bundle }) => {
      bundle.model.loan.patch({
        type: 'mortgage',
        amount: 900_000,
        term: 360,
        propertyValue: 1_000_000,
        initialPayment: 1_200_000,
      });
    },
  },
  {
    name: 'сбой проверки ИНН и прочие правила',
    filled: true,
    server: { failingInns: [FAILING_INN] },
    violate: ({ bundle }) => {
      const { model } = bundle;
      model.loan.patch({ amount: Number.NaN, firstPaymentDate: daysFromToday(-1) });
      model.applicant.inn = FAILING_INN;
      model.dependents = -1;
      model.employment.previousJobs.at(0).years = -1;
    },
  },
];

/** Замечание на поле заявки. */
interface IssueEntry {
  /** Набор нарушений, который вызвал замечание. */
  readonly source: string;
  readonly path: string;
  readonly issue: ValidationIssue;
}

/** Все замечания наборов нарушений — так, как их отдала полная проверка формы. */
async function collectIssues(): Promise<IssueEntry[]> {
  const entries: IssueEntry[] = [];
  for (const broken of BROKEN_APPLICATIONS) {
    const loan = build(broken.server);
    if (broken.filled) await passWizardTo(loan.bundle, 'review');
    await settle();
    await broken.violate(loan);
    await settle();
    const result = await loan.bundle.validate();
    for (const [handle, issues] of result.issues) {
      for (const issue of issues) {
        entries.push({ source: broken.name, path: handle.__path, issue });
      }
    }
  }
  return entries;
}

/** Свои коды, которые объявляют правила заявки, — по исходнику `validation.ts`. */
function declaredOwnCodes(): string[] {
  const source = readFileSync(
    fileURLToPath(new URL('./fixtures/loan-application/validation.ts', import.meta.url)),
    'utf8'
  );
  return [...new Set([...source.matchAll(/code: '([^']+)'/g)].map((match) => match[1]))];
}

/**
 * Своё правило, которое правила шагов выдать не могут: пределы суммы читаются по виду кредита
 * (`LOAN_LIMITS[type].min`) раньше проверки вида, и на пустом виде падает сама схема.
 */
const UNREACHABLE_OWN_CODES = ['loan.type.required'];

/** Встроенные коды, которые выдают правила заявки (свой код у правила их заменяет). */
const BUILTIN_CODES = [
  'date_future',
  'date_invalid',
  'date_past',
  'email',
  'fileType',
  'integer',
  'isNumber',
  'max',
  'maxFileSize',
  'maxFiles',
  'maxLength',
  'maxTotalFileSize',
  'minFileSize',
  'minLength',
  'nonNegative',
  'nonZero',
  'phone',
  'required',
  'ruleFailed',
];

/** Набор текстов: язык и источники — словарь формы и локаль. */
interface TextSetup {
  readonly name: string;
  readonly language: 'ru' | 'en';
  readonly i18n: I18nHandle;
  readonly messages?: IssueMessages;
}

const TEXT_SETUPS: readonly TextSetup[] = [
  { name: 'ru: словарь формы и локаль', language: 'ru', i18n: ru, messages: loanIssueMessages },
  { name: 'ru: только локаль', language: 'ru', i18n: ru },
  { name: 'en: только локаль', language: 'en', i18n: en },
];

const CYRILLIC = /[А-Яа-яЁё]/;

describe('тексты замечаний заявки — каждое замечание правил шагов', () => {
  it('IM-01: наборы нарушений вызывают каждый свой код правил заявки и все её встроенные коды', async () => {
    const codes = [...new Set((await collectIssues()).map(({ issue }) => issue.code))].sort();

    const reachable = declaredOwnCodes().filter((code) => !UNREACHABLE_OWN_CODES.includes(code));
    expect(reachable).toHaveLength(54);
    expect(codes).toEqual([...reachable, ...BUILTIN_CODES].sort());
  });

  it.each(TEXT_SETUPS)(
    'IM-02 · $name — у каждого замечания непустой текст, не код и без пропущенных аргументов',
    async ({ language, i18n, messages }) => {
      const entries = await collectIssues();

      const problems = entries.flatMap(({ source, path, issue }) => {
        const text = resolveIssueMessage(issue, i18n, messages);
        const wrong =
          text.trim() === '' ||
          text === issue.code ||
          /[{}⟦⟧]/.test(text) ||
          CYRILLIC.test(text) !== (language === 'ru');
        return wrong ? [`${source} · ${path} · ${issue.code} → «${text}»`] : [];
      });
      expect(entries.length).toBeGreaterThan(100);
      expect(problems).toEqual([]);
    }
  );

  it('IM-03: словари приложения ru и en — одни ключи и одни подстановки', () => {
    expect(validateLocale(LOAN_APP_MESSAGES.ru, LOAN_APP_MESSAGES.en)).toEqual([]);
    expect(validateLocale(loanLocales.ru.messages, loanLocales.en.messages)).toEqual([]);
  });
});

// ─── Порядок источников ────────────────────────────────────────────────────────────────────

describe('порядок источников текста — на замечаниях заявки', () => {
  it('IM-04: свой код — словарь формы, затем локаль, а без текста в словарях — сам код', async () => {
    const { bundle, rules } = build();
    const warn = vi.spyOn(console, 'warn');
    bundle.model.$.documents.value = [documentFile('passport.pdf', 1024)];
    const issue = issueAt(
      await runValidation(bundle.model, rules.documents),
      bundle.model.$.documents,
      'documents.minFiles'
    );
    expect(issue.params).toEqual({ minFiles: 2, actualCount: 1 });

    expect(resolveIssueMessage(issue, ru, loanIssueMessages)).toBe('Приложено 1 документ из 2');
    expect(resolveIssueMessage(issue, ru)).toBe('Нужно не меньше 2 документов');
    expect(resolveIssueMessage(issue, en)).toBe('At least 2 documents are required');
    // Словарь формы важнее языка: русская анкета остаётся русской и в английской локали.
    expect(resolveIssueMessage(issue, en, loanIssueMessages)).toBe('Приложено 1 документ из 2');
    // Локаль ядра своего кода не знает, встроенной таблицы у него нет.
    expect(resolveIssueMessage(issue, createI18n(coreRu))).toBe('documents.minFiles');
    expect(warn).not.toHaveBeenCalled();
  });

  it('IM-05: встроенный код — локаль, а без словаря ядра в локали — встроенный английский', async () => {
    const { bundle, rules } = build();
    fillLoanStep(bundle.model, { purpose: 'Ремонт' });
    const issue = issueAt(
      await runValidation(bundle.model, rules.loan),
      bundle.model.$.loan.purpose,
      'minLength'
    );
    // Локаль из одного словаря приложения: тексты ядра в неё не попали.
    const appOnly = createI18n({ code: 'ru', messages: LOAN_APP_MESSAGES.ru });

    expect(resolveIssueMessage(issue, ru, loanIssueMessages)).toBe('Не меньше 10 символов');
    expect(resolveIssueMessage(issue, en)).toBe('Enter at least 10 characters');
    expect(resolveIssueMessage(issue, appOnly)).toBe('Enter at least 10 characters');
  });

  it('IM-06: неизвестный код с сервера — сам код и без предупреждений в консоли', () => {
    const { bundle } = build();
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');

    bundle.form.applicant.inn.setIssues([{ code: 'applicant.inn.blacklisted' }]);
    const [issue] = bundle.form.applicant.inn.issues.value;

    expect(resolveIssueMessage(issue, ru, loanIssueMessages)).toBe('applicant.inn.blacklisted');
    expect(resolveIssueMessage(issue, en)).toBe('applicant.inn.blacklisted');
    expect([warn.mock.calls, error.mock.calls]).toEqual([[], []]);
  });
});

// ─── plural, select и функции словаря формы ────────────────────────────────────────────────

describe('plural, select и функции словаря формы — параметры настоящих замечаний', () => {
  it('IM-07: plural числа документов — 1, 2, 5, 21 по-русски и по-английски', async () => {
    const { bundle, rules } = build();
    bundle.model.$.documents.value = [documentFile('passport.pdf', 1024)];
    const issue = issueAt(
      await runValidation(bundle.model, rules.documents),
      bundle.model.$.documents,
      'documents.minFiles'
    );
    const withCount = (count: number) => ({
      ...issue,
      params: { ...issue.params, actualCount: count },
    });
    const withMinimum = (count: number) => ({
      ...issue,
      params: { ...issue.params, minFiles: count },
    });

    expect(
      [1, 2, 5, 21].map((count) => resolveIssueMessage(withCount(count), ru, loanIssueMessages))
    ).toEqual([
      'Приложено 1 документ из 2',
      'Приложено 2 документа из 2',
      'Приложено 5 документов из 2',
      'Приложено 21 документ из 2',
    ]);
    expect([1, 2, 5, 21].map((count) => resolveIssueMessage(withMinimum(count), en))).toEqual([
      'At least 1 document is required',
      'At least 2 documents are required',
      'At least 5 documents are required',
      'At least 21 documents are required',
    ]);
  });

  it('IM-08: plural встроенного текста на порогах правил заявки — 2, 3, 5 и 10 символов', async () => {
    const { bundle, rules } = build();
    const { model } = bundle;
    fillLoanStep(model, { purpose: 'Ремонт' });
    model.applicant.firstName = 'И';
    model.registrationAddress.street = 'ул';
    const coBorrower = addCoBorrower(model, { fullName: 'Иван' });
    const result = await runValidation(model, rules.all);
    const fields = [
      model.$.applicant.firstName,
      model.$.registrationAddress.street,
      coBorrower.$.fullName,
      model.$.loan.purpose,
    ];
    const issues = fields.map((field) => issueAt(result, field, 'minLength'));

    expect(issues.map((issue) => issue.params?.minLength)).toEqual([2, 3, 5, 10]);
    expect(issues.map((issue) => resolveIssueMessage(issue, ru, loanIssueMessages))).toEqual([
      'Не меньше 2 символов',
      'Не меньше 3 символов',
      'Не меньше 5 символов',
      'Не меньше 10 символов',
    ]);
    expect(issues.map((issue) => resolveIssueMessage(issue, en))).toEqual([
      'Enter at least 2 characters',
      'Enter at least 3 characters',
      'Enter at least 5 characters',
      'Enter at least 10 characters',
    ]);
  });

  it('IM-09: select по виду кредита — предел суммы своего вида из параметров правила', async () => {
    const { bundle, rules } = build();
    const { model } = bundle;
    fillLoanStep(model);
    const overLimit = { consumer: 6_000_000, mortgage: 31_000_000, car: 11_000_000 } as const;
    const issues: ValidationIssue[] = [];
    for (const [type, amount] of Object.entries(overLimit)) {
      model.loan.patch({ type: type as keyof typeof overLimit, amount });
      const result = await runValidation(model, rules.loan);
      issues.push(issueAt(result, model.$.loan.amount, 'loan.amount.max'));
    }

    expect(issues.map((issue) => issue.params?.loanType)).toEqual(['consumer', 'mortgage', 'car']);
    expect(issues.map((issue) => resolveIssueMessage(issue, ru, loanIssueMessages))).toEqual([
      'Для потребительского кредита — не больше 5000000 ₽',
      'Для ипотеки — не больше 30000000 ₽',
      'Для автокредита — не больше 10000000 ₽',
    ]);
    expect(issues.map((issue) => resolveIssueMessage(issue, en))).toEqual([
      'A consumer loan is limited to 5000000 RUB',
      'A mortgage is limited to 30000000 RUB',
      'A car loan is limited to 10000000 RUB',
    ]);
  });

  it('IM-10: функция словаря получает сырые параметры и ручку активного языка — разряды по языку', async () => {
    const { bundle, rules } = build();
    const { model } = bundle;
    fillLoanStep(model, { amount: 20_000 });
    fillEmploymentStep(model, { monthlyIncome: 20_000 });
    await settle();
    const minimum = issueAt(
      await runValidation(model, rules.loan),
      model.$.loan.amount,
      'loan.amount.min'
    );
    model.loan.amount = 500_000;
    await settle();
    const payment = issueAt(
      await runValidation(model, rules.crossStep),
      model.$.loan.amount,
      'loan.paymentTooHigh'
    );
    const group = (code: string, value: number) => new Intl.NumberFormat(code).format(value);

    expect(resolveIssueMessage(minimum, ru, loanIssueMessages)).toBe(
      `Минимальная сумма — ${group('ru', 30_000)} ₽`
    );
    expect(resolveIssueMessage(minimum, en, loanIssueMessages)).toBe(
      'Минимальная сумма — 30,000 ₽'
    );
    // Шаблон локали печатает число как есть, без разрядов.
    expect(resolveIssueMessage(minimum, ru)).toBe('Сумма — не меньше 30000 ₽');
    expect(payment.params).toEqual({ ratio: 88, limit: 50 });
    expect(resolveIssueMessage(payment, ru, loanIssueMessages)).toBe(
      'Платёж — 88 % дохода, допустимо не больше 50 %'
    );
    expect(resolveIssueMessage(payment, en)).toBe(
      'The payment is 88% of income; at most 50% is allowed'
    );
  });
});

// ─── Подготовка параметров ─────────────────────────────────────────────────────────────────

describe('подготовка параметров — даты, размеры файлов, перечни', () => {
  it('IM-11: дата из правила — по языку ручки, стилем medium', async () => {
    const { bundle, rules } = build();
    const { model } = bundle;
    fillLoanStep(model, { firstPaymentDate: daysFromToday(120) });
    model.applicant.passport.issueDate = '1997-06-30';
    const passport = issueAt(
      await runValidation(model, rules.applicant),
      model.$.applicant.passport.issueDate,
      'passport.issueDate.min'
    );
    const firstPayment = issueAt(
      await runValidation(model, rules.loan),
      model.$.loan.firstPaymentDate,
      'loan.firstPaymentDate.max'
    );

    expect(passport.params?.minDate).toEqual(new Date(1997, 6, 1));
    expect(resolveIssueMessage(passport, ru)).toBe(
      'Паспорт нового образца выдаётся с 1 июл. 1997 г.'
    );
    expect(resolveIssueMessage(passport, en)).toBe(
      'Current passports are issued since Jul 1, 1997'
    );
    const deadline = firstPayment.params?.maxDate as Date;
    expect(deadline).toBeInstanceOf(Date);
    expect(resolveIssueMessage(firstPayment, ru)).toBe(
      `Первый платёж — не позже ${ru.date(deadline, { dateStyle: 'medium' })}`
    );
    expect(resolveIssueMessage(firstPayment, en)).toBe(
      `The first payment must be no later than ${en.date(deadline, { dateStyle: 'medium' })}`
    );
  });

  it('IM-12: размеры файлов из правил — строкой с единицей языка', async () => {
    const { bundle, rules } = build();
    const { model } = bundle;
    const issueFor = async (files: File[], code: string) => {
      model.$.documents.value = files;
      return issueAt(await runValidation(model, rules.documents), model.$.documents, code);
    };
    const tooBig = await issueFor(
      [documentFile('scan.pdf', 11 * MEGABYTE), documentFile('income.pdf', 1024)],
      'maxFileSize'
    );
    const empty = await issueFor(
      [documentFile('empty.pdf', 0), documentFile('income.pdf', 1024)],
      'minFileSize'
    );
    const total = await issueFor(
      ['a.pdf', 'b.pdf', 'c.pdf'].map((name) => documentFile(name, 7 * MEGABYTE)),
      'maxTotalFileSize'
    );

    expect([tooBig, empty, total].map((issue) => resolveIssueMessage(issue, ru))).toEqual([
      'Файл scan.pdf больше 10 МБ',
      'Файл empty.pdf меньше 1 Б',
      'Суммарный размер файлов больше 20 МБ',
    ]);
    expect([tooBig, empty, total].map((issue) => resolveIssueMessage(issue, en))).toEqual([
      'File scan.pdf is larger than 10 MB',
      'File empty.pdf is smaller than 1 B',
      'The total size of the files exceeds 20 MB',
    ]);
  });

  /** Ответ сервера о сайте работодателя: замечание с перечнем допустимых протоколов. */
  const protocolsFromServer = (): ValidationIssue => {
    const { bundle } = build();
    const site = bundle.form.employment.companySite;
    site.setIssues([
      { code: 'url_protocol', params: { allowedProtocols: ['https', 'http', 'ftp'] } },
    ]);
    return site.issues.value[0];
  };

  it('IM-13: перечень из замечания сервера — по-английски через запятую', () => {
    expect(resolveIssueMessage(protocolsFromServer(), en)).toBe(
      'The URL must use one of these protocols: https, http, ftp'
    );
  });

  // Было: `formatList` (src/i18n/validation-message.ts) брал `Intl.ListFormat` с `type: 'unit'` —
  // формат единиц измерения («5 м 3 см»): в русском (и японском) он склеивает элементы пробелами,
  // и перечень выходил «https http ftp», хотя модуль обещает «перечень через запятую по правилам
  // языка». По-английски тот же формат даёт запятые — поэтому юнит-тест на `en` этого не видел.
  it('IM-14: перечень по-русски разделён запятыми [ReFormer-fnzr]', () => {
    expect(resolveIssueMessage(protocolsFromServer(), ru)).toContain('https, http');
  });
});

// ─── createI18n и смена языка ──────────────────────────────────────────────────────────────

describe('createI18n — смена языка', () => {
  it('IM-15: показанные замечания переводит другая ручка — без повторной проверки', async () => {
    const { bundle, server } = build({ unknownInns: [UNKNOWN_INN] });
    await passWizardTo(bundle, 'contacts');
    bundle.model.applicant.inn = UNKNOWN_INN;
    bundle.model.loan.purpose = 'Ремонт';
    await bundle.validate();
    const shown = [bundle.form.applicant.inn, bundle.form.loan.purpose, bundle.form.phone];
    const issues = shown.map((field) => field.issues.value);
    const checks = server.callsOf('checkInn').length;
    const texts = (i18n: I18nHandle) =>
      shown.map((field) => resolveIssueMessage(field.issues.value[0], i18n));

    expect(texts(ru)).toEqual([
      'ИНН 771234567890 не найден в реестре налоговой',
      'Не меньше 10 символов',
      'Укажите телефон',
    ]);
    expect(texts(en)).toEqual([
      'TIN 771234567890 is not in the tax register',
      'Enter at least 10 characters',
      'Enter a phone number',
    ]);
    // Замечания те же объекты: язык сменился, а проверка не запускалась.
    expect(shown.every((field, index) => field.issues.value === issues[index])).toBe(true);
    expect(server.callsOf('checkInn')).toHaveLength(checks);
  });

  it('IM-16: одна ручка на объект локали; копия локали — новая ручка с тем же переводом', () => {
    const copy = extendLocale(loanLocales.ru, {});

    expect(createI18n(loanLocales.ru)).toBe(ru);
    expect(createI18n(copy)).not.toBe(ru);
    expect(createI18n(copy).t('loan.wizard.title')).toBe(ru.t('loan.wizard.title'));
  });

  it('IM-17: ключи приложения — срок plural 1, 2, 5, 21 и вид кредита select', () => {
    const terms = (i18n: I18nHandle) =>
      [1, 2, 5, 21].map((term) => i18n.t('loan.summary.term', { term }));
    const types = (i18n: I18nHandle) =>
      ['consumer', 'mortgage', 'car'].map((type) => i18n.t('loan.summary.type', { type }));

    expect(terms(ru)).toEqual(['1 месяц', '2 месяца', '5 месяцев', '21 месяц']);
    expect(terms(en)).toEqual(['1 month', '2 months', '5 months', '21 months']);
    expect(types(ru)).toEqual(['потребительский кредит', 'ипотека', 'автокредит']);
    expect(types(en)).toEqual(['consumer loan', 'mortgage', 'car loan']);
    expect([ru.t('loan.wizard.title'), en.t('loan.wizard.title')]).toEqual([
      'Заявка на кредит',
      'Loan application',
    ]);
  });

  it('IM-18: сводка заявки — переводчик локали, форматтер языка и разобранный шаблон дают одну строку', () => {
    const { bundle } = build();
    fillLoanStep(bundle.model, { type: 'car', term: 21 });
    const { type, term } = bundle.model.loan;
    const templates = LOAN_APP_MESSAGES.ru;
    // Шаблон вне локали (пришёл с сервера, лежит в настройках) форматирует форматтер языка.
    const format = createMessageFormatter('ru');
    const summary = (text: (key: 'loan.summary.type' | 'loan.summary.term') => string): string =>
      `${text('loan.summary.type')} на ${text('loan.summary.term')}`;

    const translated = summary((key) => ru.t(key, { type, term }));
    expect(translated).toBe('автокредит на 21 месяц');
    expect(summary((key) => format(templates[key], { type, term }))).toBe(translated);
    expect(
      summary((key) => formatPattern(parseMessage(templates[key]), { type, term }, 'ru'))
    ).toBe(translated);
    // Множественную форму выбирает код языка, а не текст шаблона: русский шаблон под кодом `en`
    // берёт ветку `other` — поэтому загрузчик и оставляет локали запрошенный код.
    expect(createMessageFormatter('en')(templates['loan.summary.term'], { term })).toBe(
      '21 месяца'
    );
  });
});

// ─── Загрузка локалей ──────────────────────────────────────────────────────────────────────

/** «Сервер» словарей приложения на месте глобального `fetch`. */
function stubLocaleServer(options?: { manual: boolean }): LocaleServer {
  const server = createLocaleServer(options);
  vi.stubGlobal('fetch', server.fetch);
  return server;
}

/** Загрузчик приложения: тексты ядра — чанком, словарь приложения — с сервера. */
const createAppLoader = () =>
  createLocaleLoader([loadCoreLocale, fetchMessages((code) => `/locales/${code}.json`)]);

describe('загрузка локалей — ядро чанком, словарь приложения с сервера', () => {
  it('IM-19: загрузчик собирает ту же локаль, что статическая сборка; повтор — из кэша', async () => {
    const server = stubLocaleServer();
    const load = createAppLoader();
    const entries = await collectIssues();

    const [loadedRu, loadedEn] = await Promise.all([load('ru'), load('en')]);

    expect(loadedRu).toEqual(loanLocales.ru);
    expect(loadedEn).toEqual(loanLocales.en);
    for (const [loaded, ready] of [
      [loadedRu, ru],
      [loadedEn, en],
    ] as const) {
      const texts = (i18n: I18nHandle) =>
        entries.map(({ issue }) => resolveIssueMessage(issue, i18n));
      expect(texts(createI18n(loaded))).toEqual(texts(ready));
    }
    expect(await load('ru')).toBe(loadedRu);
    expect(load.peek('en')).toBe(loadedEn);
    expect(server.requested).toEqual(['/locales/ru.json', '/locales/en.json']);
  });

  it('IM-20: хранилище языка — устаревший ответ отброшен, отказ загрузки оставляет прежний язык', async () => {
    const server = stubLocaleServer({ manual: true });
    const load = createAppLoader();
    const onError = vi.fn();
    const store = createLocaleStore(load, 'ru', { onError });
    const { bundle } = build();
    await bundle.validate();
    const issue = bundle.form.loan.amount.issues.value[0];
    const shown = (): string => {
      const { locale } = store.getState();
      return locale === null ? '' : resolveIssueMessage(issue, createI18n(locale));
    };

    // Хранилище подписано на запрос раньше теста: к возврату из `await load(…)` оно уже обновлено.
    store.setLang('ru');
    server.answer('ru');
    await load('ru');
    expect(shown()).toBe('Укажите сумму кредита');

    store.setLang('en');
    store.setLang('de');
    // Ответ на английский пришёл, когда пользователь уже выбрал немецкий: он отброшен.
    server.answer('en');
    await load('en');
    expect(store.getState()).toMatchObject({ lang: 'de', pending: true, error: undefined });
    expect(shown()).toBe('Укажите сумму кредита');

    // Немецкого словаря у заявки нет: сервер отвечает 404 — загрузка языка отказала.
    server.answer('de');
    await expect(load('de')).rejects.toThrow(/404/);
    const state = store.getState();
    expect(state).toMatchObject({ lang: 'de', pending: false });
    expect(state.locale?.code).toBe('ru');
    expect(String(state.error)).toMatch(/\/locales\/de\.json.*404/);
    expect(onError).toHaveBeenCalledExactlyOnceWith(state.error, 'de');
    expect(shown()).toBe('Укажите сумму кредита');

    // Отброшенный ответ остался в кэше загрузчика: язык включается сразу и без сети.
    store.setLang('en');
    expect(store.getState()).toMatchObject({ lang: 'en', pending: false, error: undefined });
    expect(shown()).toBe('Enter the loan amount');
    expect(server.requested).toHaveLength(3);
  });
});

// ─── Тексты схемы: msg, defineMessages, resolveLocalized ───────────────────────────────────

/** `msg` с ключами английского словаря приложения: английский текст едет в описателе. */
const { msg: appMessage } = defineMessages(LOAN_APP_MESSAGES.en);

describe('тексты схемы — описатели msg раскрываются по языку', () => {
  it('IM-21: описатель defineMessages несёт английский текст — без ключа в локали показан он, а не ключ', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const title = appMessage('loan.wizard.title');
    const coreOnly = createI18n(coreRu);

    expect(title).toMatchObject({ key: 'loan.wizard.title', defaultMessage: 'Loan application' });
    expect(resolveLocalized(title, ru)).toBe('Заявка на кредит');
    expect(resolveLocalized(title, coreOnly)).toBe('Loan application');
    expect(warn).not.toHaveBeenCalled();
    // Голый `msg` без английского текста: в локали без ключа — сам ключ и предупреждение автору.
    expect(resolveLocalized(msg('loan.wizard.title'), coreOnly)).toBe('loan.wizard.title');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('IM-22: подписи полей и опций — описатели в componentProps; значение модели читается при раскрытии', () => {
    const { bundle } = build();
    const { form, model } = bundle;
    form.loan.term.updateComponentProps({
      hint: appMessage('loan.summary.term', { term: model.$.loan.term }),
    });
    form.loan.type.updateComponentProps({
      options: (['consumer', 'mortgage', 'car'] as const).map((value) => ({
        value,
        label: appMessage('loan.summary.type', { type: value }),
      })),
    });
    fillLoanStep(model, { term: 36 });
    const termProps = form.loan.term.componentProps.value;
    const typeProps = form.loan.type.componentProps.value;
    const amountProps = form.loan.amount.componentProps.value;

    expect(resolveLocalized(termProps, ru)).toEqual({ label: 'Срок, мес.', hint: '36 месяцев' });
    expect(resolveLocalized(termProps, en)).toEqual({ label: 'Срок, мес.', hint: '36 months' });
    expect(resolveLocalized(typeProps, en).options).toEqual([
      { value: 'consumer', label: 'consumer loan' },
      { value: 'mortgage', label: 'mortgage' },
      { value: 'car', label: 'car loan' },
    ]);
    model.loan.term = 21;
    expect(resolveLocalized(termProps, ru)).toMatchObject({ hint: '21 месяц' });
    // Без описателей раскрывать нечего — тот же объект пропсов.
    expect(resolveLocalized(amountProps, ru)).toBe(amountProps);
  });

  it('IM-23: текстовые узлы — сигнал-описатель раскрывается по языку и следует за моделью', () => {
    const { bundle } = build();
    const model = createLoanModel();
    const summary = compileSchema(
      {
        component: Summary,
        children: [
          computed(() => appMessage('loan.summary.type', { type: model.loan.type })),
          ' · ',
          computed(() => appMessage('loan.summary.term', { term: model.loan.term ?? 0 })),
        ],
      },
      model
    );
    const textOf = (compiled: CompiledSchema, id: string, i18n: I18nHandle): string => {
      const owner = id === '' ? compiled.root : compiled.nodes.get(id as SchemaNodeId);
      const [text] = (owner as CompiledContainerNode).children;
      if (text.kind !== 'text') throw new Error(`у узла «${id}» нет текста`);
      return text.parts
        .map((part) => String(resolveLocalized(isSignal(part) ? part.value : part, i18n)))
        .join('');
    };

    model.loan.patch({ type: 'mortgage', term: 240 });
    expect(textOf(summary, '', ru)).toBe('ипотека · 240 месяцев');
    expect(textOf(summary, '', en)).toBe('mortgage · 240 months');
    model.loan.patch({ type: 'car', term: 21 });
    expect(textOf(summary, '', ru)).toBe('автокредит · 21 месяц');

    // Текст заявки без описателей раскрытие не меняет: язык ручки на него не влияет.
    fillLoanStep(bundle.model);
    const tree = bundle.render.tree as CompiledSchema;
    expect(textOf(tree, 'loan-estimate', en)).toBe(textOf(tree, 'loan-estimate', ru));
    expect(textOf(tree, 'loan-estimate', ru)).toMatch(
      /^Ставка 15\.9% годовых, платёж .+ ₽ в месяц$/
    );
  });
});
