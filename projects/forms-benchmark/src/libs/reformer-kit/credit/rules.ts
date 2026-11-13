/**
 * Правила кредитной заявки для обеих ReFormer-реализаций: по схеме `defineValidation` на шаг,
 * шаги — поток сборки `createForm({ flow })` (packages/reformer/docs/llms/13-multi-step.md,
 * 38-form-flow.md). Порядок правил поля — порядок ключей `shared/messages/credit.ts`: показывается
 * первое замечание. Коды замечаний — ключи сообщений, тексты — `defineIssueMessages`.
 *
 * - Условные поля (ипотека, авто, найм, ИП, адрес проживания) выключает поведение (`enableWhen`):
 *   выключенное поле проверка формы пропускает, поэтому `validateWhen` для них не нужен.
 * - Условная обязательность источника дохода и кросс-правила — `cross` над снимком формы: правило
 *   поля проверяется всегда, и «Далее» помечает поле тронутым даже при ложном условии (иначе
 *   ошибка, появившаяся от смены соседнего поля, осталась бы невидимой).
 * - Строки массивов — `applyEach` со схемой строки; её `cross` получает снимок строки.
 */
import type { FormFlowConfig, ValidationIssue } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import {
  apply,
  applyEach,
  defineValidation,
  validate,
  validateAsync,
  type AsyncRule,
  type Rule,
} from '@reformer/core/validation';
import {
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from '@reformer/core/validators';
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
  isTooOld,
  isTooYoung,
  maskPattern,
  needsIncomeSource,
  paymentRatioTooHigh,
  remainingExceedsAmount,
  type CreditAddress,
  type CreditCoBorrower,
  type CreditExistingLoan,
  type CreditProperty,
  type CreditValues,
} from '../../../shared/domain/credit';
import { CREDIT_MESSAGES, type CreditMessageKey } from '../../../shared/messages/credit';
import { creditApi } from '../../../shared/api/credit-client';

export const creditMessages = defineIssueMessages(CREDIT_MESSAGES);

/** Код замечания — ключ общего сообщения. */
const code = (key: CreditMessageKey) => ({ code: key });
/** Правило-предикат: нарушено — замечание с кодом `key`. */
const when =
  <V>(violated: (value: V) => boolean, key: CreditMessageKey): Rule<V> =>
  (value) =>
    violated(value) ? code(key) : null;
/** Кросс-правило над снимком формы (строки): нарушено — замечание `key`. */
const crossRule =
  <S>(violated: (snapshot: S) => boolean, key: CreditMessageKey) =>
  (snapshot: S): ValidationIssue | null =>
    violated(snapshot) ? code(key) : null;

const PHONE = maskPattern(MASKS.phone);
const SMS_CODE = maskPattern(MASKS.smsCode);

// ── Шаг 1 ────────────────────────────────────────────────────────────────────
const loanRules = defineValidation<CreditValues>(({ model, cross }) => {
  validate(model.$.loanType, [required(code('loanType.required'))]);
  validate(model.$.loanAmount, [
    required(code('loanAmount.required')),
    min(LOAN_AMOUNT_MIN, code('loanAmount.min')),
    max(LOAN_AMOUNT_MAX, code('loanAmount.max')),
  ]);
  cross(
    model.$.loanAmount,
    crossRule<CreditValues>(
      (v) => exceedsMortgageLimit(v.loanType, v.loanAmount, v.propertyValue),
      'loanAmount.maxMortgage'
    )
  );
  validate(model.$.loanTerm, [
    required(code('loanTerm.required')),
    min(LOAN_TERM_MIN, code('loanTerm.min')),
    max(LOAN_TERM_MAX, code('loanTerm.max')),
  ]);
  validate(model.$.loanPurpose, [
    required(code('loanPurpose.required')),
    minLength(LOAN_PURPOSE_MIN_LENGTH, code('loanPurpose.minLength')),
    maxLength(LOAN_PURPOSE_MAX_LENGTH, code('loanPurpose.maxLength')),
  ]);
  validate(model.$.propertyValue, [
    required(code('propertyValue.required')),
    min(PROPERTY_VALUE_MIN, code('propertyValue.min')),
  ]);
  validate(model.$.carBrand, [
    required(code('carBrand.required')),
    minLength(CAR_BRAND_MIN_LENGTH, code('carBrand.minLength')),
    maxLength(CAR_BRAND_MAX_LENGTH, code('carBrand.maxLength')),
  ]);
  validate(model.$.carModel, [
    required(code('carModel.required')),
    maxLength(CAR_MODEL_MAX_LENGTH, code('carModel.maxLength')),
  ]);
  validate(model.$.carYear, [
    required(code('carYear.required')),
    min(CAR_YEAR_MIN, code('carYear.min')),
    max(CAR_YEAR_MAX, code('carYear.max')),
  ]);
  validate(model.$.carPrice, [
    required(code('carPrice.required')),
    min(CAR_PRICE_MIN, code('carPrice.min')),
    max(CAR_PRICE_MAX, code('carPrice.max')),
  ]);
});

