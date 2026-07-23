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

import { type FormModel, type ValidationError } from '@reformer/core';
import {
  validate,
  validateAsync,
  validateWhen,
  cross,
  each,
  apply,
  defineValidationSchema,
  validateModel,
  type Rule,
  type AsyncRule,
  type ValidationSchema,
} from '@reformer/core/validation';
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
const addressSchema: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.region, [
    required({ message: 'Укажите регион' }),
    minLength(2, { message: 'Минимум 2 символа' }),
    maxLength(100, { message: 'Максимум 100 символов' }),
  ]);
  validate(model.$.city, [
    required({ message: 'Укажите город' }),
    minLength(2, { message: 'Минимум 2 символа' }),
    maxLength(100, { message: 'Максимум 100 символов' }),
  ]);
  validate(model.$.street, [
    required({ message: 'Укажите улицу' }),
    minLength(3, { message: 'Минимум 3 символа' }),
    maxLength(200, { message: 'Максимум 200 символов' }),
  ]);
  validate(model.$.house, [
    required({ message: 'Укажите номер дома' }),
    maxLength(10, { message: 'Максимум 10 символов' }),
  ]);
  // apartment опционален в типе Address, но всегда материализован в модели
  validate(model.$.apartment!, [maxLength(10, { message: 'Максимум 10 символов' })]);
  validate(model.$.postalCode, [
    required({ message: 'Укажите почтовый индекс' }),
    pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' }),
  ]);
};

const propertyItem = (im: FormModel<Property>): void => {
  validate(im.$.type, [required({ message: 'Укажите тип имущества' })]);
  validate(im.$.description, [
    required({ message: 'Добавьте описание имущества' }),
    minLength(10, { message: 'Минимум 10 символов' }),
    maxLength(500, { message: 'Максимум 500 символов' }),
  ]);
  validate(im.$.estimatedValue, [
    required({ message: 'Укажите оценочную стоимость' }),
    min(10000, { message: 'Минимальная стоимость: 10 000 ₽' }),
  ]);
};

const existingLoanItem = (im: FormModel<ExistingLoan>): void => {
  const loan = im.get();
  validate(im.$.bank, [
    required({ message: 'Укажите название банка' }),
    minLength(3, { message: 'Минимум 3 символа' }),
    maxLength(100, { message: 'Максимум 100 символов' }),
  ]);
  validate(im.$.type, [required({ message: 'Укажите тип кредита' })]);
  validate(im.$.amount, [
    required({ message: 'Укажите сумму кредита' }),
    min(1000, { message: 'Минимум 1 000 ₽' }),
    max(100000000, { message: 'Максимум 100 000 000 ₽' }),
  ]);
  validate(im.$.remainingAmount, [
    required({ message: 'Укажите остаток долга' }),
    min(0, { message: 'Не может быть отрицательным' }),
  ]);
  cross(im.$.remainingAmount, () => remainingNotExceedAmount(loan));
  validate(im.$.monthlyPayment, [
    required({ message: 'Укажите ежемесячный платеж' }),
    min(100, { message: 'Минимум 100 ₽' }),
  ]);
  validate(im.$.maturityDate, [required({ message: 'Укажите дату погашения' })]);
  cross(im.$.maturityDate, () => maturityInFuture(loan));
};

const coBorrowerItem = (im: FormModel<CoBorrower>): void => {
  validate(im.$.personalData.lastName, ruName('Фамилия'));
  validate(im.$.personalData.firstName, ruName('Имя'));
  validate(im.$.personalData.middleName, ruName('Отчество'));
  validate(im.$.personalData.birthDate, [
    required({ message: 'Дата рождения обязательна' }),
    minAge(18, { message: 'Созаемщику должно быть не менее 18 лет' }),
    maxAge(80, { message: 'Созаемщику должно быть не более 80 лет' }),
  ]);
  validate(im.$.phone, [required({ message: 'Телефон обязателен' })]);
  validate(im.$.email, [
    required({ message: 'Email обязателен' }),
    email({ message: 'Введите корректный email' }),
  ]);
  validate(im.$.relationship, [required({ message: 'Укажите отношение к заемщику' })]);
  validate(im.$.monthlyIncome, [
    required({ message: 'Укажите доход созаемщика' }),
    min(10000, { message: 'Минимум 10 000 ₽' }),
  ]);
};

