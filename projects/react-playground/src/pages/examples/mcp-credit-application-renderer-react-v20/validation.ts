// validation.ts — ALL value validation over the MODEL (RenderNode carries no validators).
// Executed by validateFormModel; wrapped as { validateStep, validateAll } (FormWizardConfig).
// Conditional validation via branch nodes { when, children }; arrays via section nodes
// { componentProps: { control, itemComponent } }; cross-field via typed ModelValidator (reads root/scope).

import { validateFormModel, type FormModel, type ModelValidator } from '@reformer/core';
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

type M = FormModel<CreditApplicationForm>;

// ── Custom / cross-field validators ──────────────────────────────────────────
const mustBeTrue =
  (message: string): ModelValidator<boolean> =>
  (value) =>
    value === true ? null : { code: 'required', message };

const phonePattern = pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
  message: 'Формат: +7 (999) 999-99-99',
});

// current work experience cannot exceed total
const workCurrentVsTotal: ModelValidator<number | null, unknown, CreditApplicationForm> = (
  value,
  _scope,
  root
) =>
  value != null && root.workExperienceTotal != null && value > root.workExperienceTotal
    ? { code: 'tooBig', message: 'Стаж на текущем месте не может превышать общий стаж' }
    : null;

// mortgage: loanAmount must not exceed (propertyValue − initialPayment)
const loanAmountVsProperty: ModelValidator<number | null, unknown, CreditApplicationForm> = (
  value,
  _scope,
  root
) => {
  if (root.loanType !== 'mortgage' || value == null || root.propertyValue == null) return null;
  const maxLoan = root.propertyValue - (root.initialPayment ?? 0);
  return value > maxLoan
    ? { code: 'tooBig', message: 'Сумма кредита превышает стоимость минус первоначальный взнос' }
    : null;
};

// additionalIncomeSource is required when additionalIncome > 0
const sourceRequiredWhenIncome: ModelValidator<string | null, unknown, CreditApplicationForm> = (
  value,
  _scope,
  root
) =>
  (root.additionalIncome ?? 0) > 0 && !value
    ? { code: 'required', message: 'Укажите источник дополнительного дохода' }
    : null;

// payment-to-income ratio must not exceed 50%
const ratioWithinLimit: ModelValidator<number | null, unknown, CreditApplicationForm> = (value) =>
  value != null && value > 50
    ? { code: 'tooBig', message: 'Платёж не должен превышать 50% дохода' }
    : null;

// per-item (scope = ExistingLoan): remainingAmount <= amount
const remainingVsAmount: ModelValidator<number, ExistingLoan> = (value, scope) =>
  scope && value > scope.amount
    ? { code: 'tooBig', message: 'Остаток не может превышать сумму кредита' }
    : null;

// ── Per-step schema builders ─────────────────────────────────────────────────
const step1 = (m: M) => ({
  children: [
    { value: m.$.loanType, validators: [required({ message: 'Выберите тип кредита' })] },
    {
      value: m.$.loanAmount,
      validators: [
        required({ message: 'Введите сумму' }),
        min(50000, { message: 'Минимум 50 000 ₽' }),
        max(10000000, { message: 'Максимум 10 000 000 ₽' }),
        loanAmountVsProperty,
      ],
    },
    {
      value: m.$.loanTerm,
      validators: [required(), min(6, { message: 'Минимум 6 месяцев' }), max(240)],
    },
    {
      value: m.$.loanPurpose,
      validators: [required(), minLength(10), maxLength(500)],
    },
    // mortgage-only rules
    {
      when: () => m.loanType === 'mortgage',
      children: [
        {
          value: m.$.propertyValue,
          validators: [required(), min(1000000, { message: 'Минимум 1 000 000 ₽' })],
        },
      ],
    },
    // car-only rules
    {
      when: () => m.loanType === 'car',
      children: [
        { value: m.$.carBrand, validators: [required(), minLength(2), maxLength(50)] },
        { value: m.$.carModel, validators: [required(), minLength(1), maxLength(50)] },
        { value: m.$.carYear, validators: [required(), min(2000), max(MAX_CAR_YEAR)] },
        {
          value: m.$.carPrice,
          validators: [required(), min(300000), max(10000000)],
        },
      ],
    },
  ],
});