// ── Шаг 2 ────────────────────────────────────────────────────────────────────
const applicantRules = defineValidation<CreditValues>(({ model }) => {
  const person = model.$.personalData;
  const passport = model.$.passportData;
  validate(person.lastName, [required(code('personalData.lastName.required'))]);
  validate(person.firstName, [required(code('personalData.firstName.required'))]);
  validate(person.middleName, [required(code('personalData.middleName.required'))]);
  validate(person.birthDate, [
    required(code('personalData.birthDate.required')),
    when(isTooYoung, 'personalData.birthDate.minAge'),
    when(isTooOld, 'personalData.birthDate.maxAge'),
  ]);
  validate(person.gender, [required(code('personalData.gender.required'))]);
  validate(person.birthPlace, [required(code('personalData.birthPlace.required'))]);
  validate(passport.series, [
    required(code('passportData.series.required')),
    pattern(maskPattern(MASKS.passportSeries), code('passportData.series.pattern')),
  ]);
  validate(passport.number, [
    required(code('passportData.number.required')),
    pattern(maskPattern(MASKS.passportNumber), code('passportData.number.pattern')),
  ]);
  validate(passport.issueDate, [required(code('passportData.issueDate.required'))]);
  validate(passport.issuedBy, [required(code('passportData.issuedBy.required'))]);
  validate(passport.departmentCode, [
    required(code('passportData.departmentCode.required')),
    pattern(maskPattern(MASKS.departmentCode), code('passportData.departmentCode.pattern')),
  ]);
  validate(model.$.inn, [
    required(code('inn.required')),
    pattern(maskPattern(MASKS.inn12), code('inn.pattern')),
  ]);
  validate(model.$.snils, [
    required(code('snils.required')),
    pattern(maskPattern(MASKS.snils), code('snils.pattern')),
  ]);
});

// ── Шаг 3 ────────────────────────────────────────────────────────────────────
/** Правила адреса — одна схема на адрес регистрации и проживания (`apply`). */
const addressRules = (prefix: 'registrationAddress' | 'residenceAddress') =>
  defineValidation<CreditAddress>(({ model }) => {
    validate(model.$.region, [required(code(`${prefix}.region.required`))]);
    validate(model.$.city, [required(code(`${prefix}.city.required`))]);
    validate(model.$.street, [required(code(`${prefix}.street.required`))]);
    validate(model.$.house, [required(code(`${prefix}.house.required`))]);
    validate(model.$.postalCode, [
      required(code(`${prefix}.postalCode.required`)),
      pattern(maskPattern(MASKS.postalCode), code(`${prefix}.postalCode.pattern`)),
    ]);
  });
const registrationAddressRules = addressRules('registrationAddress');
const residenceAddressRules = addressRules('residenceAddress');

const contactsRules = defineValidation<CreditValues>(({ model }) => {
  validate(model.$.phoneMain, [
    required(code('phoneMain.required')),
    pattern(PHONE, code('phoneMain.pattern')),
  ]);
  validate(model.$.phoneAdditional, [pattern(PHONE, code('phoneAdditional.pattern'))]);
  validate(model.$.email, [required(code('email.required')), email(code('email.email'))]);
  validate(model.$.emailAdditional, [email(code('emailAdditional.email'))]);
  apply(model.$.registrationAddress, registrationAddressRules);
  apply(model.$.residenceAddress, residenceAddressRules);
});

