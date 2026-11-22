/**
 * Генераторы fast-check для заявки на кредит: случайная ВЕРНАЯ заявка, запись её шагов в модель
 * так, как их ввёл бы пользователь, и случайный частичный черновик для `patch`.
 *
 * Верность заявки — построением, а не фильтром: каждое поле берётся из множества, которое проходит
 * его правила (`validation.ts`), а межполевые условия собираются явно:
 * - сумма — в пределах вида кредита и кратна 1000; у ипотеки залог от 1 млн ₽, кредит не больше
 *   80 % залога, взнос — от 15 % до всей стоимости залога; промокод у ипотеки пуст (его стирает
 *   поведение);
 * - паспорт выдан не раньше 14-летия, не раньше 1 июля 1997 года и не позже вчерашнего дня;
 * - платёж — не больше трети дохода семьи: нагрузка далеко от порога предупреждения, и в верной
 *   заявке нет даже предупреждений (доход добирается до нужного после генерации);
 * - доли созаёмщиков до последнего — от 1 % и в сумме не больше 99 %: долю последнего досчитывает
 *   форма (`aggregateInto`); основной контакт — не больше одного;
 * - отдельно живущему созаёмщику — адрес и хотя бы один телефон.
 *
 * Даты задаются смещением от «сегодня» в момент генерации и пишутся строкой `YYYY-MM-DD`, как в
 * `actions.ts`. Файлы документов создаются при записи в модель, а не при генерации.
 */

import fc from 'fast-check';
import type { DeepPartial, FormModel } from '../../../../src/index';
import { daysFromToday, documentFile } from './actions';
import { annuityPayment } from './behavior';
import type { LoanStepId } from './flow';
import {
  LOAN_LIMITS,
  blankAddress,
  type Address,
  type Applicant,
  type CoBorrower,
  type Employment,
  type LoanApplication,
  type LoanTerms,
  type LoanType,
  type PreviousJob,
  type Reference,
} from './model';

// ─── Типы сгенерированной заявки ──────────────────────────────────────────────────────────

/** Созаёмщик сгенерированной заявки: доход указан всегда, телефоны — номерами. */
interface GeneratedCoBorrower extends Omit<CoBorrower, 'phones' | 'monthlyIncome'> {
  readonly monthlyIncome: number;
  readonly phones: readonly string[];
}

