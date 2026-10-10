/**
 * Правила валидации заявки на кредит: по шагу на каждый шаг потока, межшаговые правила для
 * отправки и полный набор одной схемой для одностраничного варианта.
 *
 * Здесь собрано всё, чем ядро описывает проверку, — так, как это пишут в настоящей анкете:
 * - все 27 правил `@reformer/core/validators`, каждое на подходящем по смыслу поле;
 * - `cross` в корне (паспорт выдан не раньше 14 лет, платёж к доходу) и в строке (телефоны
 *   созаёмщика), в том числе на ручке массива — замечание ложится на сам массив;
 * - `validateWhen` (ипотека, работа, отдельный адрес проживания, созаёмщики);
 * - `apply` / `applyEach` с вложением: подформа в шаге, массив в подформе, подформа и массив в
 *   строке массива; `apply(...схемы)` — композиция схем в полный набор;
 * - `validateAsync` — проверка ИНН на сервере: правило передаёт `signal`, а сбой сети становится
 *   отклонённым правилом;
 * - замечание-предупреждение (`severity: 'warning'`), `params` правила и свои коды.
 *
 * Схемы — стабильные ссылки: отмена устаревших прогонов ключится по паре «модель + схема». Правила
 * с сервером собирает {@link createLoanRules} — один раз на сборку формы.
 */

import type { ValidationIssue } from '../../../../src/index';
import {
  apply,
  applyEach,
  defineValidation,
  validate,
  validateAsync,
  validateWhen,
  type AsyncRule,
  type Rule,
  type ValidationDefinition,
} from '../../../../src/form/validation/index';
import {
  email,
  fileType,
  futureDate,
  integer,
  isDate,
  isNumber,
  max,
  maxAge,
  maxDate,
  maxFileSize,
  maxFiles,
  maxLength,
  maxTotalFileSize,
  min,
  minAge,
  minDate,
  minFileSize,
  minFiles,
  minLength,
  multipleOf,
  nonNegative,
  nonZero,
  pastDate,
  pattern,
  phone,
  required,
  url,
} from '../../../../src/form/validators/index';
import type { LoanApi } from './api';
import {
  DOCUMENT_ACCEPT,
  LOAN_LIMITS,
  type Address,
  type CoBorrower,
  type Employment,
  type LoanApplication,
  type Passport,
  type Phone,
  type PreviousJob,
  type Reference,
} from './model';

/** ИНН физического лица — 12 цифр. */
const INN_PATTERN = /^\d{12}$/;

/** Платёж к доходу, %: выше — отказ, между порогами — предупреждение. */
const MAX_PAYMENT_SHARE = 50;
const HIGH_PAYMENT_SHARE = 40;

/** Минимальный взнос по ипотеке, % стоимости залога. */
const MIN_INITIAL_PAYMENT_SHARE = 15;

/** Кредит не больше этой доли стоимости залога, %. */
const MAX_LOAN_TO_VALUE = 80;

/** Паспорта РФ нынешнего образца выдают с 1 июля 1997 года. */
const PASSPORT_SINCE = new Date(1997, 6, 1);

const MEGABYTE = 1024 * 1024;

const CYRILLIC_NAME = /^[А-ЯЁа-яё -]+$/;

