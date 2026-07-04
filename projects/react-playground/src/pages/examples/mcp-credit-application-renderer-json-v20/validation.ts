// validation.ts — value validation as a TS schema over the MODEL (M1).
// JSON-DSL carries only layout; validation lives here and is executed by
// validateFormModel. Wrapped as { validateStep, validateAll } for the wizard.

import {
  validateFormModel,
  type FormModel,
  type FormSchemaNode,
  type ModelValidator,
} from '@reformer/core';
import { email, max, maxLength, min, minLength, required } from '@reformer/core/validators';
import { CURRENT_YEAR_PLUS_ONE } from './data-sources';
import type { CoBorrower, CreditApplicationForm, ExistingLoan, Property } from './types';

type M = FormModel<CreditApplicationForm>;
type Root = CreditApplicationForm;

/** Узел field-схемы для валидации по модели — публичный {@link FormSchemaNode} из ядра. */
type SchemaNode = FormSchemaNode;

// ---- Reusable custom validators -----------------------------------------

const mustBeTrue =
  (message: string): ModelValidator<boolean, unknown, unknown> =>
  (value) =>
    value === true ? null : { code: 'required', message };

const digitsExact =
  (n: number, message: string): ModelValidator<string | null, unknown, unknown> =>
  (value) => {
    if (value == null || value === '') return null; // emptiness handled by required()
    return value.replace(/\D/g, '').length === n ? null : { code: 'pattern', message };
  };

const phoneValid: ModelValidator<string | null, unknown, unknown> = (value) => {
  if (value == null || value === '') return null;
  return value.replace(/\D/g, '').length === 11
    ? null
    : { code: 'pattern', message: 'Введите телефон в формате +7 (999) 999-99-99' };
};

// ---- Cross-field validators ---------------------------------------------

const ageInRange: ModelValidator<number, unknown, unknown> = (value) => {
  if (value === 0) return null; // no birth date yet
  return value >= 18 && value <= 70
    ? null
    : { code: 'range', message: 'Возраст заёмщика должен быть от 18 до 70 лет' };
};

const ptiWithinLimit: ModelValidator<number, unknown, unknown> = (value) =>
  value <= 50 ? null : { code: 'range', message: 'Платёж не должен превышать 50% от дохода' };

const currentLteTotalExp: ModelValidator<number | null, unknown, Root> = (value, _scope, root) =>
  (value ?? 0) <= (root.workExperienceTotal ?? 0)
    ? null
    : { code: 'range', message: 'Стаж на текущем месте не может превышать общий стаж' };

const initialPaymentEnough: ModelValidator<number | null, unknown, Root> = (value, _scope, root) =>
  (value ?? 0) >= Math.round((root.propertyValue ?? 0) * 0.2)
    ? null
    : {
        code: 'min',
        message: 'Первоначальный взнос должен быть не менее 20% стоимости недвижимости',
      };

const loanWithinCollateral: ModelValidator<number | null, unknown, Root> = (value, _scope, root) =>
  (value ?? 0) <= (root.propertyValue ?? 0) - (root.initialPayment ?? 0)
    ? null
    : {
        code: 'max',
        message: 'Сумма кредита не может превышать стоимость за вычетом взноса',
      };

// ---- Array-level validators (value = whole array) -----------------------

const propertiesValid: ModelValidator<Property[], unknown, unknown> = (list) => {
  if (!list || list.length === 0)
    return { code: 'required', message: 'Добавьте хотя бы одну запись об имуществе' };
  for (const p of list) {
    if (!p.description?.trim())
      return { code: 'required', message: 'Заполните описание для каждого объекта' };
    if ((p.estimatedValue ?? 0) < 0)
      return { code: 'min', message: 'Оценочная стоимость не может быть отрицательной' };
  }
  return null;
};

const existingLoansValid: ModelValidator<ExistingLoan[], unknown, unknown> = (list) => {
  if (!list || list.length === 0)
    return { code: 'required', message: 'Добавьте хотя бы один кредит' };
  for (const l of list) {
    if (!l.bank?.trim() || !l.type?.trim())
      return { code: 'required', message: 'Заполните банк и тип для каждого кредита' };
    if ((l.remainingAmount ?? 0) > (l.amount ?? 0))
      return {
        code: 'max',
        message: 'Остаток задолженности не может превышать сумму кредита',
      };
  }
  return null;
};

const coBorrowersValid: ModelValidator<CoBorrower[], unknown, unknown> = (list) => {
  if (!list || list.length === 0)
    return { code: 'required', message: 'Добавьте хотя бы одного созаёмщика' };
  for (const c of list) {
    const p = c.personalData;
    if (!p?.lastName?.trim() || !p?.firstName?.trim())
      return { code: 'required', message: 'Заполните ФИО каждого созаёмщика' };
    if (!/^\S+@\S+\.\S+$/.test(c.email ?? ''))
      return { code: 'email', message: 'Укажите корректный email созаёмщика' };
    if ((c.phone ?? '').replace(/\D/g, '').length !== 11)
      return { code: 'pattern', message: 'Укажите телефон созаёмщика' };
  }
  return null;
};

