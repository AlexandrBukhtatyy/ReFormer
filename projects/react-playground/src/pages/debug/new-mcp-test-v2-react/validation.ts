/**
 * Валидация формы «Заявка на кредит».
 *
 * Валидация — ОТДЕЛЬНЫЙ слой над моделью: render-дерево (`RenderNode`) валидаторов не несёт.
 * Схемы — стабильные module-level `const`: по паре `(model, schema)` раннер отменяет
 * устаревшие прогоны, инлайн-стрелка ломает эту дедупликацию.
 */

import type { FormModel, ValidationError } from '@reformer/core';
import {
  apply,
  cross,
  defineValidationSchema,
  each,
  validate,
  validateModel,
  validateWhen,
  type Rule,
  type ValidationSchema,
} from '@reformer/core/validation';
import {
  email,
  max,
  maxLength,
  min,
  minLength,
  pastDate,
  pattern,
  required,
} from '@reformer/core/validators';

import {
  BORROWER_MAX_AGE,
  BORROWER_MIN_AGE,
  CAR_YEAR_MAX,
  CAR_YEAR_MIN,
  INITIAL_PAYMENT_SHARE,
  MAX_INCOME_YEARS,
  PAYMENT_TO_INCOME_LIMIT,
  PAYMENT_TO_INCOME_WARNING,
  type CreditApplicationForm,
} from './types';

type Root = CreditApplicationForm;

// --------------------------------------------------------------------------------------------
// Переиспользуемые правила значения
// --------------------------------------------------------------------------------------------

/** Чекбокс-согласие обязан быть отмечен. Готовой фабрики под это в ядре нет. */
const mustBeTrue =
  (message: string): Rule<boolean> =>
  (value) =>
    value === true ? null : { code: 'mustAccept', message };

const DIGITS_12 = /^\d{12}$/;
const DIGITS_10 = /^\d{10}$/;
const DIGITS_6 = /^\d{6}$/;
const SNILS_RE = /^\d{3}-\d{3}-\d{3} \d{2}$/;
const PASSPORT_SERIES_RE = /^\d{2} \d{2}$/;
const DEPARTMENT_CODE_RE = /^\d{3}-\d{3}$/;
const PHONE_RE = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

/** Значение поля с маской — с литералами маски; сравниваем только цифры. */
const digitsOnly = (value: string | null | undefined): string => (value ?? '').replace(/\D/g, '');

const innRule: Rule<string> = (value) =>
  !value || DIGITS_12.test(digitsOnly(value))
    ? null
    : { code: 'inn', message: 'ИНН — ровно 12 цифр' };

const companyInnRule: Rule<string | null> = (value) =>
  !value || DIGITS_10.test(digitsOnly(value))
    ? null
    : { code: 'companyInn', message: 'ИНН компании — ровно 10 цифр' };

// --------------------------------------------------------------------------------------------
// Cross-field правила (получают снапшот модели)
// --------------------------------------------------------------------------------------------

const initialPaymentVsPropertyValue = (f: Root): ValidationError | null => {
  if (f.loanType !== 'mortgage' || f.propertyValue == null || f.initialPayment == null) return null;
  const minPayment = f.propertyValue * INITIAL_PAYMENT_SHARE;
  return f.initialPayment < minPayment
    ? {
        code: 'initialPaymentTooLow',
        message: `Первоначальный взнос не менее ${Math.round(minPayment).toLocaleString('ru-RU')} ₽ (20 % стоимости)`,
      }
    : null;
};

const loanAmountVsProperty = (f: Root): ValidationError | null => {
  if (f.loanType !== 'mortgage' || f.propertyValue == null || f.loanAmount == null) return null;
  const limit = f.propertyValue - (f.initialPayment ?? 0);
  return f.loanAmount > limit
    ? {
        code: 'loanAmountTooBig',
        message: `Сумма кредита не может превышать ${Math.round(limit).toLocaleString('ru-RU')} ₽ (стоимость минус взнос)`,
      }
    : null;
};