/** Дата через `months` месяцев от сегодняшнего дня — граница правила считается на каждый прогон. */
function monthsFromToday(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

// ─── Подформы и строки ───────────────────────────────────────────────────────────────────────

/** Адрес — одна схема на оба адреса заёмщика и на адрес созаёмщика. */
const addressRules = defineValidation<Address>(({ model }) => {
  validate(model.$.region, [required({ code: 'address.region.required' })]);
  validate(model.$.city, [required({ code: 'address.city.required' })]);
  validate(model.$.street, [required({ code: 'address.street.required' }), minLength(3)]);
  validate(model.$.postalCode, [
    required({ code: 'address.postalCode.required' }),
    pattern(/^\d{6}$/, { code: 'address.postalCode.format' }),
  ]);
});

/** Паспорт — группа внутри группы заёмщика. */
const passportRules = defineValidation<Passport>(({ model }) => {
  validate(model.$.series, [required(), pattern(/^\d{4}$/, { code: 'passport.series.format' })]);
  validate(model.$.number, [required(), pattern(/^\d{6}$/, { code: 'passport.number.format' })]);
  validate(model.$.issueDate, [
    required(),
    isDate(),
    pastDate(),
    minDate(PASSPORT_SINCE, { code: 'passport.issueDate.min' }),
  ]);
  validate(model.$.issuedBy, [required(), minLength(10), maxLength(200)]);
});

/** Прежнее место работы — строка массива внутри подформы занятости. */
const previousJobRules = defineValidation<PreviousJob>(({ model }) => {
  validate(model.$.company, [required({ code: 'previousJob.company.required' })]);
  validate(model.$.years, [required(), integer(), nonNegative(), max(60)]);
});

/** Занятость — подформа: работодатель нужен, только если заёмщик работает. */
const employmentRules = defineValidation<Employment>(({ model }) => {
  validate(model.$.status, [required()]);
  validateWhen(
    () => model.status !== 'unemployed',
    () => {
      validate(model.$.companyName, [required({ code: 'employment.companyName.required' })]);
      validate(model.$.position, [required({ code: 'employment.position.required' })]);
      validate(model.$.companySite, [url({ code: 'employment.companySite.url' })]);
      validate(model.$.monthlyIncome, [
        required({ code: 'employment.monthlyIncome.required' }),
        min(10_000, { code: 'employment.monthlyIncome.min' }),
      ]);
    }
  );
  applyEach(model.$.previousJobs, previousJobRules);
});

/** Телефон созаёмщика — строка вложенного массива. */
const phoneRules = defineValidation<Phone>(({ model }) => {
  validate(model.$.number, [required(), phone({ format: 'ru' })]);
});

/** Телефон обязателен тому созаёмщику, кто живёт отдельно: замечание — на массиве телефонов. */
const phonesForSeparateHousehold = (row: CoBorrower): ValidationIssue | null =>
  !row.livesWithApplicant && row.phones.length === 0
    ? { code: 'coBorrower.phones.required' }
    : null;

/** Созаёмщик — строка массива: свой адрес (подформа) и свои телефоны (вложенный массив). */
const coBorrowerRules = defineValidation<CoBorrower>(({ model, cross }) => {
  validate(model.$.fullName, [required({ code: 'coBorrower.fullName.required' }), minLength(5)]);
  validate(model.$.relation, [required({ code: 'coBorrower.relation.required' })]);
  validate(model.$.monthlyIncome, [
    required({ code: 'coBorrower.monthlyIncome.required' }),
    min(10_000, { code: 'coBorrower.monthlyIncome.min' }),
  ]);
  validate(model.$.share, [min(1, { code: 'coBorrower.share.min' }), max(100)]);
  applyEach(model.$.phones, phoneRules);
  cross(model.$.phones, phonesForSeparateHousehold);
  validateWhen(
    () => !model.livesWithApplicant,
    () => apply(model.$.address, addressRules)
  );
});

/** Рекомендатель — строка массива, шаблон которой дала схема. */
const referenceRules = defineValidation<Reference>(({ model }) => {
  validate(model.$.name, [required(), minLength(3)]);
  validate(model.$.phone, [required(), phone({ format: 'ru' })]);
});

// ─── Шаги ───────────────────────────────────────────────────────────────────────────────────

/** Взнос в пределах стоимости залога и не меньше минимальной доли. */
const initialPaymentWithinValue = (application: LoanApplication): ValidationIssue | null => {
  const { propertyValue, initialPayment } = application.loan;
  if (propertyValue === null || initialPayment === null) return null;
  if (initialPayment > propertyValue) {
    return { code: 'loan.initialPayment.tooHigh', params: { propertyValue } };
  }
  if (initialPayment < (propertyValue * MIN_INITIAL_PAYMENT_SHARE) / 100) {
    return { code: 'loan.initialPayment.tooLow', params: { minShare: MIN_INITIAL_PAYMENT_SHARE } };
  }
  return null;
};

/**
 * Взнос по ипотеке — отдельной схемой: её же запускает поведение, когда меняется стоимость залога
 * (`revalidateWhen`), поэтому условие «только ипотека» схема несёт сама.
 */
const initialPaymentRules = defineValidation<LoanApplication>(({ model, cross }) => {
  validateWhen(
    () => model.loan.type === 'mortgage',
    () => {
      validate(model.$.loan.initialPayment, [
        required({ code: 'loan.initialPayment.required' }),
        nonZero(),
      ]);
      cross(model.$.loan.initialPayment, initialPaymentWithinValue);
    }
  );
});

/** Шаг «Кредит»: пределы суммы и граница даты первого платежа считаются на каждый прогон. */
const loanRules = defineValidation<LoanApplication>(({ model }) => {
  const limits = LOAN_LIMITS[model.loan.type];
  validate(model.$.loan.type, [required({ code: 'loan.type.required' })]);
  validate(model.$.loan.amount, [
    required({ code: 'loan.amount.required' }),
    isNumber(),
    min(limits.min, { code: 'loan.amount.min' }),
    max(limits.max, { code: 'loan.amount.max', params: { loanType: model.loan.type } }),
    multipleOf(1000, { code: 'loan.amount.step' }),
  ]);
  validate(model.$.loan.term, [
    required({ code: 'loan.term.required' }),
    integer(),
    min(6, { code: 'loan.term.min' }),
    max(360, { code: 'loan.term.max' }),
  ]);
  validate(model.$.loan.purpose, [required(), minLength(10), maxLength(200)]);
  validate(model.$.loan.firstPaymentDate, [
    required(),
    isDate(),
    futureDate(),
    maxDate(monthsFromToday(3), { code: 'loan.firstPaymentDate.max' }),
  ]);
  validate(model.$.loan.promoCode, [
    pattern(/^[A-Z0-9]{4,12}$/, { code: 'loan.promoCode.format' }),
  ]);
  validateWhen(
    () => model.loan.type === 'mortgage',
    () => {
      validate(model.$.loan.propertyValue, [
        required({ code: 'loan.propertyValue.required' }),
        min(1_000_000, { code: 'loan.propertyValue.min' }),
      ]);
      apply(initialPaymentRules);
    }
  );
});

/** Паспорт выдают с 14 лет: дата выдачи раньше 14-летия — ошибка в одной из дат. */
const passportIssuedAfterFourteen = (application: LoanApplication): ValidationIssue | null => {
  const { birthDate, passport } = application.applicant;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(passport.issueDate)) {
    return null;
  }
  // Даты `YYYY-MM-DD` сравниваются строками: 14-летие — тот же день через 14 лет.
  const fourteenth = `${Number(birthDate.slice(0, 4)) + 14}${birthDate.slice(4)}`;
  return passport.issueDate < fourteenth ? { code: 'applicant.passport.issuedTooEarly' } : null;
};