// ============================================================================
// Per-step схемы валидации
// ============================================================================

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [
    required({ message: 'Укажите сумму кредита' }),
    min(50000, { message: 'Минимум 50 000 ₽' }),
    max(10000000, { message: 'Максимум 10 000 000 ₽' }),
  ]);
  validateWhen(
    () => model.loanType === 'mortgage',
    () => cross(model.$.loanAmount, loanAmountVsPropertyMinusPayment)
  );
  validate(model.$.loanTerm, [
    required({ message: 'Укажите срок кредита' }),
    min(6, { message: 'Минимум 6 месяцев' }),
    max(240, { message: 'Максимум 240 месяцев' }),
  ]);
  validate(model.$.loanPurpose, [
    required({ message: 'Укажите цель кредита' }),
    minLength(10, { message: 'Минимум 10 символов' }),
    maxLength(500, { message: 'Не более 500 символов' }),
  ]);

  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [
        required({ message: 'Укажите стоимость недвижимости' }),
        min(1000000, { message: 'Минимум 1 000 000 ₽' }),
      ]);
      validate(model.$.initialPayment, [
        required({ message: 'Укажите первоначальный взнос' }),
        min(0, { message: 'Не может быть отрицательным' }),
      ]);
      cross(model.$.initialPayment, initialPaymentVsProperty);
    }
  );

  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [
        required({ message: 'Укажите марку автомобиля' }),
        minLength(2, { message: 'Минимум 2 символа' }),
        maxLength(50, { message: 'Максимум 50 символов' }),
      ]);
      validate(model.$.carModel, [
        required({ message: 'Укажите модель автомобиля' }),
        minLength(1, { message: 'Минимум 1 символ' }),
        maxLength(50, { message: 'Максимум 50 символов' }),
      ]);
      validate(model.$.carYear, [
        required({ message: 'Укажите год выпуска' }),
        min(2000, { message: 'Не ранее 2000' }),
        max(CURRENT_YEAR + 1, { message: `Не позднее ${CURRENT_YEAR + 1}` }),
      ]);
      validate(model.$.carPrice, [
        required({ message: 'Укажите стоимость автомобиля' }),
        min(300000, { message: 'Минимум 300 000 ₽' }),
        max(10000000, { message: 'Максимум 10 000 000 ₽' }),
      ]);
    }
  );
});

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
  validate(model.$.personalData.birthDate, [
    required({ message: 'Дата рождения обязательна' }),
    minAge(18, { message: 'Заемщику должно быть не менее 18 лет' }),
    maxAge(70, { message: 'Максимальный возраст заемщика: 70 лет' }),
  ]);
  validate(model.$.personalData.gender, [required({ message: 'Выберите пол' })]);
  validate(model.$.personalData.birthPlace, [
    required({ message: 'Место рождения обязательно' }),
    minLength(5, { message: 'Минимум 5 символов' }),
    maxLength(100, { message: 'Максимум 100 символов' }),
  ]);
  validate(model.$.passportData.series, [
    required({ message: 'Серия паспорта обязательна' }),
    pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' }),
  ]);
  validate(model.$.passportData.number, [
    required({ message: 'Номер паспорта обязателен' }),
    pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' }),
  ]);
  validate(model.$.passportData.issueDate, [
    required({ message: 'Дата выдачи обязательна' }),
    pastDate({ message: 'Дата выдачи не может быть в будущем' }),
  ]);
  cross(model.$.passportData.issueDate, passportIssuedAfter14);
  validate(model.$.passportData.issuedBy, [
    required({ message: 'Кем выдан обязательно' }),
    minLength(10, { message: 'Минимум 10 символов' }),
    maxLength(200, { message: 'Максимум 200 символов' }),
  ]);
  validate(model.$.passportData.departmentCode, [
    required({ message: 'Код подразделения обязателен' }),
    pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' }),
  ]);
  validate(model.$.inn, [
    required({ message: 'ИНН обязателен' }),
    pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }),
  ]);
  validate(model.$.snils, [
    required({ message: 'СНИЛС обязателен' }),
    pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 000-000-000 00' }),
  ]);
});

const step3 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.phoneMain, [
    required({ message: 'Телефон обязателен' }),
    pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
  ]);
  validate(model.$.phoneAdditional, [pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' })]);
  cross(model.$.phoneAdditional, phoneAdditionalDiffers);
  validate(model.$.email, [
    required({ message: 'Email обязателен' }),
    email({ message: 'Введите корректный email' }),
  ]);
  validate(model.$.emailAdditional, [email({ message: 'Введите корректный email' })]);
  cross(model.$.emailAdditional, emailAdditionalDiffers);
  addressSchema({ model: model.registrationAddress });
  // адрес проживания — только если не совпадает с регистрацией
  validateWhen(
    () => model.sameAsRegistration === false,
    () => addressSchema({ model: model.residenceAddress })
  );
});