const loanAmountVsIncome = (f: Root): ValidationError | null => {
  if (f.loanAmount == null || !f.totalIncome) return null;
  const limit = f.totalIncome * 12 * MAX_INCOME_YEARS;
  return f.loanAmount > limit
    ? {
        code: 'loanAmountOverIncome',
        message: `Максимальная сумма при вашем доходе — ${Math.round(limit).toLocaleString('ru-RU')} ₽`,
      }
    : null;
};

const loanTermVsAge = (f: Root): ValidationError | null => {
  if (f.loanTerm == null || f.age == null) return null;
  const maxMonths = Math.max(0, (BORROWER_MAX_AGE - f.age) * 12);
  return f.loanTerm > maxMonths
    ? {
        code: 'loanTermOverAge',
        message: `Кредит должен быть погашен до ${BORROWER_MAX_AGE} лет — не более ${maxMonths} мес.`,
      }
    : null;
};

const ageRange = (f: Root): ValidationError | null => {
  if (f.age == null) return null;
  if (f.age < BORROWER_MIN_AGE || f.age > BORROWER_MAX_AGE) {
    return {
      code: 'ageOutOfRange',
      message: `Возраст заёмщика — от ${BORROWER_MIN_AGE} до ${BORROWER_MAX_AGE} лет`,
    };
  }
  return f.age > 60
    ? {
        code: 'ageWarning',
        message: 'Могут потребоваться дополнительные гарантии',
        severity: 'warning',
      }
    : null;
};

const workExperienceConsistency = (f: Root): ValidationError | null => {
  if (f.workExperienceCurrent == null) return null;
  if (f.workExperienceTotal != null && f.workExperienceCurrent > f.workExperienceTotal) {
    return {
      code: 'experienceMismatch',
      message: 'Стаж на текущем месте не может быть больше общего стажа',
    };
  }
  return f.workExperienceCurrent < 3
    ? {
        code: 'experienceWarning',
        message: 'Малый стаж на текущем месте работы',
        severity: 'warning',
      }
    : null;
};

const paymentToIncome = (f: Root): ValidationError | null => {
  const ratio = f.paymentToIncomeRatio;
  if (ratio == null) return null;
  if (ratio > PAYMENT_TO_INCOME_LIMIT) {
    return {
      code: 'paymentTooHigh',
      message: `Ежемесячный платёж не должен превышать ${PAYMENT_TO_INCOME_LIMIT} % дохода (сейчас ${ratio.toFixed(1)} %)`,
    };
  }
  return ratio > PAYMENT_TO_INCOME_WARNING
    ? { code: 'debtLoadWarning', message: 'Высокая долговая нагрузка', severity: 'warning' }
    : null;
};

// --------------------------------------------------------------------------------------------
// Шаг 1 — основная информация о кредите
// --------------------------------------------------------------------------------------------

const step1 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);
  validate(model.$.loanAmount, [
    required({ message: 'Укажите сумму кредита' }),
    min(50_000, { message: 'Минимальная сумма — 50 000 ₽' }),
    max(10_000_000, { message: 'Максимальная сумма — 10 000 000 ₽' }),
  ]);
  validate(model.$.loanTerm, [
    required({ message: 'Укажите срок кредита' }),
    min(6, { message: 'Минимальный срок — 6 месяцев' }),
    max(240, { message: 'Максимальный срок — 240 месяцев' }),
  ]);
  validate(model.$.loanPurpose, [
    required({ message: 'Опишите цель кредита' }),
    minLength(10, { message: 'Не менее 10 символов' }),
    maxLength(500, { message: 'Не более 500 символов' }),
  ]);

  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [
        required({ message: 'Укажите стоимость недвижимости' }),
        min(1_000_000, { message: 'Минимальная стоимость — 1 000 000 ₽' }),
      ]);
      cross(model.$.propertyValue, initialPaymentVsPropertyValue);
      cross(model.$.loanAmount, loanAmountVsProperty);
    }
  );

  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [
        required({ message: 'Укажите марку автомобиля' }),
        minLength(2),
        maxLength(50),
      ]);
      validate(model.$.carModel, [
        required({ message: 'Укажите модель автомобиля' }),
        minLength(1),
        maxLength(50),
      ]);
      validate(model.$.carYear, [
        required({ message: 'Укажите год выпуска' }),
        min(CAR_YEAR_MIN, { message: `Не раньше ${CAR_YEAR_MIN} года` }),
        max(CAR_YEAR_MAX, { message: `Не позже ${CAR_YEAR_MAX} года` }),
      ]);
      validate(model.$.carPrice, [
        required({ message: 'Укажите стоимость автомобиля' }),
        min(300_000, { message: 'Минимальная стоимость — 300 000 ₽' }),
        max(10_000_000, { message: 'Максимальная стоимость — 10 000 000 ₽' }),
      ]);
    }
  );
});

