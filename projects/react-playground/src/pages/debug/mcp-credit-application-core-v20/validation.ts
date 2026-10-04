// validation.ts — вся валидация формы на операторах `@reformer/core/validation`.
// Каждый шаг — схема `({ model }) => void`: значения проверяет `validate(sig, [rules])`, условные
// ветки — `validateWhen(cond, cb)`, правила над несколькими полями — `cross(sig, fn)` (fn получает
// снимок своей области). Группа подключается через `apply(model.$.group, rules)`, массив — через
// `applyEach(model.$.arr, itemRules)`: правила строки — такая же схема над элементом.
// Экспорт `creditValidation` — правила шагов данными для поля `validation` сборки `createForm`.
import { type FormValidation, type ValidationError } from '@reformer/core';
import {
  validate,
  validateWhen,
  cross,
  apply,
  applyEach,
  defineValidationSchema,
  type Rule,
} from '@reformer/core/validation';
import { email, max, min, maxLength, minLength, required } from '@reformer/core/validators';
import {
  CURRENT_YEAR,
  type CreditForm,
  type Address,
  type Property,
  type ExistingLoan,
  type CoBorrower,
} from './types';

type Root = CreditForm;

// ===== Custom value-only rules (Rule<T>) =====

const mustBeTrue =
  (message: string): Rule<boolean> =>
  (value) =>
    value === true ? null : { code: 'required', message };

const ageRange: Rule<string> = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age -= 1;
  if (age < 18) return { code: 'tooYoung', message: 'Возраст должен быть не менее 18 лет' };
  if (age > 70) return { code: 'tooOld', message: 'Возраст должен быть не более 70 лет' };
  return null;
};

const ptiMax: Rule<number> = (value) =>
  value > 50 ? { code: 'ptiTooHigh', message: 'Платёж не должен превышать 50% дохода' } : null;

// ===== Cross-field rules ((f: Root) => ValidationError | null) — навешиваются через `cross` =====

const workCurrentVsTotal = (f: Root): ValidationError | null =>
  f.workExperienceCurrent != null &&
  f.workExperienceTotal != null &&
  f.workExperienceCurrent > f.workExperienceTotal
    ? { code: 'exceedsTotal', message: 'Стаж на текущем месте не может превышать общий стаж' }
    : null;

const initialPaymentMin = (f: Root): ValidationError | null =>
  f.initialPayment != null && f.propertyValue != null && f.initialPayment < f.propertyValue * 0.2
    ? { code: 'tooLow', message: 'Первоначальный взнос должен быть не менее 20% стоимости' }
    : null;

const loanAmountVsProperty = (f: Root): ValidationError | null => {
  if (f.loanType !== 'mortgage') return null;
  if (f.loanAmount == null || f.propertyValue == null) return null;
  const maxLoan = f.propertyValue - (f.initialPayment ?? 0);
  return f.loanAmount > maxLoan
    ? {
        code: 'exceedsCollateral',
        message: 'Сумма кредита не превышает (стоимость − первоначальный взнос)',
      }
    : null;
};

const additionalIncomeSourceRequired = (f: Root): ValidationError | null =>
  (f.additionalIncome ?? 0) > 0 && !f.additionalIncomeSource
    ? { code: 'required', message: 'Укажите источник дополнительного дохода' }
    : null;

// Правило строки массива: `cross` в правилах строки получает снимок самой строки
const remainingVsAmount = (loan: ExistingLoan): ValidationError | null =>
  loan.remainingAmount != null && loan.amount != null && loan.remainingAmount > loan.amount
    ? { code: 'exceedsAmount', message: 'Остаток не может превышать сумму кредита' }
    : null;

// ===== Под-схемы вложенных групп / элементов массивов =====

/** Правила адреса — подключаются к группам адреса через `apply`. */
const addressSchema = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.region, [required()]);
  validate(model.$.city, [required()]);
  validate(model.$.street, [required()]);
  validate(model.$.house, [required()]);
  validate(model.$.postalCode, [required()]);
});

const propertyItem = defineValidationSchema<Property>(({ model: im }) => {
  validate(im.$.type, [required()]);
  validate(im.$.description, [required()]);
  validate(im.$.estimatedValue, [required(), min(0)]);
});

const existingLoanItem = defineValidationSchema<ExistingLoan>(({ model: im }) => {
  validate(im.$.bank, [required()]);
  validate(im.$.type, [required()]);
  validate(im.$.amount, [required(), min(0)]);
  validate(im.$.remainingAmount, [required(), min(0)]);
  cross(im.$.remainingAmount, remainingVsAmount);
  validate(im.$.monthlyPayment, [required(), min(0)]);
  validate(im.$.maturityDate, [required()]);
});

