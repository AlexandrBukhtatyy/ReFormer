/**
 * Yup schemas of the six wizard steps (spec tables + `shared/messages/credit.ts`). The wizard passes
 * the current step's schema to `<Formik validationSchema>`, as in Formik's MultistepWizard example.
 *
 * Within a field the rules are declared in the order of the message keys: Formik keeps the first
 * Yup error per path, and Formik hands Yup `''` as `undefined`, so a failing `required` stops the
 * other rules of the field. A conditional field gets its rules through `when` and has none while it
 * is hidden. Cross rules read sibling values through the test context (`this.parent`).
 */
import * as Yup from 'yup';
import { creditApi } from '../../../shared/api/credit-client';
import {
  CAR_BRAND_MAX_LENGTH,
  CAR_BRAND_MIN_LENGTH,
  CAR_MODEL_MAX_LENGTH,
  CAR_PRICE_MAX,
  CAR_PRICE_MIN,
  CAR_YEAR_MAX,
  CAR_YEAR_MIN,
  DEPENDENTS_MAX,
  LOAN_AMOUNT_MAX,
  LOAN_AMOUNT_MIN,
  LOAN_PURPOSE_MAX_LENGTH,
  LOAN_PURPOSE_MIN_LENGTH,
  LOAN_TERM_MAX,
  LOAN_TERM_MIN,
  MASKS,
  MONTHLY_INCOME_MIN,
  NON_NEGATIVE_MIN,
  PROPERTY_VALUE_MIN,
  exceedsMortgageLimit,
  experienceExceedsTotal,
  isCarLoan,
  isEmployed,
  isMortgage,
  isSelfEmployed,
  isTooOld,
  isTooYoung,
  livesElsewhere,
  maskPattern,
  needsIncomeSource,
  paymentRatioTooHigh,
  remainingExceedsAmount,
  toCreditPayload,
  type CreditInput,
} from '../../../shared/domain/credit';
import { msg, type CreditMessageKey } from '../../../shared/messages/credit';
import { withServerCheck } from '../kit/serverCheck';

const required = (key: CreditMessageKey) => Yup.string().required(msg(key));

/** Required string that must match a mask completely. */
const masked = (mask: string, requiredKey: CreditMessageKey, patternKey: CreditMessageKey) =>
  required(requiredKey).matches(maskPattern(mask), msg(patternKey));

const requiredNumber = (key: CreditMessageKey) => Yup.number().required(msg(key));

/** Number ≥ 0 (amounts, experience, dependents). */
const nonNegative = (requiredKey: CreditMessageKey, minKey: CreditMessageKey) =>
  requiredNumber(requiredKey).min(NON_NEGATIVE_MIN, msg(minKey));

/** Flag that has to be set (consents): the `required` rule of a checkbox. */
const accepted = (key: CreditMessageKey) => Yup.boolean().oneOf([true], msg(key));

const PHONE = maskPattern(MASKS.phone);

// ── Step 1 ───────────────────────────────────────────────────────────────────
const loanStep = Yup.object({
  loanType: required('loanType.required'),
  loanAmount: requiredNumber('loanAmount.required')
    .min(LOAN_AMOUNT_MIN, msg('loanAmount.min'))
    .max(LOAN_AMOUNT_MAX, msg('loanAmount.max'))
    .test('maxMortgage', msg('loanAmount.maxMortgage'), function (amount) {
      const { loanType = '', propertyValue = null } = this.parent as Partial<CreditInput>;
      return !exceedsMortgageLimit(loanType, amount ?? null, propertyValue);
    }),
  loanTerm: requiredNumber('loanTerm.required')
    .min(LOAN_TERM_MIN, msg('loanTerm.min'))
    .max(LOAN_TERM_MAX, msg('loanTerm.max')),
  loanPurpose: required('loanPurpose.required')
    .min(LOAN_PURPOSE_MIN_LENGTH, msg('loanPurpose.minLength'))
    .max(LOAN_PURPOSE_MAX_LENGTH, msg('loanPurpose.maxLength')),
  propertyValue: Yup.number()
    .nullable()
    .when('loanType', {
      is: isMortgage,
      then: (s) =>
        s.required(msg('propertyValue.required')).min(PROPERTY_VALUE_MIN, msg('propertyValue.min')),
    }),
  carBrand: Yup.string().when('loanType', {
    is: isCarLoan,
    then: (s) =>
      s
        .required(msg('carBrand.required'))
        .min(CAR_BRAND_MIN_LENGTH, msg('carBrand.minLength'))
        .max(CAR_BRAND_MAX_LENGTH, msg('carBrand.maxLength')),
  }),
  carModel: Yup.string().when('loanType', {
    is: isCarLoan,
    then: (s) =>
      s.required(msg('carModel.required')).max(CAR_MODEL_MAX_LENGTH, msg('carModel.maxLength')),
  }),
  carYear: Yup.number()
    .nullable()
    .when('loanType', {
      is: isCarLoan,
      then: (s) =>
        s
          .required(msg('carYear.required'))
          .min(CAR_YEAR_MIN, msg('carYear.min'))
          .max(CAR_YEAR_MAX, msg('carYear.max')),
    }),
  carPrice: Yup.number()
    .nullable()
    .when('loanType', {
      is: isCarLoan,
      then: (s) =>
        s
          .required(msg('carPrice.required'))
          .min(CAR_PRICE_MIN, msg('carPrice.min'))
          .max(CAR_PRICE_MAX, msg('carPrice.max')),
    }),
});