/**
 * ИНН есть в реестре налоговой — спрашиваем сервер. Неполный ИНН проверяет `pattern`, на сервер
 * он не уходит. Сбой сети правило не ловит: проверка без ответа — это отклонённое правило
 * (`ruleFailed`), а не «ИНН в порядке».
 */
const innRegistered =
  (server: LoanApi): AsyncRule<string> =>
  async (inn, { signal }) => {
    if (!INN_PATTERN.test(inn)) return null;
    const { status } = await server.checkInn(inn, signal);
    return status === 'found' ? null : { code: 'applicant.inn.notFound', params: { inn } };
  };

const NAME_RULES: Rule<string>[] = [
  required(),
  minLength(2),
  maxLength(50),
  pattern(CYRILLIC_NAME, { code: 'name.cyrillic' }),
];

/** Шаг «Заёмщик». */
const applicantRulesWith = (server: LoanApi): ValidationDefinition<LoanApplication> =>
  defineValidation<LoanApplication>(({ model, cross }) => {
    const { applicant } = model.$;
    validate(applicant.lastName, NAME_RULES);
    validate(applicant.firstName, NAME_RULES);
    validate(applicant.middleName, [
      maxLength(50),
      pattern(CYRILLIC_NAME, { code: 'name.cyrillic' }),
    ]);
    validate(applicant.birthDate, [
      required({ code: 'applicant.birthDate.required' }),
      isDate(),
      pastDate(),
      minAge(18, { code: 'applicant.birthDate.minAge' }),
      maxAge(75, { code: 'applicant.birthDate.maxAge' }),
    ]);
    validate(applicant.inn, [
      required({ code: 'applicant.inn.required' }),
      pattern(INN_PATTERN, { code: 'applicant.inn.format' }),
    ]);
    validateAsync(applicant.inn, [innRegistered(server)]);
    apply(applicant.passport, passportRules);
    cross(applicant.passport.issueDate, passportIssuedAfterFourteen);
  });