// ── Шаг 4 ────────────────────────────────────────────────────────────────────
const employmentRules = defineValidation<CreditValues>(({ model, cross }) => {
  validate(model.$.employmentStatus, [required(code('employmentStatus.required'))]);
  validate(model.$.companyName, [required(code('companyName.required'))]);
  validate(model.$.companyInn, [
    required(code('companyInn.required')),
    pattern(maskPattern(MASKS.inn10), code('companyInn.pattern')),
  ]);
  validate(model.$.companyPhone, [
    required(code('companyPhone.required')),
    pattern(PHONE, code('companyPhone.pattern')),
  ]);
  validate(model.$.companyAddress, [required(code('companyAddress.required'))]);
  validate(model.$.position, [required(code('position.required'))]);
  validate(model.$.businessType, [required(code('businessType.required'))]);
  validate(model.$.businessInn, [
    required(code('businessInn.required')),
    pattern(maskPattern(MASKS.inn12), code('businessInn.pattern')),
  ]);
  validate(model.$.businessActivity, [required(code('businessActivity.required'))]);
  validate(model.$.workExperienceTotal, [
    required(code('workExperienceTotal.required')),
    min(NON_NEGATIVE_MIN, code('workExperienceTotal.min')),
  ]);
  validate(model.$.workExperienceCurrent, [
    required(code('workExperienceCurrent.required')),
    min(NON_NEGATIVE_MIN, code('workExperienceCurrent.min')),
  ]);
  cross(
    model.$.workExperienceCurrent,
    crossRule<CreditValues>(
      (v) => experienceExceedsTotal(v.workExperienceCurrent, v.workExperienceTotal),
      'workExperienceCurrent.maxTotal'
    )
  );
  validate(model.$.monthlyIncome, [
    required(code('monthlyIncome.required')),
    min(MONTHLY_INCOME_MIN, code('monthlyIncome.min')),
  ]);
  cross(model.$.monthlyIncome, crossRule(paymentRatioTooHigh, 'monthlyIncome.paymentRatio'));
  validate(model.$.additionalIncome, [min(NON_NEGATIVE_MIN, code('additionalIncome.min'))]);
  cross(
    model.$.additionalIncomeSource,
    crossRule<CreditValues>(
      (v) => needsIncomeSource(v.additionalIncome) && v.additionalIncomeSource === '',
      'additionalIncomeSource.required'
    )
  );
});

// ── Шаг 5 ────────────────────────────────────────────────────────────────────
const propertyRules = defineValidation<CreditProperty>(({ model }) => {
  validate(model.$.type, [required(code('properties[].type.required'))]);
  validate(model.$.description, [required(code('properties[].description.required'))]);
  validate(model.$.estimatedValue, [
    required(code('properties[].estimatedValue.required')),
    min(NON_NEGATIVE_MIN, code('properties[].estimatedValue.min')),
  ]);
});

const existingLoanRules = defineValidation<CreditExistingLoan>(({ model, cross }) => {
  validate(model.$.bank, [required(code('existingLoans[].bank.required'))]);
  validate(model.$.type, [required(code('existingLoans[].type.required'))]);
  validate(model.$.amount, [
    required(code('existingLoans[].amount.required')),
    min(NON_NEGATIVE_MIN, code('existingLoans[].amount.min')),
  ]);
  validate(model.$.remainingAmount, [
    required(code('existingLoans[].remainingAmount.required')),
    min(NON_NEGATIVE_MIN, code('existingLoans[].remainingAmount.min')),
  ]);
  cross(
    model.$.remainingAmount,
    crossRule<CreditExistingLoan>(
      (row) => remainingExceedsAmount(row.remainingAmount, row.amount),
      'existingLoans[].remainingAmount.maxAmount'
    )
  );
  validate(model.$.monthlyPayment, [
    required(code('existingLoans[].monthlyPayment.required')),
    min(NON_NEGATIVE_MIN, code('existingLoans[].monthlyPayment.min')),
  ]);
  validate(model.$.maturityDate, [required(code('existingLoans[].maturityDate.required'))]);
});

