// validation.ts — ВСЯ валидация над моделью на контракте `@reformer/core/validation`.
// Каждый шаг — `ValidationSchema<Root>` (`({ model }) => void`): значения проверяются `validate(sig, [rules])`,
// условные ветки — `validateWhen(cond, cb)`, cross-field — `cross(sig, fn)` (fn читает снапшот `model.get()`).
// Композиция формы — `apply(...шаги)`. Внешний раннер — `validateModel`.
// Экспорт makeValidationConfig → { validateStep, validateAll } (контракт FormWizardConfig).

import { type FormModel, type ValidationError } from '@reformer/core';
import {
  validate,
  validateWhen,
  cross,
  apply,
  defineValidationSchema,
  validateModel,
  type Rule,
  type ValidationSchema,
} from '@reformer/core/validation';
import { email, max, maxLength, min, minLength, required } from '@reformer/core/validators';
import { CURRENT_YEAR_PLUS_ONE } from './data-sources';
import type { CoBorrower, CreditApplicationForm, ExistingLoan, Property } from './types';

type M = FormModel<CreditApplicationForm>;
type Root = CreditApplicationForm;

// ---- Reusable custom value-only rules (Rule<T>) -------------------------

const mustBeTrue =
  (message: string): Rule<boolean> =>
  (value) =>
    value === true ? null : { code: 'required', message };

const digitsExact =
  (n: number, message: string): Rule<string | null> =>
  (value) => {
    if (value == null || value === '') return null; // emptiness handled by required()
    return value.replace(/\D/g, '').length === n ? null : { code: 'pattern', message };
  };

const phoneValid: Rule<string | null> = (value) => {
  if (value == null || value === '') return null;
  return value.replace(/\D/g, '').length === 11
    ? null
    : { code: 'pattern', message: 'Введите телефон в формате +7 (999) 999-99-99' };
};

// ---- Value-only cross-range rules (Rule<T>) -----------------------------

const ageInRange: Rule<number> = (value) => {
  if (value === 0) return null; // no birth date yet
  return value >= 18 && value <= 70
    ? null
    : { code: 'range', message: 'Возраст заёмщика должен быть от 18 до 70 лет' };
};

const ptiWithinLimit: Rule<number> = (value) =>
  value <= 50 ? null : { code: 'range', message: 'Платёж не должен превышать 50% от дохода' };

// ---- Cross-field rules ((f: Root) => ValidationError | null) — через `cross` ----

const currentLteTotalExp = (f: Root): ValidationError | null =>
  (f.workExperienceCurrent ?? 0) <= (f.workExperienceTotal ?? 0)
    ? null
    : { code: 'range', message: 'Стаж на текущем месте не может превышать общий стаж' };

const initialPaymentEnough = (f: Root): ValidationError | null =>
  (f.initialPayment ?? 0) >= Math.round((f.propertyValue ?? 0) * 0.2)
    ? null
    : {
        code: 'min',
        message: 'Первоначальный взнос должен быть не менее 20% стоимости недвижимости',
      };

const loanWithinCollateral = (f: Root): ValidationError | null =>
  (f.loanAmount ?? 0) <= (f.propertyValue ?? 0) - (f.initialPayment ?? 0)
    ? null
    : {
        code: 'max',
        message: 'Сумма кредита не может превышать стоимость за вычетом взноса',
      };

// ---- Whole-array validators (принимают весь массив; навешаны через `cross` на has-флаг) ----

const propertiesValid = (list: Property[]): ValidationError | null => {
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

const existingLoansValid = (list: ExistingLoan[]): ValidationError | null => {
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

const coBorrowersValid = (list: CoBorrower[]): ValidationError | null => {
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

// ---- Per-step схемы валидации -------------------------------------------

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [
    required({ message: 'Укажите сумму кредита' }),
    min(50_000, { message: 'Минимум 50 000 ₽' }),
    max(10_000_000, { message: 'Максимум 10 000 000 ₽' }),
  ]);
  validate(model.$.loanTerm, [required(), min(6, { message: 'Минимум 6 месяцев' }), max(240)]);
  validate(model.$.loanPurpose, [
    required({ message: 'Опишите цель кредита' }),
    minLength(10, { message: 'Минимум 10 символов' }),
    maxLength(500, { message: 'Максимум 500 символов' }),
  ]);
  // Mortgage-only rules.
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [
        required(),
        min(1_000_000, { message: 'Минимум 1 000 000 ₽' }),
      ]);
      validate(model.$.initialPayment, [required()]);
      cross(model.$.initialPayment, initialPaymentEnough);
      cross(model.$.loanAmount, loanWithinCollateral);
    }
  );
  // Car-loan-only rules.
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [required(), minLength(2), maxLength(50)]);
      validate(model.$.carModel, [required(), maxLength(50)]);
      validate(model.$.carYear, [required(), min(2000), max(CURRENT_YEAR_PLUS_ONE)]);
      validate(model.$.carPrice, [required(), min(300_000), max(10_000_000)]);
    }
  );
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.lastName, [required({ message: 'Введите фамилию' })]);
  validate(model.$.personalData.firstName, [required({ message: 'Введите имя' })]);
  validate(model.$.personalData.middleName, [required({ message: 'Введите отчество' })]);
  validate(model.$.personalData.birthDate, [required({ message: 'Укажите дату рождения' })]);
  validate(model.$.personalData.gender, [required()]);
  validate(model.$.personalData.birthPlace, [required({ message: 'Укажите место рождения' })]);
  validate(model.$.age, [ageInRange]);
  validate(model.$.passportData.series, [required(), digitsExact(4, 'Серия — 4 цифры')]);
  validate(model.$.passportData.number, [required(), digitsExact(6, 'Номер — 6 цифр')]);
  validate(model.$.passportData.issueDate, [required()]);
  validate(model.$.passportData.issuedBy, [required({ message: 'Укажите орган выдачи' })]);
  validate(model.$.passportData.departmentCode, [
    required(),
    digitsExact(6, 'Код подразделения — 6 цифр'),
  ]);
  validate(model.$.inn, [required(), digitsExact(12, 'ИНН — 12 цифр')]);
  validate(model.$.snils, [required(), digitsExact(11, 'СНИЛС — 11 цифр')]);
});