// ---- Per-step schema builders -------------------------------------------

const step1 = (model: M): SchemaNode => ({
  children: [
    { value: model.$.loanType, validators: [required({ message: 'Выберите тип кредита' })] },
    {
      value: model.$.loanAmount,
      validators: [
        required({ message: 'Укажите сумму кредита' }),
        min(50_000, { message: 'Минимум 50 000 ₽' }),
        max(10_000_000, { message: 'Максимум 10 000 000 ₽' }),
      ],
    },
    {
      value: model.$.loanTerm,
      validators: [required(), min(6, { message: 'Минимум 6 месяцев' }), max(240)],
    },
    {
      value: model.$.loanPurpose,
      validators: [
        required({ message: 'Опишите цель кредита' }),
        minLength(10, { message: 'Минимум 10 символов' }),
        maxLength(500, { message: 'Максимум 500 символов' }),
      ],
    },
    // Mortgage-only rules.
    {
      when: (_s, root) => (root as Root).loanType === 'mortgage',
      children: [
        {
          value: model.$.propertyValue,
          validators: [required(), min(1_000_000, { message: 'Минимум 1 000 000 ₽' })],
        },
        { value: model.$.initialPayment, validators: [required(), initialPaymentEnough] },
        { value: model.$.loanAmount, validators: [loanWithinCollateral] },
      ],
    },
    // Car-loan-only rules.
    {
      when: (_s, root) => (root as Root).loanType === 'car',
      children: [
        { value: model.$.carBrand, validators: [required(), minLength(2), maxLength(50)] },
        { value: model.$.carModel, validators: [required(), maxLength(50)] },
        {
          value: model.$.carYear,
          validators: [required(), min(2000), max(CURRENT_YEAR_PLUS_ONE)],
        },
        {
          value: model.$.carPrice,
          validators: [required(), min(300_000), max(10_000_000)],
        },
      ],
    },
  ],
});

const step2 = (model: M): SchemaNode => ({
  children: [
    {
      value: model.$.personalData.lastName,
      validators: [required({ message: 'Введите фамилию' })],
    },
    { value: model.$.personalData.firstName, validators: [required({ message: 'Введите имя' })] },
    {
      value: model.$.personalData.middleName,
      validators: [required({ message: 'Введите отчество' })],
    },
    {
      value: model.$.personalData.birthDate,
      validators: [required({ message: 'Укажите дату рождения' })],
    },
    { value: model.$.personalData.gender, validators: [required()] },
    {
      value: model.$.personalData.birthPlace,
      validators: [required({ message: 'Укажите место рождения' })],
    },
    { value: model.$.age, validators: [ageInRange] },
    {
      value: model.$.passportData.series,
      validators: [required(), digitsExact(4, 'Серия — 4 цифры')],
    },
    {
      value: model.$.passportData.number,
      validators: [required(), digitsExact(6, 'Номер — 6 цифр')],
    },
    { value: model.$.passportData.issueDate, validators: [required()] },
    {
      value: model.$.passportData.issuedBy,
      validators: [required({ message: 'Укажите орган выдачи' })],
    },
    {
      value: model.$.passportData.departmentCode,
      validators: [required(), digitsExact(6, 'Код подразделения — 6 цифр')],
    },
    { value: model.$.inn, validators: [required(), digitsExact(12, 'ИНН — 12 цифр')] },
    { value: model.$.snils, validators: [required(), digitsExact(11, 'СНИЛС — 11 цифр')] },
  ],
});

const step3 = (model: M): SchemaNode => ({
  children: [
    {
      value: model.$.phoneMain,
      validators: [required({ message: 'Укажите телефон' }), phoneValid],
    },
    { value: model.$.phoneAdditional, validators: [phoneValid] },
    { value: model.$.email, validators: [required({ message: 'Укажите email' }), email()] },
    { value: model.$.emailAdditional, validators: [email()] },
    {
      value: model.$.registrationAddress.region,
      validators: [required({ message: 'Укажите регион' })],
    },
    {
      value: model.$.registrationAddress.city,
      validators: [required({ message: 'Укажите город' })],
    },
    {
      value: model.$.registrationAddress.street,
      validators: [required({ message: 'Укажите улицу' })],
    },
    {
      value: model.$.registrationAddress.house,
      validators: [required({ message: 'Укажите дом' })],
    },
    {
      value: model.$.registrationAddress.postalCode,
      validators: [required(), digitsExact(6, 'Индекс — 6 цифр')],
    },
    // Separate residence address required only when it differs.
    {
      when: (_s, root) => (root as Root).sameAsRegistration === false,
      children: [
        {
          value: model.$.residenceAddress.region,
          validators: [required({ message: 'Укажите регион' })],
        },
        {
          value: model.$.residenceAddress.city,
          validators: [required({ message: 'Укажите город' })],
        },
        {
          value: model.$.residenceAddress.street,
          validators: [required({ message: 'Укажите улицу' })],
        },
        {
          value: model.$.residenceAddress.house,
          validators: [required({ message: 'Укажите дом' })],
        },
        {
          value: model.$.residenceAddress.postalCode,
          validators: [required(), digitsExact(6, 'Индекс — 6 цифр')],
        },
      ],
    },
  ],
});