/** Документ сгенерированной заявки: файл создаётся при записи в модель. */
interface GeneratedDocument {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

/**
 * Верная заявка — то, что пользователь вводит по шагам. Производных полей, номера заявки и полей,
 * которые заполняет поведение (телефон и почта согласий), здесь нет.
 */
export interface GeneratedApplication {
  readonly loan: Omit<LoanTerms, 'interestRate' | 'monthlyPayment'>;
  readonly applicant: Omit<Applicant, 'fullName'>;
  readonly phone: string;
  readonly email: string;
  readonly registrationAddress: Address;
  readonly sameAsRegistration: boolean;
  /** Адрес проживания; при `sameAsRegistration` — пустой, его копирует поведение. */
  readonly residenceAddress: Address;
  readonly employment: Employment;
  readonly dependents: number;
  readonly hasCoBorrowers: boolean;
  readonly coBorrowers: readonly GeneratedCoBorrower[];
  readonly documents: readonly GeneratedDocument[];
  readonly interests: LoanApplication['interests'];
  readonly references: readonly Reference[];
  readonly notifyByEmail: boolean;
}

// ─── Даты ─────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Паспорта РФ нынешнего образца выдают с 1 июля 1997 года (то же, что в правилах). */
const PASSPORT_SINCE = new Date(1997, 6, 1);

/** Полночь даты по местному времени. */
function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Дата `YYYY-MM-DD` по местному времени — в таком виде её отдаёт поле даты. */
function isoDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Сегодня со сдвигом на `years` лет и `days` дней (полночь). */
function shiftedToday(years: number, days: number): Date {
  const date = startOfDay(new Date());
  date.setFullYear(date.getFullYear() + years);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Дата выдачи паспорта: между 14-летием (и 1 июля 1997 года) и вчерашним днём. `fraction` от 0 до 1
 * выбирает день в этом окне — сжатие ведёт к самой ранней допустимой дате.
 */
function passportIssueDate(birth: Date, fraction: number): Date {
  const fourteenth = new Date(birth);
  fourteenth.setFullYear(birth.getFullYear() + 14);
  const from = new Date(Math.max(fourteenth.getTime(), PASSPORT_SINCE.getTime()));
  const span = Math.floor((shiftedToday(0, -1).getTime() - from.getTime()) / DAY_MS);
  const issue = new Date(from);
  issue.setDate(issue.getDate() + Math.round(Math.max(0, span) * fraction));
  return issue;
}

// ─── Поля ─────────────────────────────────────────────────────────────────────────────────

const digit = fc.constantFrom(...'0123456789');

/** Строка из `length` цифр. */
const digits = (length: number): fc.Arbitrary<string> =>
  fc.string({ unit: digit, minLength: length, maxLength: length });

/** Слово кириллицей с заглавной — фамилия, имя, отчество. */
const cyrillicWord = fc.stringMatching(/^[А-ЯЁ][а-яё]{1,19}$/);

/**
 * Телефон, который проходит `phone({ format: 'ru' })` и после нормализации для кода подписи
 * (`+7 (900) 123-45-67` → `+79001234567`): префикс, код оператора на 4, 8 или 9 и разные записи.
 */
const ruPhoneArb: fc.Arbitrary<string> = fc
  .record({
    prefix: fc.constantFrom('+7', '8', '7'),
    operator: fc
      .tuple(fc.constantFrom('4', '8', '9'), digits(2))
      .map(([first, rest]) => first + rest),
    subscriber: digits(7),
    format: fc.constantFrom('brackets', 'compact', 'spaces'),
  })
  .map(({ prefix, operator, subscriber, format }) => {
    const [head, middle, tail] = [
      subscriber.slice(0, 3),
      subscriber.slice(3, 5),
      subscriber.slice(5),
    ];
    if (format === 'brackets') return `${prefix} (${operator}) ${head}-${middle}-${tail}`;
    if (format === 'compact') return `${prefix}${operator}${head}${middle}${tail}`;
    return `${prefix} ${operator} ${head} ${middle} ${tail}`;
  });

/** Почта, которая проходит `email()` и в нижнем регистре (копия для уведомлений). */
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,15}$/),
    fc.stringMatching(/^[a-z0-9-]{1,15}$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([local, domain, zone]) => `${local}@${domain}.${zone}`);

/**
 * Сайт работодателя, который проходит `url()`: с протоколом и без. Метка домена — буквы, цифры и
 * дефис не по краям, как в DNS [ReFormer-4srm].
 */
const siteArb = fc
  .tuple(
    fc.constantFrom('', 'http://', 'https://'),
    fc.stringMatching(/^[a-z0-9](?:[a-z0-9-]{0,18}[a-z0-9])?$/),
    fc.stringMatching(/^[a-z]{2,6}$/)
  )
  .map(([protocol, name, zone]) => `${protocol}${name}.${zone}`);

const addressArb: fc.Arbitrary<Address> = fc.record({
  region: fc.constantFrom('Москва', 'Московская область', 'Санкт-Петербург'),
  city: fc.constantFrom('Москва', 'Зеленоград', 'Химки', 'Колпино'),
  street: fc.string({ minLength: 3, maxLength: 60 }),
  postalCode: digits(6),
});

const previousJobArb: fc.Arbitrary<PreviousJob> = fc.record({
  company: fc.string({ minLength: 1, maxLength: 40 }),
  years: fc.integer({ min: 0, max: 60 }),
});

const referenceArb: fc.Arbitrary<Reference> = fc.record({
  name: fc.string({ minLength: 3, maxLength: 40 }),
  phone: ruPhoneArb,
});

const INTERESTS: LoanApplication['interests'] = ['deposit', 'card', 'insurance', 'investments'];

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

// ─── Шаги ─────────────────────────────────────────────────────────────────────────────────

/** Доля диапазона от 0 до 1: сжатие ведёт к нижней границе. */
const fractionArb = fc
  .integer({ min: 0, max: 1_000_000 })
  .map((millionths) => millionths / 1_000_000);

