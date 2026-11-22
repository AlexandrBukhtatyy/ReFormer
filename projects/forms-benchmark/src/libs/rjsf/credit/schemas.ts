/**
 * JSON Schemas of the six steps — one `<Form>` per step, each on its own slice of the page values.
 * The spec's sync rules are schema keywords; module-level constants, as in every RJSF docs example.
 *
 * Conditional fields (✅ «Условные поля», «Управление массивом») are `if`/`then` entries of the step's
 * root `allOf`, one per condition: RJSF's `retrieveSchema` merges an active `then` into the schema, so
 * its fields render, validate and get their defaults; when it switches off, RJSF drops those fields'
 * data (`sanitizeDataForNewSchema`). The `if` lists its property in `required`, so an empty controlling
 * field matches nothing. `then` properties come after the static ones (`ui:order` / step layouts).
 *
 * Labels are the schema `title` (shared `CREDIT_FIELDS`); widgets and placeholders — `uiSchemas.ts`.
 */
import type { RJSFSchema } from '@rjsf/utils';
import {
  CAR_BRAND_MAX_LENGTH,
  CAR_BRAND_MIN_LENGTH,
  CAR_MODEL_MAX_LENGTH,
  CAR_PRICE_MAX,
  CAR_PRICE_MIN,
  CAR_YEAR_MAX,
  CAR_YEAR_MIN,
  COMPUTED_LABELS,
  CREDIT_ARRAYS,
  DEPENDENTS_MAX,
  LOAN_AMOUNT_MAX,
  LOAN_AMOUNT_MIN,
  LOAN_PURPOSE_MAX_LENGTH,
  LOAN_PURPOSE_MIN_LENGTH,
  LOAN_TERM_MAX,
  LOAN_TERM_MIN,
  MONTHLY_INCOME_MIN,
  NON_NEGATIVE_MIN,
  PROPERTY_VALUE_MIN,
  SECTION_TITLES,
  fieldMeta,
  maskPattern,
  type CreditArrayKey,
  type CreditComputed,
  type CreditFieldPath,
} from '../../../shared/domain/credit';
import { toFormData } from './data';

// ── Field schemas from the shared metadata ───────────────────────────────────

const text = (path: CreditFieldPath, rules?: RJSFSchema): RJSFSchema => ({
  type: 'string',
  title: fieldMeta(path).label,
  ...rules,
});
const number = (path: CreditFieldPath, rules?: RJSFSchema): RJSFSchema => ({
  type: 'number',
  title: fieldMeta(path).label,
  ...rules,
});
const email = (path: CreditFieldPath) => text(path, { format: 'email' });
const date = (path: CreditFieldPath) => text(path, { format: 'date' });
/** Masked input: only the fully filled mask is valid. */
const masked = (path: CreditFieldPath) =>
  text(path, { pattern: maskPattern(fieldMeta(path).mask!).source });
/** Static choice (Select, RadioGroup): the option values; their labels are `ui:enumNames`. */
const choice = (path: CreditFieldPath) =>
  text(path, { enum: fieldMeta(path).options!.map((option) => option.value) });
const flag = (path: CreditFieldPath): RJSFSchema => ({
  type: 'boolean',
  title: fieldMeta(path).label,
});
/** Required consent: only `true` is valid (`const` would be pre-filled as a default, `constAsDefaults`). */
const consent = (path: CreditFieldPath): RJSFSchema => ({ ...flag(path), enum: [true] });
/** Computed value C.1–C.8: read-only, the page writes it (`ui:widget: 'computed'`). */
const computed = (key: keyof CreditComputed, type: 'number' | 'string' = 'number'): RJSFSchema => ({
  type,
  title: COMPUTED_LABELS[key],
  readOnly: true,
});
const nonNegative = (path: CreditFieldPath) => number(path, { minimum: NON_NEGATIVE_MIN });

/** `allOf` entry: while `key` is one of `values`, `then` applies. */
const when = (key: string, values: (string | boolean)[], then: RJSFSchema): RJSFSchema => ({
  if: { properties: { [key]: { enum: values } }, required: [key] },
  then,
});

/**
 * An array of the step 5 rows. The row's empty values (shared factory) are the item `default` — what
 * RJSF puts into a row on «Добавить» — and the array `default` is one such row, which RJSF fills in
 * when the flag's `then` switches the array on (BENCH-CONTRACT §8: the flag adds one empty row).
 */
function rows(key: CreditArrayKey, item: RJSFSchema): RJSFSchema {
  const emptyRow = () => toFormData(CREDIT_ARRAYS[key].empty()) as RJSFSchema['default'];
  return {
    type: 'array',
    title: CREDIT_ARRAYS[key].title,
    items: { ...item, default: emptyRow() },
    default: [emptyRow()],
  } as RJSFSchema;
}