// --------------------------------------------------------------------------------------------
// Шаг 2 — персональные данные
// --------------------------------------------------------------------------------------------

const step2 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.personalData.lastName, [required({ message: 'Укажите фамилию' })]);
  validate(model.$.personalData.firstName, [required({ message: 'Укажите имя' })]);
  validate(model.$.personalData.middleName, [required({ message: 'Укажите отчество' })]);
  validate(model.$.personalData.birthDate, [
    required({ message: 'Укажите дату рождения' }),
    pastDate({ message: 'Дата рождения не может быть в будущем' }),
  ]);
  validate(model.$.personalData.gender, [required({ message: 'Укажите пол' })]);
  validate(model.$.personalData.birthPlace, [required({ message: 'Укажите место рождения' })]);
  cross(model.$.personalData.birthDate, ageRange);

  validate(model.$.passportData.series, [
    required({ message: 'Укажите серию паспорта' }),
    pattern(PASSPORT_SERIES_RE, { message: 'Формат: 12 34' }),
  ]);
  validate(model.$.passportData.number, [
    required({ message: 'Укажите номер паспорта' }),
    pattern(DIGITS_6, { message: 'Формат: 123456' }),
  ]);
  validate(model.$.passportData.issueDate, [
    required({ message: 'Укажите дату выдачи' }),
    pastDate({ message: 'Дата выдачи не может быть в будущем' }),
  ]);
  validate(model.$.passportData.issuedBy, [required({ message: 'Укажите, кем выдан паспорт' })]);
  validate(model.$.passportData.departmentCode, [
    required({ message: 'Укажите код подразделения' }),
    pattern(DEPARTMENT_CODE_RE, { message: 'Формат: 123-456' }),
  ]);

  validate(model.$.inn, [required({ message: 'Укажите ИНН' }), innRule]);
  validate(model.$.snils, [
    required({ message: 'Укажите СНИЛС' }),
    pattern(SNILS_RE, { message: 'Формат: 123-456-789 00' }),
  ]);
});

// --------------------------------------------------------------------------------------------
// Шаг 3 — контактная информация
// --------------------------------------------------------------------------------------------

const step3 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.phoneMain, [
    required({ message: 'Укажите основной телефон' }),
    pattern(PHONE_RE, { message: 'Формат: +7 (999) 999-99-99' }),
  ]);
  validate(model.$.phoneAdditional, [pattern(PHONE_RE, { message: 'Формат: +7 (999) 999-99-99' })]);
  validate(model.$.email, [
    required({ message: 'Укажите email' }),
    email({ message: 'Некорректный email' }),
  ]);
  validate(model.$.emailAdditional, [email({ message: 'Некорректный email' })]);

  validate(model.$.registrationAddress.region, [required({ message: 'Выберите регион' })]);
  validate(model.$.registrationAddress.city, [required({ message: 'Выберите город' })]);
  validate(model.$.registrationAddress.street, [required({ message: 'Укажите улицу' })]);
  validate(model.$.registrationAddress.house, [required({ message: 'Укажите дом' })]);
  validate(model.$.registrationAddress.postalCode, [
    required({ message: 'Укажите индекс' }),
    pattern(DIGITS_6, { message: 'Индекс — 6 цифр' }),
  ]);

  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.region, [required({ message: 'Выберите регион' })]);
      validate(model.$.residenceAddress.city, [required({ message: 'Выберите город' })]);
      validate(model.$.residenceAddress.street, [required({ message: 'Укажите улицу' })]);
      validate(model.$.residenceAddress.house, [required({ message: 'Укажите дом' })]);
      validate(model.$.residenceAddress.postalCode, [
        required({ message: 'Укажите индекс' }),
        pattern(DIGITS_6, { message: 'Индекс — 6 цифр' }),
      ]);
    }
  );
});