/** Целое в диапазоне по доле: 0 — нижняя граница, 1 — верхняя. */
const within = (min: number, max: number, fraction: number): number =>
  min + Math.round((max - min) * fraction);

/**
 * Условия кредита по виду: пределы суммы, у ипотеки — залог и взнос. Сумма и взнос заданы долей
 * своего диапазона, а не `chain` по виду кредита: границы зависят от вида и залога, а генераторы
 * строятся один раз.
 */
const loanArb: fc.Arbitrary<GeneratedApplication['loan']> = fc
  .record({
    type: fc.constantFrom<LoanType>('consumer', 'mortgage', 'car'),
    term: fc.integer({ min: 6, max: 360 }),
    purpose: fc.string({ minLength: 10, maxLength: 200 }),
    firstPaymentInDays: fc.integer({ min: 1, max: 85 }),
    promoCode: fc.oneof(fc.constant(''), fc.stringMatching(/^[A-Z0-9]{4,12}$/)),
    amountAt: fractionArb,
    propertyThousands: fc.integer({ min: 1_000, max: 50_000 }),
    initialPaymentAt: fractionArb,
  })
  .map(
    ({
      type,
      firstPaymentInDays,
      promoCode,
      amountAt,
      propertyThousands,
      initialPaymentAt,
      ...terms
    }) => {
      const limits = LOAN_LIMITS[type];
      const firstPaymentDate = daysFromToday(firstPaymentInDays);
      if (type !== 'mortgage') {
        const amount = within(limits.min / 1000, limits.max / 1000, amountAt) * 1000;
        return {
          ...terms,
          type,
          amount,
          firstPaymentDate,
          promoCode,
          propertyValue: null,
          initialPayment: null,
        };
      }
      const propertyValue = propertyThousands * 1000;
      const maxAmount = Math.min(limits.max, Math.floor((propertyValue * 0.8) / 1000) * 1000);
      return {
        ...terms,
        type,
        amount: within(limits.min / 1000, maxAmount / 1000, amountAt) * 1000,
        firstPaymentDate,
        promoCode: '',
        propertyValue,
        initialPayment: within(Math.ceil(propertyValue * 0.15), propertyValue, initialPaymentAt),
      };
    }
  );

/** Заёмщик: имя кириллицей, возраст от 18 до 74, паспорт выдан после 14-летия. */
const applicantArb: fc.Arbitrary<GeneratedApplication['applicant']> = fc
  .record({
    lastName: cyrillicWord,
    firstName: cyrillicWord,
    middleName: fc.oneof(fc.constant(''), cyrillicWord),
    age: fc.integer({ min: 18, max: 74 }),
    // Хотя бы день сверх полных лет: 29 февраля «N лет назад» выпадает на 1 марта, и без запаса
    // заёмщику ровно в день проверки не хватило бы дня до 18 лет.
    extraDays: fc.integer({ min: 1, max: 300 }),
    inn: digits(12),
    series: digits(4),
    number: digits(6),
    issuedBy: fc.string({ minLength: 10, maxLength: 200 }),
    issuedAt: fc.integer({ min: 0, max: 1000 }),
  })
  .map(({ age, extraDays, series, number, issuedBy, issuedAt, ...names }) => {
    const birth = shiftedToday(-age, -extraDays);
    const issueDate = isoDate(passportIssueDate(birth, issuedAt / 1000));
    return {
      ...names,
      birthDate: isoDate(birth),
      passport: { series, number, issueDate, issuedBy },
    };
  });

/** Занятость: работающему — работодатель и доход, без работы — пустые поля работодателя. */
const employmentArb: fc.Arbitrary<Employment> = fc.oneof(
  fc.record({
    status: fc.constantFrom('employed' as const, 'self-employed' as const),
    companyName: fc.string({ minLength: 1, maxLength: 60 }),
    position: fc.string({ minLength: 1, maxLength: 60 }),
    companySite: fc.oneof(fc.constant(''), siteArb),
    monthlyIncome: fc.integer({ min: 10_000, max: 2_000_000 }),
    previousJobs: fc.array(previousJobArb, { maxLength: 3 }),
  }),
  fc.array(previousJobArb, { maxLength: 3 }).map(
    (previousJobs): Employment => ({
      status: 'unemployed',
      companyName: '',
      position: '',
      companySite: '',
      monthlyIncome: null,
      previousJobs,
    })
  )
);