function address(title: string): RJSFSchema {
  return {
    type: 'object',
    title,
    required: ['region', 'city', 'street', 'house', 'postalCode'],
    properties: {
      region: text('registrationAddress.region'),
      city: text('registrationAddress.city'),
      street: text('registrationAddress.street'),
      house: text('registrationAddress.house'),
      apartment: text('registrationAddress.apartment'),
      postalCode: masked('registrationAddress.postalCode'),
    },
  };
}

// ── Step 1. Loan ─────────────────────────────────────────────────────────────
export const loanSchema: RJSFSchema = {
  type: 'object',
  required: ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose'],
  properties: {
    loanType: choice('loanType'),
    loanAmount: number('loanAmount', { minimum: LOAN_AMOUNT_MIN, maximum: LOAN_AMOUNT_MAX }),
    loanTerm: number('loanTerm', { minimum: LOAN_TERM_MIN, maximum: LOAN_TERM_MAX }),
    loanPurpose: text('loanPurpose', {
      minLength: LOAN_PURPOSE_MIN_LENGTH,
      maxLength: LOAN_PURPOSE_MAX_LENGTH,
    }),
    interestRate: computed('interestRate'),
    monthlyPayment: computed('monthlyPayment'),
  },
  allOf: [
    when('loanType', ['mortgage'], {
      required: ['propertyValue'],
      properties: {
        propertyValue: number('propertyValue', { minimum: PROPERTY_VALUE_MIN }),
        initialPayment: computed('initialPayment'),
      },
    }),
    when('loanType', ['car'], {
      required: ['carBrand', 'carModel', 'carYear', 'carPrice'],
      properties: {
        carBrand: text('carBrand', {
          minLength: CAR_BRAND_MIN_LENGTH,
          maxLength: CAR_BRAND_MAX_LENGTH,
        }),
        carModel: text('carModel', { maxLength: CAR_MODEL_MAX_LENGTH }),
        carYear: number('carYear', { minimum: CAR_YEAR_MIN, maximum: CAR_YEAR_MAX }),
        carPrice: number('carPrice', { minimum: CAR_PRICE_MIN, maximum: CAR_PRICE_MAX }),
      },
    }),
  ],
};

// ── Step 2. Personal data ────────────────────────────────────────────────────
export const personalSchema: RJSFSchema = {
  type: 'object',
  required: ['personalData', 'passportData', 'inn', 'snils'],
  properties: {
    // No title: the step layout frames it together with `fullName` and `age`.
    personalData: {
      type: 'object',
      required: ['lastName', 'firstName', 'middleName', 'birthDate', 'gender', 'birthPlace'],
      properties: {
        lastName: text('personalData.lastName'),
        firstName: text('personalData.firstName'),
        middleName: text('personalData.middleName'),
        birthDate: date('personalData.birthDate'),
        gender: choice('personalData.gender'),
        birthPlace: text('personalData.birthPlace'),
      },
    },
    passportData: {
      type: 'object',
      title: SECTION_TITLES.passportData,
      required: ['series', 'number', 'issueDate', 'issuedBy', 'departmentCode'],
      properties: {
        series: masked('passportData.series'),
        number: masked('passportData.number'),
        issueDate: date('passportData.issueDate'),
        issuedBy: text('passportData.issuedBy'),
        departmentCode: masked('passportData.departmentCode'),
      },
    },
    inn: masked('inn'),
    snils: masked('snils'),
    fullName: computed('fullName', 'string'),
    age: computed('age'),
  },
};

// ── Step 3. Contacts ─────────────────────────────────────────────────────────
export const contactsSchema: RJSFSchema = {
  type: 'object',
  required: ['phoneMain', 'email', 'registrationAddress'],
  properties: {
    phoneMain: masked('phoneMain'),
    phoneAdditional: masked('phoneAdditional'),
    email: email('email'),
    sameEmail: flag('sameEmail'),
    emailAdditional: email('emailAdditional'),
    registrationAddress: address(SECTION_TITLES.registrationAddress),
    sameAsRegistration: flag('sameAsRegistration'),
  },
  allOf: [
    // A copy of `email` (the page writes it): read-only, not disabled (BENCH-CONTRACT §8).
    when('sameEmail', [true], { properties: { emailAdditional: { readOnly: true } } }),
    when('sameAsRegistration', [false], {
      required: ['residenceAddress'],
      properties: { residenceAddress: address(SECTION_TITLES.residenceAddress) },
    }),
  ],
};

