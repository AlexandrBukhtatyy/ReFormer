// validation.ts — ВСЯ валидация над моделью. Дерево field-узлов { value, validators },
// условные ветки { when, children }, cross-field ModelValidator'ы. Исполняется validateFormModel.
// Экспорт makeValidationConfig → { validateStep, validateAll } (контракт FormWizardConfig).
import {
  validateFormModel,
  type FormModel,
  type FormSchemaNode,
  type ModelValidator,
} from '@reformer/core';
import { email, max, min, maxLength, minLength, required } from '@reformer/core/validators';
import { CURRENT_YEAR, type CreditForm, type ExistingLoan } from './types';

type M = FormModel<CreditForm>;

// Локальный typed-хелпер условной ветки (НЕ экспорт библиотеки — эмитит { when, children }).
const applyWhen = (
  cond: (root: CreditForm) => boolean,
  children: FormSchemaNode[]
): FormSchemaNode => ({
  when: (_scope, root) => cond(root as CreditForm),
  children,
});

// ===== Custom / cross-field validators =====

const mustBeTrue =
  (message: string): ModelValidator<boolean> =>
  (value) =>
    value === true ? null : { code: 'required', message };

const ageRange: ModelValidator<string, unknown, CreditForm> = (value) => {
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

const workCurrentVsTotal: ModelValidator<number | null, unknown, CreditForm> = (value, _s, root) =>
  value != null && root.workExperienceTotal != null && value > root.workExperienceTotal
    ? { code: 'exceedsTotal', message: 'Стаж на текущем месте не может превышать общий стаж' }
    : null;

const initialPaymentMin: ModelValidator<number | null, unknown, CreditForm> = (value, _s, root) =>
  value != null && root.propertyValue != null && value < root.propertyValue * 0.2
    ? { code: 'tooLow', message: 'Первоначальный взнос должен быть не менее 20% стоимости' }
    : null;

const loanAmountVsProperty: ModelValidator<number | null, unknown, CreditForm> = (
  value,
  _s,
  root
) => {
  if (root.loanType !== 'mortgage') return null;
  if (value == null || root.propertyValue == null) return null;
  const maxLoan = root.propertyValue - (root.initialPayment ?? 0);
  return value > maxLoan
    ? {
        code: 'exceedsCollateral',
        message: 'Сумма кредита не превышает (стоимость − первоначальный взнос)',
      }
    : null;
};

const ptiMax: ModelValidator<number, unknown, CreditForm> = (value) =>
  value > 50 ? { code: 'ptiTooHigh', message: 'Платёж не должен превышать 50% дохода' } : null;

const additionalIncomeSourceRequired: ModelValidator<string | null, unknown, CreditForm> = (
  value,
  _s,
  root
) =>
  (root.additionalIncome ?? 0) > 0 && !value
    ? { code: 'required', message: 'Укажите источник дополнительного дохода' }
    : null;

const remainingVsAmount: ModelValidator<number, ExistingLoan, CreditForm> = (value, scope) =>
  value != null && scope?.amount != null && value > scope.amount
    ? { code: 'exceedsAmount', message: 'Остаток не может превышать сумму кредита' }
    : null;

// ===== Per-step schemas =====

const step1 = (model: M) => ({
  children: [
    { value: model.$.loanType, validators: [required({ message: 'Выберите тип кредита' })] },
    { value: model.$.loanAmount, validators: [required(), min(50000), max(10_000_000)] },
    { value: model.$.loanTerm, validators: [required(), min(6), max(240)] },
    { value: model.$.loanPurpose, validators: [required(), minLength(10), maxLength(500)] },
    applyWhen(
      (r) => r.loanType === 'mortgage',
      [
        { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
        { value: model.$.initialPayment, validators: [required(), initialPaymentMin] },
        { value: model.$.loanAmount, validators: [loanAmountVsProperty] },
      ]
    ),
    applyWhen(
      (r) => r.loanType === 'car',
      [
        { value: model.$.carBrand, validators: [required(), minLength(2), maxLength(50)] },
        { value: model.$.carModel, validators: [required(), minLength(1), maxLength(50)] },
        { value: model.$.carYear, validators: [required(), min(2000), max(CURRENT_YEAR + 1)] },
        { value: model.$.carPrice, validators: [required(), min(300_000), max(10_000_000)] },
      ]
    ),
  ],
});

const step2 = (model: M) => ({
  children: [
    { value: model.$.personalData.lastName, validators: [required()] },
    { value: model.$.personalData.firstName, validators: [required()] },
    { value: model.$.personalData.middleName, validators: [required()] },
    { value: model.$.personalData.birthDate, validators: [required(), ageRange] },
    { value: model.$.personalData.gender, validators: [required()] },
    { value: model.$.personalData.birthPlace, validators: [required()] },
    { value: model.$.passportData.series, validators: [required()] },
    { value: model.$.passportData.number, validators: [required()] },
    { value: model.$.passportData.issueDate, validators: [required()] },
    { value: model.$.passportData.issuedBy, validators: [required()] },
    { value: model.$.passportData.departmentCode, validators: [required()] },
    { value: model.$.inn, validators: [required()] },
    { value: model.$.snils, validators: [required()] },
  ],
});

const step3 = (model: M) => ({
  children: [
    { value: model.$.phoneMain, validators: [required()] },
    { value: model.$.email, validators: [required(), email()] },
    { value: model.$.emailAdditional, validators: [email()] },
    { value: model.$.registrationAddress.region, validators: [required()] },
    { value: model.$.registrationAddress.city, validators: [required()] },
    { value: model.$.registrationAddress.street, validators: [required()] },
    { value: model.$.registrationAddress.house, validators: [required()] },
    { value: model.$.registrationAddress.postalCode, validators: [required()] },
    applyWhen(
      (r) => r.sameAsRegistration === false,
      [
        { value: model.$.residenceAddress.region, validators: [required()] },
        { value: model.$.residenceAddress.city, validators: [required()] },
        { value: model.$.residenceAddress.street, validators: [required()] },
        { value: model.$.residenceAddress.house, validators: [required()] },
        { value: model.$.residenceAddress.postalCode, validators: [required()] },
      ]
    ),
  ],
});

const step4 = (model: M) => ({
  children: [
    { value: model.$.employmentStatus, validators: [required()] },
    { value: model.$.workExperienceTotal, validators: [required(), min(0)] },
    { value: model.$.workExperienceCurrent, validators: [required(), min(0), workCurrentVsTotal] },
    { value: model.$.monthlyIncome, validators: [required(), min(10_000)] },
    { value: model.$.additionalIncome, validators: [min(0)] },
    { value: model.$.additionalIncomeSource, validators: [additionalIncomeSourceRequired] },
    { value: model.$.paymentToIncomeRatio, validators: [ptiMax] },
    applyWhen(
      (r) => r.employmentStatus === 'employed',
      [
        { value: model.$.companyName, validators: [required()] },
        { value: model.$.companyInn, validators: [required()] },
        { value: model.$.position, validators: [required()] },
      ]
    ),
    applyWhen(
      (r) => r.employmentStatus === 'selfEmployed',
      [
        { value: model.$.businessType, validators: [required()] },
        { value: model.$.businessInn, validators: [required()] },
      ]
    ),
  ],
});

const step5 = (model: M) => ({
  children: [
    { value: model.$.maritalStatus, validators: [required()] },
    { value: model.$.dependents, validators: [required(), min(0), max(10)] },
    { value: model.$.education, validators: [required()] },
    applyWhen(
      (r) => r.hasProperty === true,
      [
        {
          array: model.properties,
          item: (item: FormModel<CreditForm['properties'][number]>) => ({
            children: [
              { value: item.$.type, validators: [required()] },
              { value: item.$.description, validators: [required()] },
              { value: item.$.estimatedValue, validators: [required(), min(0)] },
            ],
          }),
        },
      ]
    ),
    applyWhen(
      (r) => r.hasExistingLoans === true,
      [
        {
          array: model.existingLoans,
          item: (item: FormModel<ExistingLoan>) => ({
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
      ]
    ),
    applyWhen(
      (r) => r.hasCoBorrower === true,
      [
        {
          array: model.coBorrowers,
          item: (item: FormModel<CreditForm['coBorrowers'][number]>) => ({
            children: [
              { value: item.$.personalData.lastName, validators: [required()] },
              { value: item.$.personalData.firstName, validators: [required()] },
              { value: item.$.phone, validators: [required()] },
              { value: item.$.email, validators: [required(), email()] },
              { value: item.$.relationship, validators: [required()] },
              { value: item.$.monthlyIncome, validators: [required(), min(0)] },
            ],
          }),
        },
      ]
    ),
  ],
});

const step6 = (model: M) => ({
  children: [
    {
      value: model.$.agreePersonalData,
      validators: [mustBeTrue('Необходимо согласие на обработку данных')],
    },
    {
      value: model.$.agreeCreditHistory,
      validators: [mustBeTrue('Необходимо согласие на проверку кредитной истории')],
    },
    {
      value: model.$.agreeTerms,
      validators: [mustBeTrue('Необходимо согласие с условиями кредитования')],
    },
    {
      value: model.$.confirmAccuracy,
      validators: [mustBeTrue('Подтвердите точность введённых данных')],
    },
    { value: model.$.electronicSignature, validators: [required()] },
  ],
});

const STEP_BUILDERS = [step1, step2, step3, step4, step5, step6];

/** { validateStep, validateAll } — контракт FormWizardConfig. */
export function makeValidationConfig(model: M) {
  const stepSchemas = STEP_BUILDERS.map((build) => build(model));
  const fullSchema = { children: stepSchemas };
  return {
    validateStep: async (step: number): Promise<boolean> =>
      (await validateFormModel(model, stepSchemas[step - 1] ?? { children: [] })).valid,
    validateAll: async (): Promise<boolean> => (await validateFormModel(model, fullSchema)).valid,
  };
}
