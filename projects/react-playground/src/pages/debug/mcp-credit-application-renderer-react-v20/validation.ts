/**
 * Единый слой валидации кредитной заявки — контракт `@reformer/core/validation`.
 *
 * Каждый шаг — `ValidationSchema<Root>` (обычная функция `({ model }) => void`): значения проверяются
 * оператором `validate(sig, [rules])`, условные ветки — `validateWhen(cond, cb)`, cross-field — `cross(sig, fn)`
 * (fn читает снапшот `model.get()`), массивы — `each(arr, itemFn)`. Композиция формы — `apply(...шаги)`.
 * Внешний раннер — `validateModel`.
 *
 * Правила поля (`required`/`min`/…) переиспользуются как есть (value-only). Cross-field — обычные функции
 * `(f: Root) => ValidationError | null`; для элементов массива снапшот захватывается в замыкание (`im.get()`).
 *
 * Публичный контракт — `makeCreditValidationConfig(model)` → `{ validateStep, validateAll }`
 * (колбэки для `FormWizard`). Сигнатура не менялась.
 */

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
import {
  email,
  max,
  maxAge,
  maxLength,
  min,
  minAge,
  minLength,
  pattern,
  required,
} from '@reformer/core/validators';
import type { CoBorrower, CreditApplicationForm, ExistingLoan, PropertyItem } from './types';
import { MAX_CAR_YEAR } from './types';

type Root = CreditApplicationForm;
type M = FormModel<CreditApplicationForm>;

// ── Value-only custom / reusable rules ───────────────────────────────────────
const mustBeTrue =
  (message: string): Rule<boolean> =>
  (value) =>
    value === true ? null : { code: 'required', message };

const phonePattern = pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
  message: 'Формат: +7 (999) 999-99-99',
});

// payment-to-income ratio must not exceed 50% (value-only)
const ratioWithinLimit: Rule<number | null> = (value) =>
  value != null && value > 50
    ? { code: 'tooBig', message: 'Платёж не должен превышать 50% дохода' }
    : null;

// ── Cross-field правила (читают снапшот Root) ────────────────────────────────
// current work experience cannot exceed total
const workCurrentVsTotal = (f: Root): ValidationError | null =>
  f.workExperienceCurrent != null &&
  f.workExperienceTotal != null &&
  f.workExperienceCurrent > f.workExperienceTotal
    ? { code: 'tooBig', message: 'Стаж на текущем месте не может превышать общий стаж' }
    : null;

// mortgage: loanAmount must not exceed (propertyValue − initialPayment)
const loanAmountVsProperty = (f: Root): ValidationError | null => {
  if (f.loanType !== 'mortgage' || f.loanAmount == null || f.propertyValue == null) return null;
  const maxLoan = f.propertyValue - (f.initialPayment ?? 0);
  return f.loanAmount > maxLoan
    ? { code: 'tooBig', message: 'Сумма кредита превышает стоимость минус первоначальный взнос' }
    : null;
};

// additionalIncomeSource is required when additionalIncome > 0
const sourceRequiredWhenIncome = (f: Root): ValidationError | null =>
  (f.additionalIncome ?? 0) > 0 && !f.additionalIncomeSource
    ? { code: 'required', message: 'Укажите источник дополнительного дохода' }
    : null;

// per-item (снапшот ExistingLoan захвачен в замыкание): remainingAmount <= amount
const remainingVsAmount = (loan: ExistingLoan): ValidationError | null =>
  loan.remainingAmount > loan.amount
    ? { code: 'tooBig', message: 'Остаток не может превышать сумму кредита' }
    : null;

// ── Под-схемы элементов массивов ─────────────────────────────────────────────
const propertyItem = (im: FormModel<PropertyItem>): void => {
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
  validate(im.$.phone, [required(), phonePattern]);
  validate(im.$.email, [required(), email()]);
  validate(im.$.relationship, [required()]);
  validate(im.$.monthlyIncome, [required(), min(0)]);
};

