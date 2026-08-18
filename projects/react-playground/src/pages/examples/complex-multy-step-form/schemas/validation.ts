/**
 * Единый слой валидации кредитной заявки — контракт `@reformer/core/validation`.
 *
 * Каждый шаг — `ValidationSchema<Root>` (обычная функция `({ model }) => void`): значения проверяются
 * оператором `validate(sig, [rules])`, async — `validateAsync(sig, [asyncRules])`, условные ветки —
 * `validateWhen(cond, cb)`, cross-field — `cross(sig, fn)` (fn читает снапшот `model.get()`), массивы —
 * `each(arr, itemFn)`. Композиция формы — `apply(...шаги, fullExtras)`. Внешний раннер — `validateModel`.
 *
 * Правила поля (`required`/`min`/…) переиспользуются как есть (value-only). Cross-field — обычные функции
 * `(f: Root) => ValidationError | null`; для элементов массива снапшот захватывается в замыкание (`im.get()`).
 *
 * Используется всеми 3 вариантами флагмана через `makeCreditValidationConfig(model)` →
 * `{ validateStep, validateAll }` (колбэки для `FormWizard`). Сигнатура не менялась.
 */

import { type FormModel, type FormValidation, type ValidationError } from '@reformer/core';
import {
  validate,
  validateAsync,
  validateWhen,
  cross,
  each,
  defineValidationSchema,
  type Rule,
  type AsyncRule,
  type ValidationSchema,
} from '@reformer/core/validation';
import { defineSteps } from '@reformer/cdk';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  email,
  minAge,
  maxAge,
  pastDate,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../types/credit-application';
import type { Address } from '../components/nested-forms/Address/types';
import type { Property } from '../components/nested-forms/Property/types';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';

type Root = CreditApplicationForm;
type M = FormModel<CreditApplicationForm>;

const CURRENT_YEAR = new Date().getFullYear();
const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

// ============================================================================
// Переиспользуемые наборы правил
// ============================================================================

/** Правила ФИО (русское имя). Переиспользуется в step2 и в созаёмщике. */
const ruName = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
  pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' }),
];

/** Формат телефона: самостоятельный набор (доп. телефон) и хвост обязательных наборов. */
const PHONE_FORMAT_RULES: Rule<string>[] = [
  pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
];

/** Формат email: самостоятельный набор (доп. email) и хвост {@link EMAIL_REQUIRED_RULES}. */
const EMAIL_FORMAT_RULES: Rule<string>[] = [email({ message: 'Введите корректный email' })];

/** Обязательный email — заемщик (шаг 3) и созаемщик. */
const EMAIL_REQUIRED_RULES: Rule<string>[] = [
  required({ message: 'Email обязателен' }),
  ...EMAIL_FORMAT_RULES,
];

/** Числовое поле не может быть отрицательным. */
const NON_NEGATIVE_RULES: Rule<number>[] = [min(0, { message: 'Не может быть отрицательным' })];

/** Общий верхний предел сумм — 10 000 000 ₽. */
const MAX_10M_RUB_RULES: Rule<number>[] = [max(10000000, { message: 'Максимум 10 000 000 ₽' })];

/** Границы стажа в годах — общий и на текущем месте. */
const EXPERIENCE_YEARS_RULES: Rule<number>[] = [
  ...NON_NEGATIVE_RULES,
  max(60, { message: 'Максимум 60 лет' }),
];

// --- Шаг 1: параметры кредита -----------------------------------------------

const LOAN_TYPE_RULES: Rule<unknown>[] = [required({ message: 'Выберите тип кредита' })];