const coBorrowerRules = defineValidation<CreditCoBorrower>(({ model }) => {
  const person = model.$.personalData;
  validate(person.lastName, [required(code('coBorrowers[].personalData.lastName.required'))]);
  validate(person.firstName, [required(code('coBorrowers[].personalData.firstName.required'))]);
  validate(person.middleName, [required(code('coBorrowers[].personalData.middleName.required'))]);
  validate(person.birthDate, [required(code('coBorrowers[].personalData.birthDate.required'))]);
  validate(model.$.phone, [
    required(code('coBorrowers[].phone.required')),
    pattern(PHONE, code('coBorrowers[].phone.pattern')),
  ]);
  validate(model.$.email, [
    required(code('coBorrowers[].email.required')),
    email(code('coBorrowers[].email.email')),
  ]);
  validate(model.$.relationship, [required(code('coBorrowers[].relationship.required'))]);
  validate(model.$.monthlyIncome, [
    required(code('coBorrowers[].monthlyIncome.required')),
    min(NON_NEGATIVE_MIN, code('coBorrowers[].monthlyIncome.min')),
  ]);
});

const additionalRules = defineValidation<CreditValues>(({ model }) => {
  validate(model.$.maritalStatus, [required(code('maritalStatus.required'))]);
  validate(model.$.dependents, [
    required(code('dependents.required')),
    min(NON_NEGATIVE_MIN, code('dependents.min')),
    max(DEPENDENTS_MAX, code('dependents.max')),
  ]);
  validate(model.$.education, [required(code('education.required'))]);
  applyEach(model.$.properties, propertyRules);
  applyEach(model.$.existingLoans, existingLoanRules);
  applyEach(model.$.coBorrowers, coBorrowerRules);
});

// ── Шаг 6 ────────────────────────────────────────────────────────────────────
/**
 * Код из СМС — на «сервере» (`creditApi.verifySmsCode`: debounce + кэш в клиенте). Только для
 * значения, прошедшего синхронные правила (BENCH-CONTRACT §3); `undefined` — проверка вытеснена.
 */
const smsCodeValid: AsyncRule<string> = async (value) =>
  SMS_CODE.test(value) && (await creditApi.verifySmsCode(value)) === false
    ? code('electronicSignature.invalid')
    : null;

const confirmationRules = defineValidation<CreditValues>(({ model }) => {
  validate(model.$.agreePersonalData, [required(code('agreePersonalData.required'))]);
  validate(model.$.agreeCreditHistory, [required(code('agreeCreditHistory.required'))]);
  validate(model.$.agreeTerms, [required(code('agreeTerms.required'))]);
  validate(model.$.confirmAccuracy, [required(code('confirmAccuracy.required'))]);
  validate(model.$.electronicSignature, [
    required(code('electronicSignature.required')),
    pattern(SMS_CODE, code('electronicSignature.pattern')),
  ]);
  validateAsync(model.$.electronicSignature, [smsCodeValid]);
});

/**
 * Поток шагов: id шага — `selector` узла шага (JSON-документ), правила — шага. Полный набор
 * формы (отправка) — правила всех шагов. Отказ отправки переводит поток на первый шаг с ошибкой
 * (`onInvalidSubmit: 'firstInvalidStep'`, 13-multi-step.md; BENCH-CONTRACT §8 «Отправка»):
 * межшаговое правило, устаревшее после правки на позднем шаге, иначе осталось бы на
 * размонтированном шаге.
 */
export const creditFlow: FormFlowConfig<CreditValues> = {
  steps: [
    { id: 'loan', rules: loanRules },
    { id: 'applicant', rules: applicantRules },
    { id: 'contacts', rules: contactsRules },
    { id: 'employment', rules: employmentRules },
    { id: 'additional', rules: additionalRules },
    { id: 'confirmation', rules: confirmationRules },
  ],
  onInvalidSubmit: 'firstInvalidStep',
};