// --------------------------------------------------------------------------------------------
// Шаг 4 — занятость и доход
// --------------------------------------------------------------------------------------------

const step4 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.employmentStatus, [required({ message: 'Укажите статус занятости' })]);

  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [required({ message: 'Укажите название компании' })]);
      validate(model.$.companyInn, [required({ message: 'Укажите ИНН компании' }), companyInnRule]);
      validate(model.$.position, [required({ message: 'Укажите должность' })]);
      validate(model.$.companyPhone, [
        pattern(PHONE_RE, { message: 'Формат: +7 (999) 999-99-99' }),
      ]);
    }
  );

  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required({ message: 'Укажите тип бизнеса' })]);
      validate(model.$.businessInn, [
        required({ message: 'Укажите ИНН ИП' }),
        (value) =>
          !value || DIGITS_12.test(digitsOnly(value))
            ? null
            : { code: 'businessInn', message: 'ИНН ИП — ровно 12 цифр' },
      ]);
    }
  );

  validate(model.$.workExperienceTotal, [
    required({ message: 'Укажите общий стаж' }),
    min(0, { message: 'Стаж не может быть отрицательным' }),
  ]);
  validate(model.$.workExperienceCurrent, [
    required({ message: 'Укажите стаж на текущем месте' }),
    min(0, { message: 'Стаж не может быть отрицательным' }),
  ]);
  cross(model.$.workExperienceCurrent, workExperienceConsistency);

  validate(model.$.monthlyIncome, [
    required({ message: 'Укажите ежемесячный доход' }),
    min(10_000, { message: 'Минимальный доход — 10 000 ₽' }),
  ]);
  validate(model.$.additionalIncome, [min(0, { message: 'Доход не может быть отрицательным' })]);
  validateWhen(
    () => (model.additionalIncome ?? 0) > 0,
    () => {
      validate(model.$.additionalIncomeSource, [
        required({ message: 'Укажите источник дополнительного дохода' }),
      ]);
    }
  );

  // Платёжеспособность и динамические лимиты — доход известен именно с этого шага.
  cross(model.$.paymentToIncomeRatio, paymentToIncome);
  cross(model.$.loanAmount, loanAmountVsIncome);
  cross(model.$.loanTerm, loanTermVsAge);
});

// --------------------------------------------------------------------------------------------
// Шаг 5 — дополнительная информация, массивы
// --------------------------------------------------------------------------------------------