const step2 = (m: M) => ({
  children: [
    { value: m.$.personalData.lastName, validators: [required()] },
    { value: m.$.personalData.firstName, validators: [required()] },
    { value: m.$.personalData.middleName, validators: [required()] },
    {
      value: m.$.personalData.birthDate,
      validators: [
        required(),
        minAge(18, { message: 'Возраст должен быть не менее 18 лет' }),
        maxAge(70, { message: 'Возраст должен быть не более 70 лет' }),
      ],
    },
    { value: m.$.personalData.gender, validators: [required()] },
    { value: m.$.personalData.birthPlace, validators: [required()] },
    {
      value: m.$.passportData.series,
      validators: [required(), pattern(/^\d{2} \d{2}$/, { message: 'Формат: 99 99' })],
    },
    {
      value: m.$.passportData.number,
      validators: [required(), pattern(/^\d{6}$/, { message: '6 цифр' })],
    },
    { value: m.$.passportData.issueDate, validators: [required()] },
    { value: m.$.passportData.issuedBy, validators: [required()] },
    {
      value: m.$.passportData.departmentCode,
      validators: [required(), pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 999-999' })],
    },
    { value: m.$.inn, validators: [required(), pattern(/^\d{12}$/, { message: 'ИНН — 12 цифр' })] },
    { value: m.$.snils, validators: [required()] },
  ],
});

const step3 = (m: M) => ({
  children: [
    { value: m.$.phoneMain, validators: [required(), phonePattern] },
    { value: m.$.email, validators: [required(), email()] },
    { value: m.$.registrationAddress.region, validators: [required()] },
    { value: m.$.registrationAddress.city, validators: [required()] },
    { value: m.$.registrationAddress.street, validators: [required()] },
    { value: m.$.registrationAddress.house, validators: [required()] },
    {
      value: m.$.registrationAddress.postalCode,
      validators: [required(), pattern(/^\d{6}$/, { message: 'Индекс — 6 цифр' })],
    },
    // residence address required only when it differs
    {
      when: () => m.sameAsRegistration === false,
      children: [
        { value: m.$.residenceAddress.region, validators: [required()] },
        { value: m.$.residenceAddress.city, validators: [required()] },
        { value: m.$.residenceAddress.street, validators: [required()] },
        { value: m.$.residenceAddress.house, validators: [required()] },
        {
          value: m.$.residenceAddress.postalCode,
          validators: [required(), pattern(/^\d{6}$/, { message: 'Индекс — 6 цифр' })],
        },
      ],
    },
  ],
});

const step4 = (m: M) => ({
  children: [
    { value: m.$.employmentStatus, validators: [required()] },
    { value: m.$.workExperienceTotal, validators: [required(), min(0)] },
    { value: m.$.workExperienceCurrent, validators: [required(), min(0), workCurrentVsTotal] },
    {
      value: m.$.monthlyIncome,
      validators: [required(), min(10000, { message: 'Минимум 10 000 ₽' })],
    },
    { value: m.$.additionalIncome, validators: [min(0)] },
    { value: m.$.additionalIncomeSource, validators: [sourceRequiredWhenIncome] },
    // employed-only required fields
    {
      when: () => m.employmentStatus === 'employed',
      children: [
        { value: m.$.companyName, validators: [required()] },
        {
          value: m.$.companyInn,
          validators: [required(), pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' })],
        },
        { value: m.$.position, validators: [required()] },
      ],
    },
    // self-employed-only required fields
    {
      when: () => m.employmentStatus === 'selfEmployed',
      children: [
        { value: m.$.businessType, validators: [required()] },
        {
          value: m.$.businessInn,
          validators: [required(), pattern(/^\d{12}$/, { message: 'ИНН — 12 цифр' })],
        },
      ],
    },
  ],
});

const step5 = (m: M) => ({
  children: [
    { value: m.$.maritalStatus, validators: [required()] },
    { value: m.$.dependents, validators: [required(), min(0), max(10)] },
    { value: m.$.education, validators: [required()] },
    { value: m.$.paymentToIncomeRatio, validators: [ratioWithinLimit] },
    // properties[] (only when hasProperty)
    {
      when: () => m.hasProperty === true,
      children: [
        {
          componentProps: {
            control: m.properties,
            itemComponent: (item: FormModel<PropertyItem>) => ({
              children: [
                { value: item.$.type, validators: [required()] },
                { value: item.$.description, validators: [required()] },
                { value: item.$.estimatedValue, validators: [required(), min(0)] },
              ],
            }),
          },
        },
      ],
    },
    // existingLoans[] (only when hasExistingLoans)
    {
      when: () => m.hasExistingLoans === true,
      children: [
        {
          componentProps: {
            control: m.existingLoans,
            itemComponent: (item: FormModel<ExistingLoan>) => ({
              children: [
                { value: item.$.bank, validators: [required()] },
                { value: item.$.type, validators: [required()] },
                { value: item.$.amount, validators: [required(), min(0)] },
                {
                  value: item.$.remainingAmount,
                  validators: [required(), min(0), remainingVsAmount],
                },
                { value: item.$.monthlyPayment, validators: [required(), min(0)] },
                { value: item.$.maturityDate, validators: [required()] },
              ],
            }),
          },
        },
      ],
    },
    // coBorrowers[] (only when hasCoBorrower)
    {
      when: () => m.hasCoBorrower === true,
      children: [
        {
          componentProps: {
            control: m.coBorrowers,
            itemComponent: (item: FormModel<CoBorrower>) => ({
              children: [
                { value: item.$.personalData.lastName, validators: [required()] },
                { value: item.$.personalData.firstName, validators: [required()] },
                { value: item.$.phone, validators: [required(), phonePattern] },
                { value: item.$.email, validators: [required(), email()] },
                { value: item.$.relationship, validators: [required()] },
                { value: item.$.monthlyIncome, validators: [required(), min(0)] },
              ],
            }),
          },
        },
      ],
    },
  ],
});

const step6 = (m: M) => ({
  children: [
    {
      value: m.$.agreePersonalData,
      validators: [mustBeTrue('Требуется согласие на обработку данных')],
    },
    {
      value: m.$.agreeCreditHistory,
      validators: [mustBeTrue('Требуется согласие на проверку кредитной истории')],
    },
    { value: m.$.agreeTerms, validators: [mustBeTrue('Требуется согласие с условиями')] },
    { value: m.$.confirmAccuracy, validators: [mustBeTrue('Подтвердите точность данных')] },
    {
      value: m.$.electronicSignature,
      validators: [required(), pattern(/^\d{6}$/, { message: 'Код — 6 цифр' })],
    },
  ],
});

const STEP_BUILDERS = [step1, step2, step3, step4, step5, step6] as const;

/** FormWizardConfig: per-step + full validation via validateFormModel. Built fresh per call. */
export function makeCreditValidationConfig(model: M) {
  return {
    validateStep: async (step: number): Promise<boolean> => {
      const build = STEP_BUILDERS[step - 1];
      if (!build) return true;
      const res = await validateFormModel(model, build(model));
      return res.valid;
    },
    validateAll: async (): Promise<boolean> => {
      const fullSchema = { children: STEP_BUILDERS.map((build) => build(model)) };
      const res = await validateFormModel(model, fullSchema);
      return res.valid;
    },
  };
}