/** Созаёмщик: отдельно живущему — адрес и телефон, живущему с заёмщиком телефоны не обязательны. */
const coBorrowerArb: fc.Arbitrary<GeneratedCoBorrower> = fc
  .record({
    lastName: cyrillicWord,
    firstName: cyrillicWord,
    relation: fc.constantFrom(
      'spouse' as const,
      'parent' as const,
      'child' as const,
      'other' as const
    ),
    monthlyIncome: fc.integer({ min: 10_000, max: 1_000_000 }),
    share: fc.integer({ min: 1, max: 33 }),
    livesWithApplicant: fc.boolean(),
    address: addressArb,
    phones: fc.array(ruPhoneArb, { minLength: 1, maxLength: 2 }),
    dropPhones: fc.boolean(),
  })
  .map(({ lastName, firstName, address, phones, dropPhones, livesWithApplicant, ...row }) => ({
    ...row,
    fullName: `${lastName} ${firstName}`,
    isPrimaryContact: false,
    livesWithApplicant,
    address: livesWithApplicant ? blankAddress() : address,
    phones: livesWithApplicant && dropPhones ? [] : phones,
  }));

/** Созаёмщики: есть ли они, сами строки и кто основной контакт (не больше одного). */
const coBorrowersArb = fc.oneof(
  fc.constant({ hasCoBorrowers: false, coBorrowers: [] as GeneratedCoBorrower[] }),
  fc
    .tuple(
      fc.array(coBorrowerArb, { minLength: 1, maxLength: 3 }),
      fc.option(fc.nat({ max: 2 }), { nil: undefined })
    )
    .map(([rows, primary]) => ({
      hasCoBorrowers: true,
      coBorrowers: rows.map((row, index) => ({
        ...row,
        isPrimaryContact: primary !== undefined && index === primary % rows.length,
      })),
    }))
);

/** Документы: от двух до пяти изображений или PDF, каждый — до 300 КБ. */
const documentsArb: fc.Arbitrary<GeneratedDocument[]> = fc
  .array(
    fc.record({
      extension: fc.constantFrom('pdf', 'jpg', 'png'),
      size: fc.integer({ min: 1, max: 300_000 }),
    }),
    { minLength: 2, maxLength: 5 }
  )
  .map((files) =>
    files.map(({ extension, size }, index) => ({
      name: `документ-${index + 1}.${extension}`,
      size,
      type: MIME_BY_EXTENSION[extension],
    }))
  );

/**
 * Доход семьи — не меньше трёх платежей. Верхняя граница платежа считается по ставке 17 % (у заявки
 * не больше 16,9 %), поэтому нагрузка не выше 33 % при любой ставке. Без работы и без созаёмщиков
 * дохода нет, а нагрузка по правилам заявки — 0 %.
 */
function withAffordablePayment(application: GeneratedApplication): GeneratedApplication {
  const required = Math.ceil(
    3 * annuityPayment(application.loan.amount, application.loan.term, 17)
  );
  const others = application.coBorrowers.reduce((sum, row) => sum + row.monthlyIncome, 0);
  if (application.employment.status !== 'unemployed') {
    const income = Math.max(application.employment.monthlyIncome ?? 0, required - others);
    return { ...application, employment: { ...application.employment, monthlyIncome: income } };
  }
  const [first, ...rest] = application.coBorrowers;
  if (first === undefined) return application;
  const income = first.monthlyIncome + Math.max(0, required - others);
  return { ...application, coBorrowers: [{ ...first, monthlyIncome: income }, ...rest] };
}

/** Случайная верная заявка: проходит правила каждого шага и межшаговые правила без замечаний. */
export const validApplicationArb: fc.Arbitrary<GeneratedApplication> = fc
  .record({
    loan: loanArb,
    applicant: applicantArb,
    phone: ruPhoneArb,
    email: emailArb,
    registrationAddress: addressArb,
    sameAsRegistration: fc.boolean(),
    residenceAddress: addressArb,
    employment: employmentArb,
    dependents: fc.integer({ min: 0, max: 10 }),
    coBorrowers: coBorrowersArb,
    documents: documentsArb,
    interests: fc.subarray(INTERESTS, { maxLength: 3 }),
    references: fc.array(referenceArb, { maxLength: 2 }),
    notifyByEmail: fc.boolean(),
  })
  .map(({ coBorrowers, sameAsRegistration, residenceAddress, ...application }) =>
    withAffordablePayment({
      ...application,
      ...coBorrowers,
      sameAsRegistration,
      residenceAddress: sameAsRegistration ? blankAddress() : residenceAddress,
    })
  );