// ── Step 4. Employment ───────────────────────────────────────────────────────
export const employmentSchema: RJSFSchema = {
  type: 'object',
  required: ['employmentStatus', 'workExperienceTotal', 'workExperienceCurrent', 'monthlyIncome'],
  properties: {
    employmentStatus: choice('employmentStatus'),
    workExperienceTotal: nonNegative('workExperienceTotal'),
    workExperienceCurrent: nonNegative('workExperienceCurrent'),
    monthlyIncome: number('monthlyIncome', { minimum: MONTHLY_INCOME_MIN }),
    additionalIncome: nonNegative('additionalIncome'),
    additionalIncomeSource: text('additionalIncomeSource'),
    totalIncome: computed('totalIncome'),
    paymentToIncomeRatio: computed('paymentToIncomeRatio'),
  },
  allOf: [
    when('employmentStatus', ['employed'], {
      required: ['companyName', 'companyInn', 'companyPhone', 'companyAddress', 'position'],
      properties: {
        companyName: text('companyName'),
        companyInn: masked('companyInn'),
        companyPhone: masked('companyPhone'),
        companyAddress: text('companyAddress'),
        position: text('position'),
      },
    }),
    when('employmentStatus', ['selfEmployed'], {
      required: ['businessType', 'businessInn', 'businessActivity'],
      properties: {
        businessType: text('businessType'),
        businessInn: masked('businessInn'),
        businessActivity: text('businessActivity'),
      },
    }),
    // 🆕 Условная обязательность: the source is required while the additional income is > 0.
    {
      if: {
        properties: { additionalIncome: { exclusiveMinimum: 0 } },
        required: ['additionalIncome'],
      },
      then: { required: ['additionalIncomeSource'] },
    },
  ],
};

// ── Step 5. Additional ───────────────────────────────────────────────────────
const property: RJSFSchema = {
  type: 'object',
  required: ['type', 'description', 'estimatedValue'],
  properties: {
    type: text('properties[].type'),
    description: text('properties[].description'),
    estimatedValue: nonNegative('properties[].estimatedValue'),
    hasEncumbrance: flag('properties[].hasEncumbrance'),
  },
};

const existingLoan: RJSFSchema = {
  type: 'object',
  required: ['bank', 'type', 'amount', 'remainingAmount', 'monthlyPayment', 'maturityDate'],
  properties: {
    bank: text('existingLoans[].bank'),
    type: text('existingLoans[].type'),
    amount: nonNegative('existingLoans[].amount'),
    remainingAmount: nonNegative('existingLoans[].remainingAmount'),
    monthlyPayment: nonNegative('existingLoans[].monthlyPayment'),
    maturityDate: date('existingLoans[].maturityDate'),
  },
};

const coBorrower: RJSFSchema = {
  type: 'object',
  required: ['personalData', 'phone', 'email', 'relationship', 'monthlyIncome'],
  properties: {
    personalData: {
      type: 'object',
      required: ['lastName', 'firstName', 'middleName', 'birthDate'],
      properties: {
        lastName: text('coBorrowers[].personalData.lastName'),
        firstName: text('coBorrowers[].personalData.firstName'),
        middleName: text('coBorrowers[].personalData.middleName'),
        birthDate: date('coBorrowers[].personalData.birthDate'),
      },
    },
    phone: masked('coBorrowers[].phone'),
    email: email('coBorrowers[].email'),
    relationship: text('coBorrowers[].relationship'),
    monthlyIncome: nonNegative('coBorrowers[].monthlyIncome'),
  },
};

export const additionalSchema: RJSFSchema = {
  type: 'object',
  required: ['maritalStatus', 'dependents', 'education'],
  properties: {
    maritalStatus: choice('maritalStatus'),
    dependents: number('dependents', { minimum: NON_NEGATIVE_MIN, maximum: DEPENDENTS_MAX }),
    education: choice('education'),
    hasProperty: flag('hasProperty'),
    hasExistingLoans: flag('hasExistingLoans'),
    hasCoBorrower: flag('hasCoBorrower'),
  },
  allOf: [
    when('hasProperty', [true], { properties: { properties: rows('properties', property) } }),
    when('hasExistingLoans', [true], {
      properties: { existingLoans: rows('existingLoans', existingLoan) },
    }),
    when('hasCoBorrower', [true], {
      properties: {
        coBorrowers: rows('coBorrowers', coBorrower),
        coBorrowersIncome: computed('coBorrowersIncome'),
      },
    }),
  ],
};

// ── Step 6. Confirmation ─────────────────────────────────────────────────────
export const confirmationSchema: RJSFSchema = {
  type: 'object',
  required: [
    'agreePersonalData',
    'agreeCreditHistory',
    'agreeTerms',
    'confirmAccuracy',
    'electronicSignature',
  ],
  properties: {
    agreePersonalData: consent('agreePersonalData'),
    agreeCreditHistory: consent('agreeCreditHistory'),
    agreeMarketing: flag('agreeMarketing'),
    agreeTerms: consent('agreeTerms'),
    confirmAccuracy: consent('confirmAccuracy'),
    electronicSignature: masked('electronicSignature'),
  },
};