const step4 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.employmentStatus, [required({ message: 'Укажите статус занятости' })]);
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [
        required({ message: 'Укажите название компании' }),
        minLength(3, { message: 'Минимум 3 символа' }),
        maxLength(200, { message: 'Максимум 200 символов' }),
      ]);
      validate(model.$.companyInn, [
        required({ message: 'ИНН компании обязателен' }),
        pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }),
      ]);
      validate(model.$.companyPhone, [
        required({ message: 'Телефон компании обязателен' }),
        pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
      ]);
      validate(model.$.companyAddress, [
        required({ message: 'Адрес компании обязателен' }),
        minLength(10, { message: 'Минимум 10 символов' }),
        maxLength(300, { message: 'Максимум 300 символов' }),
      ]);
      validate(model.$.position, [
        required({ message: 'Укажите должность' }),
        minLength(3, { message: 'Минимум 3 символа' }),
        maxLength(100, { message: 'Максимум 100 символов' }),
      ]);
      validate(model.$.workExperienceTotal, [
        required({ message: 'Укажите общий стаж' }),
        min(0, { message: 'Не может быть отрицательным' }),
        max(60, { message: 'Максимум 60 лет' }),
      ]);
      validate(model.$.workExperienceCurrent, [
        required({ message: 'Укажите стаж на текущем месте' }),
        min(0, { message: 'Не может быть отрицательным' }),
        max(60, { message: 'Максимум 60 лет' }),
      ]);
      cross(model.$.workExperienceCurrent, currentExperienceVsTotal);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required({ message: 'Укажите тип бизнеса' })]);
      validate(model.$.businessInn, [
        required({ message: 'ИНН ИП обязателен' }),
        pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' }),
      ]);
      validate(model.$.businessActivity, [
        required({ message: 'Укажите вид деятельности' }),
        minLength(10, { message: 'Минимум 10 символов' }),
        maxLength(300, { message: 'Максимум 300 символов' }),
      ]);
    }
  );
  validate(model.$.monthlyIncome, [
    required({ message: 'Укажите ежемесячный доход' }),
    min(10000, { message: 'Минимум 10 000 ₽' }),
    max(10000000, { message: 'Максимум 10 000 000 ₽' }),
  ]);
  validate(model.$.additionalIncome, [
    min(0, { message: 'Не может быть отрицательным' }),
    max(10000000, { message: 'Максимум 10 000 000 ₽' }),
  ]);
  cross(model.$.additionalIncomeSource, additionalIncomeSourceRequired);
});

const step5 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.maritalStatus, [required({ message: 'Укажите семейное положение' })]);
  validate(model.$.dependents, [
    required({ message: 'Укажите количество иждивенцев' }),
    min(0, { message: 'Не может быть отрицательным' }),
    max(10, { message: 'Максимум 10' }),
  ]);
  validate(model.$.education, [required({ message: 'Укажите уровень образования' })]);
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
  validate(model.$.agreePersonalData, [
    required({ message: 'Согласие на обработку ПД обязательно' }),
  ]);
  validate(model.$.agreeCreditHistory, [
    required({ message: 'Согласие на проверку кредитной истории обязательно' }),
  ]);
  validate(model.$.agreeTerms, [required({ message: 'Согласие с условиями обязательно' })]);
  validate(model.$.confirmAccuracy, [required({ message: 'Подтверждение точности обязательно' })]);
  validate(model.$.electronicSignature, [
    required({ message: 'Введите код из СМС' }),
    minLength(6, { message: 'Код — 6 символов' }),
    maxLength(6, { message: 'Код — 6 символов' }),
    pattern(/^\d{6}$/, { message: 'Только цифры' }),
  ]);
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

const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [step1, step2, step3, step4, step5, step6];

/** Полная схема: все шаги + form-level cross-field/warnings. */
const fullSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS, fullExtras));

/** Пустая схема — для шага вне диапазона (гасит ранее тронутые поля, возвращает valid). */
const emptySchema: ValidationSchema<Root> = () => {};

/**
 * Конфиг валидации для `FormWizard`: per-step и полная валидация через `validateModel`.
 * Ошибки разносятся в ноды формы; warnings не блокируют. Схемы — стабильные `const`-ссылки
 * (важно для отмены устаревших прогонов в `validateModel`).
 */
export function makeCreditValidationConfig(model: M) {
  return {
    validateStep: (step: number): Promise<boolean> =>
      validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema),
  };
}