/** Шаг «Контакты»: адрес проживания проверяется, только если он отдельный. */
const contactsRules = defineValidation<LoanApplication>(({ model }) => {
  validate(model.$.phone, [required({ code: 'phone.required' }), phone({ format: 'ru' })]);
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
  apply(model.$.registrationAddress, addressRules);
  validateWhen(
    () => !model.sameAsRegistration,
    () => apply(model.$.residenceAddress, addressRules)
  );
});

/** Шаг «Работа»: занятость — подформа со своим массивом. */
const employmentStepRules = defineValidation<LoanApplication>(({ model }) => {
  apply(model.$.employment, employmentRules);
});

/** Отмечены созаёмщики, а список пуст. */
const coBorrowersListed = (application: LoanApplication): ValidationIssue | null =>
  application.coBorrowers.length === 0 ? { code: 'coBorrowers.empty' } : null;

/** Шаг «Семья и созаёмщики». */
const coBorrowersRules = defineValidation<LoanApplication>(({ model, cross }) => {
  validate(model.$.dependents, [required(), integer(), nonNegative(), max(10)]);
  validateWhen(
    () => model.hasCoBorrowers,
    () => {
      cross(model.$.hasCoBorrowers, coBorrowersListed);
      applyEach(model.$.coBorrowers, coBorrowerRules);
    }
  );
});

/** Документы: паспорт и справка о доходах — изображения или PDF. */
const DOCUMENT_RULES: Rule<File[] | null>[] = [
  required({ code: 'documents.required' }),
  minFiles(2, { code: 'documents.minFiles' }),
  maxFiles(5),
  fileType(DOCUMENT_ACCEPT),
  minFileSize(1),
  maxFileSize(10 * MEGABYTE),
  maxTotalFileSize(20 * MEGABYTE),
];

/** Шаг «Документы и согласия». */
const documentsRules = defineValidation<LoanApplication>(({ model }) => {
  const { consent } = model.$;
  validate(model.$.documents, DOCUMENT_RULES);
  validate(model.$.interests, [maxLength(3, { code: 'interests.tooMany' })]);
  applyEach(model.$.references, referenceRules);
  validate(consent.personalData, [required({ code: 'consent.personalData.required' })]);
  validate(consent.creditBureau, [required({ code: 'consent.creditBureau.required' })]);
  validate(consent.smsPhone, [
    required({ code: 'consent.smsPhone.required' }),
    phone({ format: 'ru' }),
  ]);
  validateWhen(
    () => model.consent.notifyByEmail,
    () => validate(consent.notificationEmail, [required(), email()])
  );
});