const LOAN_AMOUNT_RULES: Rule<number>[] = [
  required({ message: 'Укажите сумму кредита' }),
  min(50000, { message: 'Минимум 50 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const LOAN_TERM_RULES: Rule<number>[] = [
  required({ message: 'Укажите срок кредита' }),
  min(6, { message: 'Минимум 6 месяцев' }),
  max(240, { message: 'Максимум 240 месяцев' }),
];

const LOAN_PURPOSE_RULES: Rule<string>[] = [
  required({ message: 'Укажите цель кредита' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(500, { message: 'Не более 500 символов' }),
];

const PROPERTY_VALUE_RULES: Rule<number>[] = [
  required({ message: 'Укажите стоимость недвижимости' }),
  min(1000000, { message: 'Минимум 1 000 000 ₽' }),
];

const INITIAL_PAYMENT_RULES: Rule<number>[] = [
  required({ message: 'Укажите первоначальный взнос' }),
  ...NON_NEGATIVE_RULES,
];

const CAR_BRAND_RULES: Rule<string>[] = [
  required({ message: 'Укажите марку автомобиля' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];

const CAR_MODEL_RULES: Rule<string>[] = [
  required({ message: 'Укажите модель автомобиля' }),
  minLength(1, { message: 'Минимум 1 символ' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];

const CAR_YEAR_RULES: Rule<number>[] = [
  required({ message: 'Укажите год выпуска' }),
  min(2000, { message: 'Не ранее 2000' }),
  max(CURRENT_YEAR + 1, { message: `Не позднее ${CURRENT_YEAR + 1}` }),
];

const CAR_PRICE_RULES: Rule<number>[] = [
  required({ message: 'Укажите стоимость автомобиля' }),
  min(300000, { message: 'Минимум 300 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

// --- Шаг 2: персональные и паспортные данные --------------------------------

const BIRTH_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата рождения обязательна' }),
  minAge(18, { message: 'Заемщику должно быть не менее 18 лет' }),
  maxAge(70, { message: 'Максимальный возраст заемщика: 70 лет' }),
];

const GENDER_RULES: Rule<unknown>[] = [required({ message: 'Выберите пол' })];

const BIRTH_PLACE_RULES: Rule<string>[] = [
  required({ message: 'Место рождения обязательно' }),
  minLength(5, { message: 'Минимум 5 символов' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const PASSPORT_SERIES_RULES: Rule<string>[] = [
  required({ message: 'Серия паспорта обязательна' }),
  pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' }),
];

const PASSPORT_NUMBER_RULES: Rule<string>[] = [
  required({ message: 'Номер паспорта обязателен' }),
  pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' }),
];

const PASSPORT_ISSUE_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата выдачи обязательна' }),
  pastDate({ message: 'Дата выдачи не может быть в будущем' }),
];

const PASSPORT_ISSUED_BY_RULES: Rule<string>[] = [
  required({ message: 'Кем выдан обязательно' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const PASSPORT_DEPARTMENT_CODE_RULES: Rule<string>[] = [
  required({ message: 'Код подразделения обязателен' }),
  pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' }),
];

const INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН обязателен' }),
  pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }),
];

const SNILS_RULES: Rule<string>[] = [
  required({ message: 'СНИЛС обязателен' }),
  pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 000-000-000 00' }),
];

// --- Шаг 3: контакты и адреса -----------------------------------------------

const PHONE_MAIN_RULES: Rule<string>[] = [
  required({ message: 'Телефон обязателен' }),
  ...PHONE_FORMAT_RULES,
];

const ADDRESS_REGION_RULES: Rule<string>[] = [
  required({ message: 'Укажите регион' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const ADDRESS_CITY_RULES: Rule<string>[] = [
  required({ message: 'Укажите город' }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const ADDRESS_STREET_RULES: Rule<string>[] = [
  required({ message: 'Укажите улицу' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const ADDRESS_HOUSE_RULES: Rule<string>[] = [
  required({ message: 'Укажите номер дома' }),
  maxLength(10, { message: 'Максимум 10 символов' }),
];

const ADDRESS_APARTMENT_RULES: Rule<string | undefined>[] = [
  maxLength(10, { message: 'Максимум 10 символов' }),
];

const ADDRESS_POSTAL_CODE_RULES: Rule<string>[] = [
  required({ message: 'Укажите почтовый индекс' }),
  pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' }),
];

// --- Шаг 4: занятость и доход -----------------------------------------------

const EMPLOYMENT_STATUS_RULES: Rule<unknown>[] = [
  required({ message: 'Укажите статус занятости' }),
];

const COMPANY_NAME_RULES: Rule<string>[] = [
  required({ message: 'Укажите название компании' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(200, { message: 'Максимум 200 символов' }),
];

const COMPANY_INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН компании обязателен' }),
  pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }),
];

const COMPANY_PHONE_RULES: Rule<string>[] = [
  required({ message: 'Телефон компании обязателен' }),
  ...PHONE_FORMAT_RULES,
];

const COMPANY_ADDRESS_RULES: Rule<string>[] = [
  required({ message: 'Адрес компании обязателен' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(300, { message: 'Максимум 300 символов' }),
];

const POSITION_RULES: Rule<string>[] = [
  required({ message: 'Укажите должность' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const WORK_EXPERIENCE_TOTAL_RULES: Rule<number>[] = [
  required({ message: 'Укажите общий стаж' }),
  ...EXPERIENCE_YEARS_RULES,
];

const WORK_EXPERIENCE_CURRENT_RULES: Rule<number>[] = [
  required({ message: 'Укажите стаж на текущем месте' }),
  ...EXPERIENCE_YEARS_RULES,
];

const BUSINESS_TYPE_RULES: Rule<unknown>[] = [required({ message: 'Укажите тип бизнеса' })];

const BUSINESS_INN_RULES: Rule<string>[] = [
  required({ message: 'ИНН ИП обязателен' }),
  pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' }),
];

const BUSINESS_ACTIVITY_RULES: Rule<string>[] = [
  required({ message: 'Укажите вид деятельности' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(300, { message: 'Максимум 300 символов' }),
];

const MONTHLY_INCOME_RULES: Rule<number>[] = [
  required({ message: 'Укажите ежемесячный доход' }),
  min(10000, { message: 'Минимум 10 000 ₽' }),
  ...MAX_10M_RUB_RULES,
];

const ADDITIONAL_INCOME_RULES: Rule<number>[] = [...NON_NEGATIVE_RULES, ...MAX_10M_RUB_RULES];

// --- Шаг 5: дополнительная информация, имущество, кредиты, созаемщики --------

const MARITAL_STATUS_RULES: Rule<unknown>[] = [required({ message: 'Укажите семейное положение' })];

const DEPENDENTS_RULES: Rule<number>[] = [
  required({ message: 'Укажите количество иждивенцев' }),
  ...NON_NEGATIVE_RULES,
  max(10, { message: 'Максимум 10' }),
];

const EDUCATION_RULES: Rule<unknown>[] = [required({ message: 'Укажите уровень образования' })];

const PROPERTY_TYPE_RULES: Rule<unknown>[] = [required({ message: 'Укажите тип имущества' })];

const PROPERTY_DESCRIPTION_RULES: Rule<string>[] = [
  required({ message: 'Добавьте описание имущества' }),
  minLength(10, { message: 'Минимум 10 символов' }),
  maxLength(500, { message: 'Максимум 500 символов' }),
];

const PROPERTY_ESTIMATED_VALUE_RULES: Rule<number>[] = [
  required({ message: 'Укажите оценочную стоимость' }),
  min(10000, { message: 'Минимальная стоимость: 10 000 ₽' }),
];

const EXISTING_LOAN_BANK_RULES: Rule<string>[] = [
  required({ message: 'Укажите название банка' }),
  minLength(3, { message: 'Минимум 3 символа' }),
  maxLength(100, { message: 'Максимум 100 символов' }),
];

const EXISTING_LOAN_TYPE_RULES: Rule<unknown>[] = [required({ message: 'Укажите тип кредита' })];

const EXISTING_LOAN_AMOUNT_RULES: Rule<number>[] = [
  required({ message: 'Укажите сумму кредита' }),
  min(1000, { message: 'Минимум 1 000 ₽' }),
  max(100000000, { message: 'Максимум 100 000 000 ₽' }),
];

const EXISTING_LOAN_REMAINING_RULES: Rule<number>[] = [
  required({ message: 'Укажите остаток долга' }),
  ...NON_NEGATIVE_RULES,
];

const EXISTING_LOAN_MONTHLY_PAYMENT_RULES: Rule<number>[] = [
  required({ message: 'Укажите ежемесячный платеж' }),
  min(100, { message: 'Минимум 100 ₽' }),
];

const EXISTING_LOAN_MATURITY_DATE_RULES: Rule<string>[] = [
  required({ message: 'Укажите дату погашения' }),
];

const CO_BORROWER_BIRTH_DATE_RULES: Rule<string>[] = [
  required({ message: 'Дата рождения обязательна' }),
  minAge(18, { message: 'Созаемщику должно быть не менее 18 лет' }),
  maxAge(80, { message: 'Созаемщику должно быть не более 80 лет' }),
];

const CO_BORROWER_PHONE_RULES: Rule<string>[] = [required({ message: 'Телефон обязателен' })];

const CO_BORROWER_RELATIONSHIP_RULES: Rule<string>[] = [
  required({ message: 'Укажите отношение к заемщику' }),
];

const CO_BORROWER_INCOME_RULES: Rule<number>[] = [
  required({ message: 'Укажите доход созаемщика' }),
  min(10000, { message: 'Минимум 10 000 ₽' }),
];

// --- Шаг 6: согласия и подпись ----------------------------------------------

const AGREE_PERSONAL_DATA_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие на обработку ПД обязательно' }),
];

const AGREE_CREDIT_HISTORY_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие на проверку кредитной истории обязательно' }),
];

const AGREE_TERMS_RULES: Rule<boolean>[] = [
  required({ message: 'Согласие с условиями обязательно' }),
];

const CONFIRM_ACCURACY_RULES: Rule<boolean>[] = [
  required({ message: 'Подтверждение точности обязательно' }),
];

const ELECTRONIC_SIGNATURE_RULES: Rule<string>[] = [
  required({ message: 'Введите код из СМС' }),
  minLength(6, { message: 'Код — 6 символов' }),
  maxLength(6, { message: 'Код — 6 символов' }),
  pattern(/^\d{6}$/, { message: 'Только цифры' }),
];

// ============================================================================
// Cross-field правила уровня формы (читают снапшот Root)
// ============================================================================

const initialPaymentVsProperty = (f: Root): ValidationError | null => {
  if (f.initialPayment && f.propertyValue && f.initialPayment > f.propertyValue)
    return {
      code: 'initialPaymentTooHigh',
      message: 'Первоначальный взнос не может превышать стоимость недвижимости',
    };
  if (f.initialPayment && f.propertyValue && f.initialPayment < f.propertyValue * 0.2)
    return {
      code: 'initialPaymentTooLow',
      message: 'Первоначальный взнос не может быть меньше 20% от стоимости недвижимости',
    };
  return null;
};

const loanAmountVsPropertyMinusPayment = (f: Root): ValidationError | null => {
  if (f.loanAmount && f.propertyValue && f.initialPayment) {
    const maxLoan = f.propertyValue - f.initialPayment;
    if (f.loanAmount > maxLoan)
      return {
        code: 'loanAmountExceedsMax',
        message: `Сумма кредита не может превышать ${maxLoan.toLocaleString('ru-RU')} ₽ (стоимость минус взнос)`,
      };
  }
  return null;
};

const phoneAdditionalDiffers = (f: Root): ValidationError | null => {
  if (!f.phoneAdditional) return null;
  return f.phoneMain === f.phoneAdditional
    ? { code: 'phoneDuplicate', message: 'Дополнительный телефон должен отличаться от основного' }
    : null;
};

const emailAdditionalDiffers = (f: Root): ValidationError | null => {
  if (!f.emailAdditional) return null;
  return f.email.toLowerCase() === f.emailAdditional.toLowerCase()
    ? { code: 'emailDuplicate', message: 'Дополнительный email должен отличаться от основного' }
    : null;
};

const passportIssuedAfter14 = (f: Root): ValidationError | null => {
  if (!f.personalData.birthDate || !f.passportData.issueDate) return null;
  const birth = new Date(f.personalData.birthDate);
  const issue = new Date(f.passportData.issueDate);
  const minIssue = new Date(birth);
  minIssue.setFullYear(birth.getFullYear() + 14);
  return issue < minIssue
    ? {
        code: 'passportIssuedBeforeMinAge',
        message: 'Паспорт не может быть выдан ранее достижения 14 лет',
      }
    : null;
};

const currentExperienceVsTotal = (f: Root): ValidationError | null =>
  f.workExperienceCurrent &&
  f.workExperienceTotal &&
  f.workExperienceCurrent > f.workExperienceTotal
    ? {
        code: 'currentExperienceExceedsTotal',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      }
    : null;

const additionalIncomeSourceRequired = (f: Root): ValidationError | null =>
  f.additionalIncome && f.additionalIncome > 0 && !f.additionalIncomeSource
    ? { code: 'additionalIncomeSourceRequired', message: 'Укажите источник дополнительного дохода' }
    : null;

// Cross-field / warnings уровня всей формы (полная валидация)
const paymentToIncome = (f: Root): ValidationError | null =>
  f.paymentToIncomeRatio && f.paymentToIncomeRatio > 50
    ? {
        code: 'paymentTooHigh',
        message: `Ежемесячный платеж не должен превышать 50% дохода (сейчас ${f.paymentToIncomeRatio}%)`,
      }
    : null;

const validateAge = (f: Root): ValidationError | null => {
  if (!f.age) return null;
  if (f.age < 18) return { code: 'ageTooYoung', message: 'Заемщик должен быть старше 18 лет' };
  if (f.age > 70) return { code: 'ageTooOld', message: 'Заемщик должен быть младше 70 лет' };
  return null;
};

const warnHighDebt = (f: Root): ValidationError | null =>
  f.paymentToIncomeRatio && f.paymentToIncomeRatio > 40 && f.paymentToIncomeRatio <= 50
    ? {
        code: 'highDebtLoad',
        message: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму или увеличить срок.',
        severity: 'warning',
      }
    : null;

const warnSeniorAge = (f: Root): ValidationError | null =>
  f.age && f.age > 60 && f.age <= 70
    ? {
        code: 'seniorAge',
        message: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
        severity: 'warning',
      }
    : null;

const warnLowExperience = (f: Root): ValidationError | null =>
  f.workExperienceCurrent !== null &&
  f.workExperienceCurrent !== undefined &&
  f.workExperienceCurrent < 3
    ? {
        code: 'lowWorkExperience',
        message: 'Малый стаж на текущем месте может повлиять на решение.',
        severity: 'warning',
      }
    : null;

// Per-item cross-field (читают снапшот элемента массива, захваченный в замыкание)
const remainingNotExceedAmount = (loan: ExistingLoan): ValidationError | null =>
  loan.remainingAmount > loan.amount
    ? { code: 'remainingExceedsAmount', message: 'Остаток долга не может превышать сумму кредита' }
    : null;

const maturityInFuture = (loan: ExistingLoan): ValidationError | null => {
  if (!loan.maturityDate) return null;
  const date = new Date(loan.maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today
    ? { code: 'maturityDateInPast', message: 'Дата погашения должна быть в будущем' }
    : null;
};

// Array-level: «добавьте хотя бы один…», навешено на чекбокс-носитель (через cross)
const notEmptyWhen = (
  f: Root,
  flag: keyof Root,
  arr: keyof Root,
  message: string
): ValidationError | null => {
  const list = f[arr] as unknown as { length: number };
  return f[flag] && list.length === 0 ? { code: 'arrayEmpty', message } : null;
};

/** Async: код из СМС (демо: 123456). */
const smsCode: AsyncRule<string> = async (value) => {
  if (!value || value.length !== 6) return null;
  await new Promise((resolve) => setTimeout(resolve, 200));
  return value !== '123456'
    ? {
        code: 'invalidSmsCode',
        message: 'Неверный код подтверждения. Для демо используйте: 123456',
      }
    : null;
};

// ============================================================================
// Под-схемы вложенных групп / элементов массивов
// ============================================================================

/** Под-схема адреса — функция над FormModel<Address> (reuse прямым вызовом). */
/** Под-схема адреса — функция над FormModel<Address> (reuse прямым вызовом). */
const addressSchema: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.region, ADDRESS_REGION_RULES);
  validate(model.$.city, ADDRESS_CITY_RULES);
  validate(model.$.street, ADDRESS_STREET_RULES);
  validate(model.$.house, ADDRESS_HOUSE_RULES);
  // apartment опционален в типе Address, но всегда материализован в модели
  validate(model.$.apartment!, ADDRESS_APARTMENT_RULES);
  validate(model.$.postalCode, ADDRESS_POSTAL_CODE_RULES);
};

const propertyItem = (im: FormModel<Property>): void => {
  validate(im.$.type, PROPERTY_TYPE_RULES);
  validate(im.$.description, PROPERTY_DESCRIPTION_RULES);
  validate(im.$.estimatedValue, PROPERTY_ESTIMATED_VALUE_RULES);
};

const existingLoanItem = (im: FormModel<ExistingLoan>): void => {
  const loan = im.get();
  validate(im.$.bank, EXISTING_LOAN_BANK_RULES);
  validate(im.$.type, EXISTING_LOAN_TYPE_RULES);
  validate(im.$.amount, EXISTING_LOAN_AMOUNT_RULES);
  validate(im.$.remainingAmount, EXISTING_LOAN_REMAINING_RULES);
  cross(im.$.remainingAmount, () => remainingNotExceedAmount(loan));
  validate(im.$.monthlyPayment, EXISTING_LOAN_MONTHLY_PAYMENT_RULES);
  validate(im.$.maturityDate, EXISTING_LOAN_MATURITY_DATE_RULES);
  cross(im.$.maturityDate, () => maturityInFuture(loan));
};

const coBorrowerItem = (im: FormModel<CoBorrower>): void => {
  validate(im.$.personalData.lastName, ruName('Фамилия'));
  validate(im.$.personalData.firstName, ruName('Имя'));
  validate(im.$.personalData.middleName, ruName('Отчество'));
  validate(im.$.personalData.birthDate, CO_BORROWER_BIRTH_DATE_RULES);
  validate(im.$.phone, CO_BORROWER_PHONE_RULES);
  validate(im.$.email, EMAIL_REQUIRED_RULES);
  validate(im.$.relationship, CO_BORROWER_RELATIONSHIP_RULES);
  validate(im.$.monthlyIncome, CO_BORROWER_INCOME_RULES);
};

// ============================================================================
// Per-step схемы валидации
// ============================================================================

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, LOAN_TYPE_RULES);
  validate(model.$.loanAmount, LOAN_AMOUNT_RULES);
  validateWhen(
    () => model.loanType === 'mortgage',
    () => cross(model.$.loanAmount, loanAmountVsPropertyMinusPayment)
  );
  validate(model.$.loanTerm, LOAN_TERM_RULES);
  validate(model.$.loanPurpose, LOAN_PURPOSE_RULES);

  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, PROPERTY_VALUE_RULES);
      validate(model.$.initialPayment, INITIAL_PAYMENT_RULES);
      cross(model.$.initialPayment, initialPaymentVsProperty);
    }
  );

  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, CAR_BRAND_RULES);
      validate(model.$.carModel, CAR_MODEL_RULES);
      validate(model.$.carYear, CAR_YEAR_RULES);
      validate(model.$.carPrice, CAR_PRICE_RULES);
    }
  );
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
  validate(model.$.personalData.birthDate, BIRTH_DATE_RULES);
  validate(model.$.personalData.gender, GENDER_RULES);
  validate(model.$.personalData.birthPlace, BIRTH_PLACE_RULES);
  validate(model.$.passportData.series, PASSPORT_SERIES_RULES);
  validate(model.$.passportData.number, PASSPORT_NUMBER_RULES);
  validate(model.$.passportData.issueDate, PASSPORT_ISSUE_DATE_RULES);
  cross(model.$.passportData.issueDate, passportIssuedAfter14);
  validate(model.$.passportData.issuedBy, PASSPORT_ISSUED_BY_RULES);
  validate(model.$.passportData.departmentCode, PASSPORT_DEPARTMENT_CODE_RULES);
  validate(model.$.inn, INN_RULES);
  validate(model.$.snils, SNILS_RULES);
});

const step3 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.phoneMain, PHONE_MAIN_RULES);
  validate(model.$.phoneAdditional, PHONE_FORMAT_RULES);
  cross(model.$.phoneAdditional, phoneAdditionalDiffers);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.emailAdditional, EMAIL_FORMAT_RULES);
  cross(model.$.emailAdditional, emailAdditionalDiffers);
  addressSchema({ model: model.registrationAddress });
  // адрес проживания — только если не совпадает с регистрацией
  validateWhen(
    () => model.sameAsRegistration === false,
    () => addressSchema({ model: model.residenceAddress })
  );
});

const step4 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.employmentStatus, EMPLOYMENT_STATUS_RULES);
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, COMPANY_NAME_RULES);
      validate(model.$.companyInn, COMPANY_INN_RULES);
      validate(model.$.companyPhone, COMPANY_PHONE_RULES);
      validate(model.$.companyAddress, COMPANY_ADDRESS_RULES);
      validate(model.$.position, POSITION_RULES);
      validate(model.$.workExperienceTotal, WORK_EXPERIENCE_TOTAL_RULES);
      validate(model.$.workExperienceCurrent, WORK_EXPERIENCE_CURRENT_RULES);
      cross(model.$.workExperienceCurrent, currentExperienceVsTotal);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, BUSINESS_TYPE_RULES);
      validate(model.$.businessInn, BUSINESS_INN_RULES);
      validate(model.$.businessActivity, BUSINESS_ACTIVITY_RULES);
    }
  );
  validate(model.$.monthlyIncome, MONTHLY_INCOME_RULES);
  validate(model.$.additionalIncome, ADDITIONAL_INCOME_RULES);
  cross(model.$.additionalIncomeSource, additionalIncomeSourceRequired);
});

const step5 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.maritalStatus, MARITAL_STATUS_RULES);
  validate(model.$.dependents, DEPENDENTS_RULES);
  validate(model.$.education, EDUCATION_RULES);
  cross(model.$.hasProperty, (f: Root) =>
    notEmptyWhen(f, 'hasProperty', 'properties', 'Добавьте хотя бы один объект имущества')
  );
  cross(model.$.hasExistingLoans, (f: Root) =>
    notEmptyWhen(f, 'hasExistingLoans', 'existingLoans', 'Добавьте информацию о кредите')
  );
  cross(model.$.hasCoBorrower, (f: Root) =>
    notEmptyWhen(f, 'hasCoBorrower', 'coBorrowers', 'Добавьте информацию о созаемщике')
  );
  each(model.properties, propertyItem);
  each(model.existingLoans, existingLoanItem);
  each(model.coBorrowers, coBorrowerItem);
});