// ── Per-step схемы валидации ─────────────────────────────────────────────────
const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [
    required({ message: 'Введите сумму' }),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10000000, { message: 'Максимум 10 000 000 ₽' }),
  ]);
  cross(model.$.loanAmount, loanAmountVsProperty);
  validate(model.$.loanTerm, [required(), min(6, { message: 'Минимум 6 месяцев' }), max(240)]);
  validate(model.$.loanPurpose, [required(), minLength(10), maxLength(500)]);
  // mortgage-only rules
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [
        required(),
        min(1000000, { message: 'Минимум 1 000 000 ₽' }),
      ]);
    }
  );
  // car-only rules
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [required(), minLength(2), maxLength(50)]);
      validate(model.$.carModel, [required(), minLength(1), maxLength(50)]);
      validate(model.$.carYear, [required(), min(2000), max(MAX_CAR_YEAR)]);
      validate(model.$.carPrice, [required(), min(300000), max(10000000)]);
    }
  );
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.lastName, [required()]);
  validate(model.$.personalData.firstName, [required()]);
  validate(model.$.personalData.middleName, [required()]);
  validate(model.$.personalData.birthDate, [
    required(),
    minAge(18, { message: 'Возраст должен быть не менее 18 лет' }),
    maxAge(70, { message: 'Возраст должен быть не более 70 лет' }),
  ]);
  validate(model.$.personalData.gender, [required()]);
  validate(model.$.personalData.birthPlace, [required()]);
  validate(model.$.passportData.series, [
    required(),
    pattern(/^\d{2} \d{2}$/, { message: 'Формат: 99 99' }),
  ]);
  validate(model.$.passportData.number, [required(), pattern(/^\d{6}$/, { message: '6 цифр' })]);
  validate(model.$.passportData.issueDate, [required()]);
  validate(model.$.passportData.issuedBy, [required()]);
  validate(model.$.passportData.departmentCode, [
    required(),
    pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 999-999' }),
  ]);
  validate(model.$.inn, [required(), pattern(/^\d{12}$/, { message: 'ИНН — 12 цифр' })]);
  validate(model.$.snils, [required()]);
});

const step3 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.phoneMain, [required(), phonePattern]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.registrationAddress.region, [required()]);
  validate(model.$.registrationAddress.city, [required()]);
  validate(model.$.registrationAddress.street, [required()]);
  validate(model.$.registrationAddress.house, [required()]);
  validate(model.$.registrationAddress.postalCode, [
    required(),
    pattern(/^\d{6}$/, { message: 'Индекс — 6 цифр' }),
  ]);
  // residence address required only when it differs
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.region, [required()]);
      validate(model.$.residenceAddress.city, [required()]);
      validate(model.$.residenceAddress.street, [required()]);
      validate(model.$.residenceAddress.house, [required()]);
      validate(model.$.residenceAddress.postalCode, [
        required(),
        pattern(/^\d{6}$/, { message: 'Индекс — 6 цифр' }),
      ]);
    }
  );
});

const step4 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.employmentStatus, [required()]);
  validate(model.$.workExperienceTotal, [required(), min(0)]);
  validate(model.$.workExperienceCurrent, [required(), min(0)]);
  cross(model.$.workExperienceCurrent, workCurrentVsTotal);
  validate(model.$.monthlyIncome, [required(), min(10000, { message: 'Минимум 10 000 ₽' })]);
  validate(model.$.additionalIncome, [min(0)]);
  cross(model.$.additionalIncomeSource, sourceRequiredWhenIncome);
  // employed-only required fields
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [required()]);
      validate(model.$.companyInn, [
        required(),
        pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }),
      ]);
      validate(model.$.position, [required()]);
    }
  );
  // self-employed-only required fields
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required()]);
      validate(model.$.businessInn, [
        required(),
        pattern(/^\d{12}$/, { message: 'ИНН — 12 цифр' }),
      ]);
    }
  );
});

const step5 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.maritalStatus, [required()]);
  validate(model.$.dependents, [required(), min(0), max(10)]);
  validate(model.$.education, [required()]);
  validate(model.$.paymentToIncomeRatio, [ratioWithinLimit]);
  // properties[] (only when hasProperty)
  validateWhen(
    () => model.hasProperty === true,
    () => each(model.properties, propertyItem)
  );
  // existingLoans[] (only when hasExistingLoans)
  validateWhen(
    () => model.hasExistingLoans === true,
    () => each(model.existingLoans, existingLoanItem)
  );
  // coBorrowers[] (only when hasCoBorrower)
  validateWhen(
    () => model.hasCoBorrower === true,
    () => each(model.coBorrowers, coBorrowerItem)
  );
});

const step6 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.agreePersonalData, [mustBeTrue('Требуется согласие на обработку данных')]);
  validate(model.$.agreeCreditHistory, [
    mustBeTrue('Требуется согласие на проверку кредитной истории'),
  ]);
  validate(model.$.agreeTerms, [mustBeTrue('Требуется согласие с условиями')]);
  validate(model.$.confirmAccuracy, [mustBeTrue('Подтвердите точность данных')]);
  validate(model.$.electronicSignature, [
    required(),
    pattern(/^\d{6}$/, { message: 'Код — 6 цифр' }),
  ]);
});

// ============================================================================
// Публичный контракт для FormWizard
// ============================================================================

const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [step1, step2, step3, step4, step5, step6];

/** Полная схема: все шаги (без form-level extras). */
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));

/** Пустая схема — для шага вне диапазона (гасит ранее тронутые поля, возвращает valid). */
const emptySchema: ValidationSchema<Root> = () => {};

/**
 * Конфиг валидации для `FormWizard`: per-step и полная валидация через `validateModel`.
 * Схемы — стабильные `const`-ссылки (важно для отмены устаревших прогонов в `validateModel`).
 */
export function makeCreditValidationConfig(model: M) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
  };
}