/**
 * Записать шаг сгенерированной заявки в модель — как пользователь: поля шага, «Добавить» в
 * массивах и ввод в новую строку. Отложенные записи поведения дожидается сценарий.
 */
export function fillGeneratedStep(
  model: FormModel<LoanApplication>,
  application: GeneratedApplication,
  step: LoanStepId
): void {
  switch (step) {
    case 'loan':
      model.loan.patch(application.loan);
      return;
    case 'applicant':
      model.applicant.patch(application.applicant);
      return;
    case 'contacts':
      model.patch({
        phone: application.phone,
        email: application.email,
        registrationAddress: application.registrationAddress,
        sameAsRegistration: application.sameAsRegistration,
        ...(application.sameAsRegistration
          ? {}
          : { residenceAddress: application.residenceAddress }),
      });
      return;
    case 'employment': {
      const { previousJobs, ...employer } = application.employment;
      model.employment.patch(employer);
      for (const job of previousJobs) model.employment.previousJobs.push(job);
      return;
    }
    case 'co-borrowers':
      model.dependents = application.dependents;
      model.hasCoBorrowers = application.hasCoBorrowers;
      for (const { phones, address, ...row } of application.coBorrowers) {
        model.coBorrowers.push();
        const added = model.coBorrowers.at(model.coBorrowers.length - 1);
        added.patch({ ...row, ...(row.livesWithApplicant ? {} : { address }) });
        for (const number of phones) {
          added.phones.push();
          added.phones.at(added.phones.length - 1).number = number;
        }
      }
      return;
    case 'documents':
      model.$.documents.value = application.documents.map(({ name, size, type }) =>
        documentFile(name, size, type)
      );
      model.$.interests.value = [...application.interests];
      for (const reference of application.references) model.references.push(reference);
      model.consent.patch({
        personalData: true,
        creditBureau: true,
        notifyByEmail: application.notifyByEmail,
      });
      return;
    case 'review':
      return;
  }
}

// ─── Черновик ─────────────────────────────────────────────────────────────────────────────

const optionalNumber = (min: number, max: number): fc.Arbitrary<number | null> =>
  fc.option(fc.integer({ min, max }), { nil: null });

/** Строка-дата: верная, несуществующая или не дата — черновик правилам не обязан. */
const dateLikeArb = fc.oneof(
  fc.integer({ min: -30_000, max: 400 }).map((days) => daysFromToday(days)),
  fc.constantFrom('', '2001-02-30', 'вчера')
);

const partialAddressArb = fc.record(
  {
    region: fc.string({ maxLength: 20 }),
    city: fc.string({ maxLength: 20 }),
    street: fc.string({ maxLength: 40 }),
    postalCode: fc.string({ maxLength: 8 }),
  },
  { requiredKeys: [] }
);

/** Созаёмщик черновика — строка целиком: массив в `patch` заменяется значением как есть. */
const draftCoBorrowerArb: fc.Arbitrary<CoBorrower> = coBorrowerArb.map(({ phones, ...row }) => ({
  ...row,
  phones: phones.map((number) => ({ number })),
}));

/**
 * Случайный частичный черновик заявки — то, что приходит с сервера или из сохранённого черновика:
 * любой набор ключей любой глубины, значения не обязаны проходить правила. В черновик попадают и
 * поля, которыми владеет форма: производные поля `compute` и номер заявки (`markServerOwned`).
 */