const step4 = (model: M): SchemaNode => ({
  children: [
    { value: model.$.employmentStatus, validators: [required()] },
    { value: model.$.workExperienceTotal, validators: [required(), min(0)] },
    { value: model.$.workExperienceCurrent, validators: [required(), min(0), currentLteTotalExp] },
    {
      value: model.$.monthlyIncome,
      validators: [required(), min(10_000, { message: 'Минимум 10 000 ₽' })],
    },
    { value: model.$.additionalIncome, validators: [min(0)] },
    { value: model.$.paymentToIncomeRatio, validators: [ptiWithinLimit] },
    // Additional income source required when additional income is present.
    {
      when: (_s, root) => ((root as Root).additionalIncome ?? 0) > 0,
      children: [
        {
          value: model.$.additionalIncomeSource,
          validators: [required({ message: 'Укажите источник дополнительного дохода' })],
        },
      ],
    },
    // Employed → company fields become required.
    {
      when: (_s, root) => (root as Root).employmentStatus === 'employed',
      children: [
        {
          value: model.$.companyName,
          validators: [required({ message: 'Укажите название компании' })],
        },
        {
          value: model.$.companyInn,
          validators: [required(), digitsExact(10, 'ИНН компании — 10 цифр')],
        },
        { value: model.$.position, validators: [required({ message: 'Укажите должность' })] },
      ],
    },
    // Self-employed → business fields become required.
    {
      when: (_s, root) => (root as Root).employmentStatus === 'selfEmployed',
      children: [
        { value: model.$.businessType, validators: [required({ message: 'Укажите тип бизнеса' })] },
        {
          value: model.$.businessInn,
          validators: [required(), digitsExact(12, 'ИНН ИП — 12 цифр')],
        },
      ],
    },
  ],
});

const step5 = (model: M): SchemaNode => ({
  children: [
    { value: model.$.maritalStatus, validators: [required()] },
    { value: model.$.dependents, validators: [required(), min(0), max(10)] },
    { value: model.$.education, validators: [required()] },
    {
      when: (_s, root) => (root as Root).hasProperty === true,
      children: [{ value: model.$.properties, validators: [propertiesValid] }],
    },
    {
      when: (_s, root) => (root as Root).hasExistingLoans === true,
      children: [{ value: model.$.existingLoans, validators: [existingLoansValid] }],
    },
    {
      when: (_s, root) => (root as Root).hasCoBorrower === true,
      children: [{ value: model.$.coBorrowers, validators: [coBorrowersValid] }],
    },
  ],
});

const step6 = (model: M): SchemaNode => ({
  children: [
    {
      value: model.$.agreePersonalData,
      validators: [mustBeTrue('Требуется согласие на обработку данных')],
    },
    {
      value: model.$.agreeCreditHistory,
      validators: [mustBeTrue('Требуется согласие на проверку КИ')],
    },
    { value: model.$.agreeTerms, validators: [mustBeTrue('Требуется согласие с условиями')] },
    { value: model.$.confirmAccuracy, validators: [mustBeTrue('Подтвердите точность данных')] },
    {
      value: model.$.electronicSignature,
      validators: [required({ message: 'Введите код из СМС' }), digitsExact(6, 'Код — 6 цифр')],
    },
  ],
});

const STEP_BUILDERS: Array<(model: M) => SchemaNode> = [step1, step2, step3, step4, step5, step6];

/** FormWizardConfig: per-step + full validation via validateFormModel. */
export function makeValidationConfig(model: M) {
  const stepSchemas = STEP_BUILDERS.map((build) => build(model));
  const fullSchema: SchemaNode = { children: stepSchemas };
  return {
    validateStep: async (step: number): Promise<boolean> => {
      const schema = stepSchemas[step - 1] ?? { children: [] };
      return (await validateFormModel(model, schema)).valid;
    },
    validateAll: async (): Promise<boolean> => (await validateFormModel(model, fullSchema)).valid,
  };
}