// ── Step 2 ───────────────────────────────────────────────────────────────────
const personalStep = Yup.object({
  personalData: Yup.object({
    lastName: required('personalData.lastName.required'),
    firstName: required('personalData.firstName.required'),
    middleName: required('personalData.middleName.required'),
    birthDate: required('personalData.birthDate.required')
      .test('minAge', msg('personalData.birthDate.minAge'), (date = '') => !isTooYoung(date))
      .test('maxAge', msg('personalData.birthDate.maxAge'), (date = '') => !isTooOld(date)),
    gender: required('personalData.gender.required'),
    birthPlace: required('personalData.birthPlace.required'),
  }),
  passportData: Yup.object({
    series: masked(
      MASKS.passportSeries,
      'passportData.series.required',
      'passportData.series.pattern'
    ),
    number: masked(
      MASKS.passportNumber,
      'passportData.number.required',
      'passportData.number.pattern'
    ),
    issueDate: required('passportData.issueDate.required'),
    issuedBy: required('passportData.issuedBy.required'),
    departmentCode: masked(
      MASKS.departmentCode,
      'passportData.departmentCode.required',
      'passportData.departmentCode.pattern'
    ),
  }),
  inn: masked(MASKS.inn12, 'inn.required', 'inn.pattern'),
  snils: masked(MASKS.snils, 'snils.required', 'snils.pattern'),
});

// ── Step 3 ───────────────────────────────────────────────────────────────────
const address = (p: 'registrationAddress' | 'residenceAddress') =>
  Yup.object({
    region: required(`${p}.region.required`),
    city: required(`${p}.city.required`),
    street: required(`${p}.street.required`),
    house: required(`${p}.house.required`),
    postalCode: masked(MASKS.postalCode, `${p}.postalCode.required`, `${p}.postalCode.pattern`),
  });

const contactsStep = Yup.object({
  phoneMain: masked(MASKS.phone, 'phoneMain.required', 'phoneMain.pattern'),
  phoneAdditional: Yup.string().matches(PHONE, msg('phoneAdditional.pattern')),
  email: required('email.required').email(msg('email.email')),
  emailAdditional: Yup.string().email(msg('emailAdditional.email')),
  registrationAddress: address('registrationAddress'),
  residenceAddress: Yup.object().when('sameAsRegistration', {
    is: livesElsewhere,
    then: () => address('residenceAddress'),
  }),
});

// ── Step 4 ───────────────────────────────────────────────────────────────────
/** Required only for one employment status (and only then visible). */
const forStatus = (is: (status: string) => boolean, schema: Yup.StringSchema<string>) =>
  Yup.string().when('employmentStatus', { is, then: () => schema });