const step6 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.agreePersonalData, AGREE_PERSONAL_DATA_RULES);
  validate(model.$.agreeCreditHistory, AGREE_CREDIT_HISTORY_RULES);
  validate(model.$.agreeTerms, AGREE_TERMS_RULES);
  validate(model.$.confirmAccuracy, CONFIRM_ACCURACY_RULES);
  validate(model.$.electronicSignature, ELECTRONIC_SIGNATURE_RULES);
  validateAsync(model.$.electronicSignature, [smsCode]);
});

/** Cross-field/warnings уровня всей формы (вне per-step). */
const fullExtras = defineValidationSchema<Root>(({ model }) => {
  cross(model.$.monthlyPayment, paymentToIncome);
  cross(model.$.age, validateAge);
  cross(model.$.age, warnSeniorAge);
  cross(model.$.paymentToIncomeRatio, warnHighDebt);
  cross(model.$.workExperienceCurrent, warnLowExperience);
});

// ============================================================================
// Публичный контракт для FormWizard
// ============================================================================

/**
 * Правила валидации формы как ДАННЫЕ — то, что уходит полем `validation` в фабрику формы
 * (`createCoreForm`/`createReactForm`/`createJsonForm`). Фабрика сама соберёт из них
 * `validateStep`/`validateAll` и контроллер живой стратегии.
 *
 * Правила адресованы по `selector` шага (loan/applicant/…), а не хрупким числовым индексом
 * `[step - 1]`: добавление или перестановка шага не рассинхронизирует их молча, а шаг без правил
 * объявляется ЯВНО. Порядок ключей = порядок шагов. `extras` (cross-field/warnings) проверяются
 * только целиком, на submit.
 *
 * Стабильная ссылка на уровне модуля обязательна: отмена устаревших прогонов ключуется по паре
 * `(model, schema)`.
 */
export const creditApplicationValidation: FormValidation<Root> = {
  steps: {
    loan: step1,
    applicant: step2,
    contacts: step3,
    employment: step4,
    additional: step5,
    confirmation: step6,
  },
  extras: fullExtras,
};

/**
 * Тот же набор правил, но собранный под `FormWizard` руками — для варианта, который строит форму без
 * фабрики (`createForm` напрямую). Новый код берёт {@link creditApplicationValidation} и получает
 * готовый конфиг из бандла формы.
 */
export function makeCreditValidationConfig(model: M) {
  return defineSteps<
    'loan' | 'applicant' | 'contacts' | 'employment' | 'additional' | 'confirmation',
    Root
  >(model, {
    steps: creditApplicationValidation.steps as Record<string, ValidationSchema<Root> | null>,
    extras: fullExtras,
  });
}