const step5 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.maritalStatus, [required({ message: 'Укажите семейное положение' })]);
  validate(model.$.dependents, [
    required({ message: 'Укажите количество иждивенцев' }),
    min(0, { message: 'Не может быть отрицательным' }),
    max(10, { message: 'Не более 10' }),
  ]);
  validate(model.$.education, [required({ message: 'Выберите уровень образования' })]);

  each(model.properties, (im) => {
    validate(im.$.type, [required({ message: 'Выберите тип имущества' })]);
    validate(im.$.description, [required({ message: 'Опишите имущество' })]);
    validate(im.$.estimatedValue, [
      required({ message: 'Укажите оценочную стоимость' }),
      min(0, { message: 'Стоимость не может быть отрицательной' }),
    ]);
  });

  each(model.existingLoans, (im) => {
    const item = im.get();
    validate(im.$.bank, [required({ message: 'Укажите банк' })]);
    validate(im.$.type, [required({ message: 'Укажите тип кредита' })]);
    validate(im.$.amount, [
      required({ message: 'Укажите сумму кредита' }),
      min(0, { message: 'Сумма не может быть отрицательной' }),
    ]);
    validate(im.$.remainingAmount, [
      required({ message: 'Укажите остаток задолженности' }),
      min(0, { message: 'Остаток не может быть отрицательным' }),
    ]);
    cross(im.$.remainingAmount, () =>
      item.remainingAmount > item.amount
        ? {
            code: 'remainingTooBig',
            message: 'Остаток задолженности не может быть больше суммы кредита',
          }
        : null
    );
    validate(im.$.monthlyPayment, [
      required({ message: 'Укажите ежемесячный платёж' }),
      min(0, { message: 'Платёж не может быть отрицательным' }),
    ]);
    validate(im.$.maturityDate, [required({ message: 'Укажите дату погашения' })]);
  });

  each(model.coBorrowers, (im) => {
    validate(im.$.personalData.lastName, [required({ message: 'Укажите фамилию' })]);
    validate(im.$.personalData.firstName, [required({ message: 'Укажите имя' })]);
    validate(im.$.personalData.middleName, [required({ message: 'Укажите отчество' })]);
    validate(im.$.personalData.birthDate, [required({ message: 'Укажите дату рождения' })]);
    validate(im.$.phone, [
      required({ message: 'Укажите телефон' }),
      pattern(PHONE_RE, { message: 'Формат: +7 (999) 999-99-99' }),
    ]);
    validate(im.$.email, [
      required({ message: 'Укажите email' }),
      email({ message: 'Некорректный email' }),
    ]);
    validate(im.$.relationship, [required({ message: 'Укажите родство' })]);
    validate(im.$.monthlyIncome, [
      required({ message: 'Укажите доход созаёмщика' }),
      min(0, { message: 'Доход не может быть отрицательным' }),
    ]);
  });
});

// --------------------------------------------------------------------------------------------
// Шаг 6 — согласия и подтверждение
// --------------------------------------------------------------------------------------------

const step6 = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.agreePersonalData, [
    mustBeTrue('Требуется согласие на обработку персональных данных'),
  ]);
  validate(model.$.agreeCreditHistory, [
    mustBeTrue('Требуется согласие на проверку кредитной истории'),
  ]);
  validate(model.$.agreeTerms, [mustBeTrue('Требуется согласие с условиями кредитования')]);
  validate(model.$.confirmAccuracy, [mustBeTrue('Подтвердите точность введённых данных')]);
  validate(model.$.electronicSignature, [
    required({ message: 'Введите код из СМС' }),
    pattern(DIGITS_6, { message: 'Код — 6 цифр' }),
  ]);
});

/**
 * Точечная схема для «живой» проверки формата email с задержкой 500 мс.
 * Прогоняется поведением через `onChange(..., { debounce: 500 })`, чтобы не гонять
 * required-правила всего шага на каждое нажатие.
 */
export const emailLiveSchema = defineValidationSchema<Root>(({ model }) => {
  validate(model.$.email, [email({ message: 'Некорректный email' })]);
  validate(model.$.emailAdditional, [email({ message: 'Некорректный email' })]);
});

/** Схемы шагов в порядке следования визарда (1-based снаружи). */
export const STEP_SCHEMAS: readonly ValidationSchema<Root>[] = [
  step1,
  step2,
  step3,
  step4,
  step5,
  step6,
];

/** Полная схема формы — композиция шагов. Стабильная ссылка. */
export const fullValidationSchema = defineValidationSchema<Root>(() => apply(...STEP_SCHEMAS));

/** Шаг вне диапазона: пустая схема гасит ранее показанные ошибки, ничего не блокируя. */
const emptySchema: ValidationSchema<Root> = () => {};

/**
 * Контракт `FormWizardConfig` — две функции, возвращающие `boolean | Promise<boolean>`.
 * Раннер `validateModel` сам роутит ошибки в ноды формы, поэтому UI подсветит поля.
 */
export function makeCreditValidationConfig(model: FormModel<Root>): {
  validateStep: (step: number) => Promise<boolean>;
  validateAll: () => Promise<boolean>;
} {
  return {
    validateStep: (step: number) => validateModel(model, STEP_SCHEMAS[step - 1] ?? emptySchema),
    validateAll: () => validateModel(model, fullValidationSchema),
  };
}
