// validation.ts — ВСЯ валидация над моделью на контракте `@reformer/core/validation`.
// Каждый шаг — `ValidationSchema<Root>` (`({ model }) => void`): значения проверяются `validate(sig, [rules])`,
// условные ветки — `validateWhen(cond, cb)`, cross-field — `cross(sig, fn)` (fn читает снапшот `model.get()`),
// массивы — `each(arr, itemFn)`. Композиция формы — `apply(...шаги)`. Внешний раннер — `validateModel`.
// Экспорт makeValidationConfig → { validateStep, validateAll } (контракт FormWizardConfig).
import { type FormModel, type ValidationError } from '@reformer/core';
import {
  validate,
  validateWhen,
  cross,
  each,
  apply,
  defineValidationSchema,
  validateModel,
  type Rule,
  type ValidationSchema,
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
type M = FormModel<CreditForm>;

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

// Per-item cross-field (читает снапшот элемента массива, захваченный в замыкание)
const remainingVsAmount = (loan: ExistingLoan): ValidationError | null =>
  loan.remainingAmount != null && loan.amount != null && loan.remainingAmount > loan.amount
    ? { code: 'exceedsAmount', message: 'Остаток не может превышать сумму кредита' }
    : null;

// ===== Под-схемы вложенных групп / элементов массивов =====

/** Под-схема адреса — функция над FormModel<Address> (reuse прямым вызовом). */
const addressSchema: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.region, [required()]);
  validate(model.$.city, [required()]);
  validate(model.$.street, [required()]);
  validate(model.$.house, [required()]);
  validate(model.$.postalCode, [required()]);
};

const propertyItem = (im: FormModel<Property>): void => {
  validate(im.$.type, [required()]);
  validate(im.$.description, [required()]);
  validate(im.$.estimatedValue, [required(), min(0)]);
};

const existingLoanItem = (im: FormModel<ExistingLoan>): void => {
  const loan = im.get();
  validate(im.$.bank, [required()]);
  validate(im.$.type, [required()]);
  validate(im.$.amount, [required(), min(0)]);
  validate(im.$.remainingAmount, [required(), min(0)]);
  cross(im.$.remainingAmount, () => remainingVsAmount(loan));
  validate(im.$.monthlyPayment, [required(), min(0)]);
  validate(im.$.maturityDate, [required()]);
};

const coBorrowerItem = (im: FormModel<CoBorrower>): void => {
  validate(im.$.personalData.lastName, [required()]);
  validate(im.$.personalData.firstName, [required()]);
  validate(im.$.phone, [required()]);
  validate(im.$.email, [required(), email()]);
  validate(im.$.relationship, [required()]);
  validate(im.$.monthlyIncome, [required(), min(0)]);
};

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
  addressSchema({ model: model.registrationAddress });
  validateWhen(
    () => model.sameAsRegistration === false,
    () => addressSchema({ model: model.residenceAddress })
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
    () => each(model.properties, propertyItem)
  );
  validateWhen(
    () => model.hasExistingLoans === true,
    () => each(model.existingLoans, existingLoanItem)
  );
  validateWhen(
    () => model.hasCoBorrower === true,
    () => each(model.coBorrowers, coBorrowerItem)
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

// ===== Публичный контракт для FormWizard =====

const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [step1, step2, step3, step4, step5, step6];

/** Полная схема: все шаги. */
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));

/** Пустая схема — для шага вне диапазона (гасит ранее тронутые поля, возвращает valid). */
const emptySchema: ValidationSchema<Root> = () => {};

/** { validateStep, validateAll } — контракт FormWizardConfig. */
export function makeValidationConfig(model: M) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
  };
}