// ─── Межшаговые правила ──────────────────────────────────────────────────────────────────────

/** Платёж не больше половины дохода семьи — отказ. */
const paymentWithinIncome = (application: LoanApplication): ValidationIssue | null =>
  application.paymentToIncomeRatio > MAX_PAYMENT_SHARE
    ? {
        code: 'loan.paymentTooHigh',
        params: { ratio: application.paymentToIncomeRatio, limit: MAX_PAYMENT_SHARE },
      }
    : null;

/** Высокая, но допустимая нагрузка — предупреждение, отправку не держит. */
const warnHighDebtLoad = (application: LoanApplication): ValidationIssue | null =>
  application.paymentToIncomeRatio > HIGH_PAYMENT_SHARE &&
  application.paymentToIncomeRatio <= MAX_PAYMENT_SHARE
    ? {
        code: 'loan.highDebtLoad',
        severity: 'warning',
        params: { ratio: application.paymentToIncomeRatio },
      }
    : null;

/**
 * Залог покрывает кредит. Условия «только ипотека» у правила нет намеренно: вне ипотеки поле
 * залога выключено поведением (`enableWhen`), а проверка формы замечаний выключенных полей не
 * учитывает — на этом контракте ядра правило и держится.
 */
const collateralCoversLoan = (application: LoanApplication): ValidationIssue | null =>
  (application.loan.amount ?? 0) > ((application.loan.propertyValue ?? 0) * MAX_LOAN_TO_VALUE) / 100
    ? { code: 'loan.collateralTooLow', params: { maxShare: MAX_LOAN_TO_VALUE } }
    : null;

/** Правила вне шагов (`extras`): данные нескольких шагов сразу, проверяются при отправке. */
const crossStepRules = defineValidation<LoanApplication>(({ model, cross }) => {
  cross(model.$.loan.amount, paymentWithinIncome);
  cross(model.$.loan.amount, warnHighDebtLoad);
  cross(model.$.loan.propertyValue, collateralCoversLoan);
});

// ─── Сборка ─────────────────────────────────────────────────────────────────────────────────

/** Правила одной сборки заявки. */
export interface LoanRules {
  readonly loan: ValidationDefinition<LoanApplication>;
  readonly applicant: ValidationDefinition<LoanApplication>;
  readonly contacts: ValidationDefinition<LoanApplication>;
  readonly employment: ValidationDefinition<LoanApplication>;
  readonly coBorrowers: ValidationDefinition<LoanApplication>;
  readonly documents: ValidationDefinition<LoanApplication>;
  /** Межшаговые правила — `extras` сборки. */
  readonly crossStep: ValidationDefinition<LoanApplication>;
  /** Взнос по ипотеке — его перепроверяет поведение при смене стоимости залога. */
  readonly initialPayment: ValidationDefinition<LoanApplication>;
  /** Полный набор одной схемой — композиция `apply(...схемы)` для варианта без потока. */
  readonly all: ValidationDefinition<LoanApplication>;
}

/**
 * Правила заявки для одной сборки: проверка ИНН ходит в переданный сервер.
 *
 * @param server - API заявки (заглушка из `api.ts`).
 */
export function createLoanRules(server: LoanApi): LoanRules {
  const applicant = applicantRulesWith(server);
  return {
    loan: loanRules,
    applicant,
    contacts: contactsRules,
    employment: employmentStepRules,
    coBorrowers: coBorrowersRules,
    documents: documentsRules,
    crossStep: crossStepRules,
    initialPayment: initialPaymentRules,
    all: defineValidation<LoanApplication>(() =>
      apply(
        loanRules,
        applicant,
        contactsRules,
        employmentStepRules,
        coBorrowersRules,
        documentsRules,
        crossStepRules
      )
    ),
  };
}