const employmentStep = Yup.object({
  employmentStatus: required('employmentStatus.required'),
  companyName: forStatus(isEmployed, required('companyName.required')),
  companyInn: forStatus(
    isEmployed,
    masked(MASKS.inn10, 'companyInn.required', 'companyInn.pattern')
  ),
  companyPhone: forStatus(
    isEmployed,
    masked(MASKS.phone, 'companyPhone.required', 'companyPhone.pattern')
  ),
  companyAddress: forStatus(isEmployed, required('companyAddress.required')),
  position: forStatus(isEmployed, required('position.required')),
  businessType: forStatus(isSelfEmployed, required('businessType.required')),
  businessInn: forStatus(
    isSelfEmployed,
    masked(MASKS.inn12, 'businessInn.required', 'businessInn.pattern')
  ),
  businessActivity: forStatus(isSelfEmployed, required('businessActivity.required')),
  workExperienceTotal: nonNegative('workExperienceTotal.required', 'workExperienceTotal.min'),
  workExperienceCurrent: nonNegative(
    'workExperienceCurrent.required',
    'workExperienceCurrent.min'
  ).test('maxTotal', msg('workExperienceCurrent.maxTotal'), function (current) {
    const { workExperienceTotal = null } = this.parent as Partial<CreditInput>;
    return !experienceExceedsTotal(current ?? null, workExperienceTotal);
  }),
  monthlyIncome: requiredNumber('monthlyIncome.required')
    .min(MONTHLY_INCOME_MIN, msg('monthlyIncome.min'))
    .test('paymentRatio', msg('monthlyIncome.paymentRatio'), function () {
      // C.7 needs the whole application (loan, region, property, income). Yup sees the values with
      // '' turned into undefined; the shared normalizer accepts such loose values.
      return !paymentRatioTooHigh(toCreditPayload(this.parent as CreditInput));
    }),
  additionalIncome: Yup.number().nullable().min(NON_NEGATIVE_MIN, msg('additionalIncome.min')),
  additionalIncomeSource: Yup.string().when('additionalIncome', {
    is: needsIncomeSource,
    then: (s) => s.required(msg('additionalIncomeSource.required')),
  }),
});

// ── Step 5 ───────────────────────────────────────────────────────────────────
const property = Yup.object({
  type: required('properties[].type.required'),
  description: required('properties[].description.required'),
  estimatedValue: nonNegative(
    'properties[].estimatedValue.required',
    'properties[].estimatedValue.min'
  ),
});

const existingLoan = Yup.object({
  bank: required('existingLoans[].bank.required'),
  type: required('existingLoans[].type.required'),
  amount: nonNegative('existingLoans[].amount.required', 'existingLoans[].amount.min'),
  remainingAmount: nonNegative(
    'existingLoans[].remainingAmount.required',
    'existingLoans[].remainingAmount.min'
  ).test('maxAmount', msg('existingLoans[].remainingAmount.maxAmount'), function (remaining) {
    const { amount = null } = this.parent as { amount?: number | null };
    return !remainingExceedsAmount(remaining ?? null, amount);
  }),
  monthlyPayment: nonNegative(
    'existingLoans[].monthlyPayment.required',
    'existingLoans[].monthlyPayment.min'
  ),
  maturityDate: required('existingLoans[].maturityDate.required'),
});

const coBorrower = Yup.object({
  personalData: Yup.object({
    lastName: required('coBorrowers[].personalData.lastName.required'),
    firstName: required('coBorrowers[].personalData.firstName.required'),
    middleName: required('coBorrowers[].personalData.middleName.required'),
    birthDate: required('coBorrowers[].personalData.birthDate.required'),
  }),
  phone: masked(MASKS.phone, 'coBorrowers[].phone.required', 'coBorrowers[].phone.pattern'),
  email: required('coBorrowers[].email.required').email(msg('coBorrowers[].email.email')),
  relationship: required('coBorrowers[].relationship.required'),
  monthlyIncome: nonNegative(
    'coBorrowers[].monthlyIncome.required',
    'coBorrowers[].monthlyIncome.min'
  ),
});

const additionalStep = Yup.object({
  maritalStatus: required('maritalStatus.required'),
  dependents: nonNegative('dependents.required', 'dependents.min').max(
    DEPENDENTS_MAX,
    msg('dependents.max')
  ),
  education: required('education.required'),
  // A switched-off array is `[]` (the flag handler clears it), so rows exist only while shown.
  properties: Yup.array().of(property),
  existingLoans: Yup.array().of(existingLoan),
  coBorrowers: Yup.array().of(coBorrower),
});

// ── Step 6 ───────────────────────────────────────────────────────────────────
const confirmationStep = Yup.object({
  agreePersonalData: accepted('agreePersonalData.required'),
  agreeCreditHistory: accepted('agreeCreditHistory.required'),
  agreeTerms: accepted('agreeTerms.required'),
  confirmAccuracy: accepted('confirmAccuracy.required'),
  // Server check last and only for a code that passes the sync rules (`withServerCheck`).
  electronicSignature: withServerCheck(
    masked(MASKS.smsCode, 'electronicSignature.required', 'electronicSignature.pattern'),
    'invalid',
    msg('electronicSignature.invalid'),
    creditApi.verifySmsCode
  ),
});

/** `CREDIT_STEP_SCHEMAS[i]` validates step `i + 1` (its top-level keys, `CREDIT_STEPS[i].keys`). */
export const CREDIT_STEP_SCHEMAS = [
  loanStep,
  personalStep,
  contactsStep,
  employmentStep,
  additionalStep,
  confirmationStep,
] as const;