const coBorrowerItem = defineValidationSchema<CoBorrower>(({ model: im }) => {
  validate(im.$.personalData.lastName, [required()]);
  validate(im.$.personalData.firstName, [required()]);
  validate(im.$.phone, [required()]);
  validate(im.$.email, [required(), email()]);
  validate(im.$.relationship, [required()]);
  validate(im.$.monthlyIncome, [required(), min(0)]);
});

// ===== Per-step schemas =====

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [required(), min(50000), max(10_000_000)]);
  validate(model.$.loanTerm, [required(), min(6), max(240)]);
  validate(model.$.loanPurpose, [required(), minLength(10), maxLength(500)]);
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [required(), min(1_000_000)]);
      validate(model.$.initialPayment, [required()]);
      cross(model.$.initialPayment, initialPaymentMin);
      cross(model.$.loanAmount, loanAmountVsProperty);
    }
  );
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [required(), minLength(2), maxLength(50)]);
      validate(model.$.carModel, [required(), minLength(1), maxLength(50)]);
      validate(model.$.carYear, [required(), min(2000), max(CURRENT_YEAR + 1)]);
      validate(model.$.carPrice, [required(), min(300_000), max(10_000_000)]);
    }
  );
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.lastName, [required()]);
  validate(model.$.personalData.firstName, [required()]);
  validate(model.$.personalData.middleName, [required()]);
  validate(model.$.personalData.birthDate, [required(), ageRange]);
  validate(model.$.personalData.gender, [required()]);
  validate(model.$.personalData.birthPlace, [required()]);
  validate(model.$.passportData.series, [required()]);
  validate(model.$.passportData.number, [required()]);
  validate(model.$.passportData.issueDate, [required()]);
  validate(model.$.passportData.issuedBy, [required()]);
  validate(model.$.passportData.departmentCode, [required()]);
  validate(model.$.inn, [required()]);
  validate(model.$.snils, [required()]);
});

const step3 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.phoneMain, [required()]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.emailAdditional, [email()]);
  apply(model.$.registrationAddress, addressSchema);
  validateWhen(
    () => model.sameAsRegistration === false,
    () => apply(model.$.residenceAddress, addressSchema)
  );
});

const step4 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.employmentStatus, [required()]);
  validate(model.$.workExperienceTotal, [required(), min(0)]);
  validate(model.$.workExperienceCurrent, [required(), min(0)]);
  cross(model.$.workExperienceCurrent, workCurrentVsTotal);
  validate(model.$.monthlyIncome, [required(), min(10_000)]);
  validate(model.$.additionalIncome, [min(0)]);
  cross(model.$.additionalIncomeSource, additionalIncomeSourceRequired);
  validate(model.$.paymentToIncomeRatio, [ptiMax]);
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [required()]);
      validate(model.$.companyInn, [required()]);
      validate(model.$.position, [required()]);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required()]);
      validate(model.$.businessInn, [required()]);
    }
  );
});

const step5 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.maritalStatus, [required()]);
  validate(model.$.dependents, [required(), min(0), max(10)]);
  validate(model.$.education, [required()]);
  validateWhen(
    () => model.hasProperty === true,
    () => applyEach(model.$.properties, propertyItem)
  );
  validateWhen(
    () => model.hasExistingLoans === true,
    () => applyEach(model.$.existingLoans, existingLoanItem)
  );
  validateWhen(
    () => model.hasCoBorrower === true,
    () => applyEach(model.$.coBorrowers, coBorrowerItem)
  );
});

const step6 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.agreePersonalData, [mustBeTrue('Необходимо согласие на обработку данных')]);
  validate(model.$.agreeCreditHistory, [
    mustBeTrue('Необходимо согласие на проверку кредитной истории'),
  ]);
  validate(model.$.agreeTerms, [mustBeTrue('Необходимо согласие с условиями кредитования')]);
  validate(model.$.confirmAccuracy, [mustBeTrue('Подтвердите точность введённых данных')]);
  validate(model.$.electronicSignature, [required()]);
});

// ===== Публичный контракт: правила как данные =====

/**
 * Правила формы — уходят полем `validation` в сборку `createForm`; она строит из них
 * `validateStep`/`validateAll` для визарда. Шаги в JSX заданы только номером, поэтому шаг N
 * проверяется N-м ключом `steps` — ключи держим в порядке шагов.
 */
export const creditValidation: FormValidation<Root> = {
  steps: {
    loan: step1,
    applicant: step2,
    contacts: step3,
    employment: step4,
    extra: step5,
    confirm: step6,
  },
};