const step3 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.phoneMain, [required({ message: 'Укажите телефон' }), phoneValid]);
  validate(model.$.phoneAdditional, [phoneValid]);
  validate(model.$.email, [required({ message: 'Укажите email' }), email()]);
  validate(model.$.emailAdditional, [email()]);
  validate(model.$.registrationAddress.region, [required({ message: 'Укажите регион' })]);
  validate(model.$.registrationAddress.city, [required({ message: 'Укажите город' })]);
  validate(model.$.registrationAddress.street, [required({ message: 'Укажите улицу' })]);
  validate(model.$.registrationAddress.house, [required({ message: 'Укажите дом' })]);
  validate(model.$.registrationAddress.postalCode, [required(), digitsExact(6, 'Индекс — 6 цифр')]);
  // Separate residence address required only when it differs.
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.region, [required({ message: 'Укажите регион' })]);
      validate(model.$.residenceAddress.city, [required({ message: 'Укажите город' })]);
      validate(model.$.residenceAddress.street, [required({ message: 'Укажите улицу' })]);
      validate(model.$.residenceAddress.house, [required({ message: 'Укажите дом' })]);
      validate(model.$.residenceAddress.postalCode, [
        required(),
        digitsExact(6, 'Индекс — 6 цифр'),
      ]);
    }
  );
});

const step4 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.employmentStatus, [required()]);
  validate(model.$.workExperienceTotal, [required(), min(0)]);
  validate(model.$.workExperienceCurrent, [required(), min(0)]);
  cross(model.$.workExperienceCurrent, currentLteTotalExp);
  validate(model.$.monthlyIncome, [required(), min(10_000, { message: 'Минимум 10 000 ₽' })]);
  validate(model.$.additionalIncome, [min(0)]);
  validate(model.$.paymentToIncomeRatio, [ptiWithinLimit]);
  // Additional income source required when additional income is present.
  validateWhen(
    () => (model.additionalIncome ?? 0) > 0,
    () =>
      validate(model.$.additionalIncomeSource, [
        required({ message: 'Укажите источник дополнительного дохода' }),
      ])
  );
  // Employed → company fields become required.
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [required({ message: 'Укажите название компании' })]);
      validate(model.$.companyInn, [required(), digitsExact(10, 'ИНН компании — 10 цифр')]);
      validate(model.$.position, [required({ message: 'Укажите должность' })]);
    }
  );
  // Self-employed → business fields become required.
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required({ message: 'Укажите тип бизнеса' })]);
      validate(model.$.businessInn, [required(), digitsExact(12, 'ИНН ИП — 12 цифр')]);
    }
  );
});

const step5 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.maritalStatus, [required()]);
  validate(model.$.dependents, [required(), min(0), max(10)]);
  validate(model.$.education, [required()]);
  // Whole-array валидаторы навешаны на соответствующий has-флаг, массив читается из снапшота.
  validateWhen(
    () => model.hasProperty === true,
    () => cross(model.$.hasProperty, (f: Root) => propertiesValid(f.properties))
  );
  validateWhen(
    () => model.hasExistingLoans === true,
    () => cross(model.$.hasExistingLoans, (f: Root) => existingLoansValid(f.existingLoans))
  );
  validateWhen(
    () => model.hasCoBorrower === true,
    () => cross(model.$.hasCoBorrower, (f: Root) => coBorrowersValid(f.coBorrowers))
  );
});

const step6 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.agreePersonalData, [mustBeTrue('Требуется согласие на обработку данных')]);
  validate(model.$.agreeCreditHistory, [mustBeTrue('Требуется согласие на проверку КИ')]);
  validate(model.$.agreeTerms, [mustBeTrue('Требуется согласие с условиями')]);
  validate(model.$.confirmAccuracy, [mustBeTrue('Подтвердите точность данных')]);
  validate(model.$.electronicSignature, [
    required({ message: 'Введите код из СМС' }),
    digitsExact(6, 'Код — 6 цифр'),
  ]);
});

// ============================================================================
// Публичный контракт для FormWizard
// ============================================================================

const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [step1, step2, step3, step4, step5, step6];

/** Полная схема: все шаги. */
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));

/** Пустая схема — для шага вне диапазона (гасит ранее тронутые поля, возвращает valid). */
const emptySchema: ValidationSchema<Root> = () => {};

/** FormWizardConfig: per-step + full validation via validateModel. */
export function makeValidationConfig(model: M) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
  };
}