export const loanDraftArb: fc.Arbitrary<DeepPartial<LoanApplication>> = fc.record(
  {
    applicationNumber: fc.stringMatching(/^ЗК-\d{6}$/),
    loan: fc.record(
      {
        type: fc.constantFrom<LoanType>('consumer', 'mortgage', 'car'),
        amount: optionalNumber(0, 40_000_000),
        term: optionalNumber(1, 400),
        purpose: fc.string({ maxLength: 40 }),
        firstPaymentDate: dateLikeArb,
        promoCode: fc.string({ maxLength: 14 }),
        propertyValue: optionalNumber(0, 60_000_000),
        initialPayment: optionalNumber(0, 60_000_000),
        interestRate: fc.integer({ min: 0, max: 40 }),
        monthlyPayment: fc.integer({ min: 0, max: 5_000_000 }),
      },
      { requiredKeys: [] }
    ),
    applicant: fc.record(
      {
        lastName: fc.string({ maxLength: 20 }),
        firstName: fc.string({ maxLength: 20 }),
        middleName: fc.string({ maxLength: 20 }),
        fullName: fc.string({ maxLength: 40 }),
        birthDate: dateLikeArb,
        inn: fc.string({ maxLength: 14 }),
        passport: fc.record(
          {
            series: fc.string({ maxLength: 6 }),
            number: fc.string({ maxLength: 8 }),
            issueDate: dateLikeArb,
            issuedBy: fc.string({ maxLength: 40 }),
          },
          { requiredKeys: [] }
        ),
      },
      { requiredKeys: [] }
    ),
    phone: fc.oneof(ruPhoneArb, fc.string({ maxLength: 12 })),
    email: fc.oneof(emailArb, fc.string({ maxLength: 12 })),
    registrationAddress: partialAddressArb,
    sameAsRegistration: fc.boolean(),
    residenceAddress: partialAddressArb,
    employment: fc.record(
      {
        status: fc.constantFrom<Employment['status']>('employed', 'self-employed', 'unemployed'),
        companyName: fc.string({ maxLength: 20 }),
        position: fc.string({ maxLength: 20 }),
        companySite: fc.string({ maxLength: 20 }),
        monthlyIncome: optionalNumber(0, 1_000_000),
        previousJobs: fc.array(previousJobArb, { maxLength: 2 }),
      },
      { requiredKeys: [] }
    ),
    dependents: optionalNumber(-1, 12),
    hasCoBorrowers: fc.boolean(),
    coBorrowers: fc.array(draftCoBorrowerArb, { maxLength: 2 }),
    totalIncome: fc.integer({ min: 0, max: 5_000_000 }),
    paymentToIncomeRatio: fc.integer({ min: 0, max: 200 }),
    interests: fc.subarray(INTERESTS),
    references: fc.array(referenceArb, { maxLength: 2 }),
    consent: fc.record(
      {
        personalData: fc.boolean(),
        creditBureau: fc.boolean(),
        smsPhone: fc.oneof(ruPhoneArb, fc.string({ maxLength: 12 })),
        notifyByEmail: fc.boolean(),
        notificationEmail: fc.oneof(emailArb, fc.string({ maxLength: 12 })),
      },
      { requiredKeys: [] }
    ),
  },
  { requiredKeys: [] }
);

/** Пути полей, которыми владеет форма (по алфавиту): цели `compute` / `computeFrom` и поле сервера. */
export const OWNED_FIELD_PATHS: readonly string[] = [
  'applicant.fullName',
  'applicationNumber',
  'loan.interestRate',
  'loan.monthlyPayment',
  'paymentToIncomeRatio',
  'totalIncome',
];

/**
 * Черновик или значения заявки без полей, которыми владеет форма (`OWNED_FIELD_PATHS`), — то, что
 * `patch` вправе записать и `reset` обязан вернуть.
 */
export function withoutOwnedFields(
  values: DeepPartial<LoanApplication>
): DeepPartial<LoanApplication> {
  const {
    applicationNumber: _applicationNumber,
    totalIncome: _totalIncome,
    paymentToIncomeRatio: _paymentToIncomeRatio,
    loan,
    applicant,
    ...rest
  } = values;
  const result: DeepPartial<LoanApplication> = { ...rest };
  if (loan !== undefined) {
    const { interestRate: _interestRate, monthlyPayment: _monthlyPayment, ...terms } = loan;
    result.loan = terms;
  }
  if (applicant !== undefined) {
    const { fullName: _fullName, ...person } = applicant;
    result.applicant = person;
  }
  return result;
}
