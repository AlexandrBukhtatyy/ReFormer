/**
 * Валидация значений — отдельная TS-схема НАД МОДЕЛЬЮ.
 *
 * JSON-DSL несёт только layout: у field-ноды нет `validators`, оператора
 * `$validator(...)` не существует. Правила исполняет раннер `validateModel`,
 * а `createJsonForm({ validation: { steps, extras } })` собирает из них
 * `validateStep`/`validateAll` с адресацией по `selector` шага.
 *
 * Все схемы — module-level `const`: отмена устаревшего прогона ключуется по
 * паре `(model, schema)`, инлайн-стрелка ломает дедупликацию.
 */
import type { ValidationError } from '@reformer/core';
import {
  cross,
  defineValidationSchema,
  each,
  validate,
  validateWhen,
  type ValidationSchema,
} from '@reformer/core/validation';
import {
  email as emailRule,
  max,
  maxLength,
  min,
  minLength,
  required,
} from '@reformer/core/validators';

import { CURRENT_YEAR_PLUS_ONE, maxLoanByIncome, maxTermByAge } from './data-sources';
import type { CreditApplicationForm, StepSelector } from './types';

type Form = CreditApplicationForm;

/* ------------------------------------------------------------------ */
/* Шаг 1 — параметры кредита                                          */
/* ------------------------------------------------------------------ */

const loanStep = defineValidationSchema<Form>(({ model }) => {
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

  // Ипотека — поля включаются только при loanType='mortgage'.
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [
        required({ message: 'Укажите стоимость недвижимости' }),
        min(1_000_000, { message: 'Минимальная стоимость — 1 000 000 ₽' }),
      ]);
      // Первоначальный взнос — минимум 20 % от стоимости.
      cross(model.$.propertyValue, (f: Form) => {
        const value = f.propertyValue ?? 0;
        const payment = f.initialPayment ?? 0;
        return value > 0 && payment < value * 0.2
          ? {
              code: 'initial-payment-too-low',
              message: 'Первоначальный взнос должен быть не менее 20 % стоимости',
            }
          : null;
      });
      // Сумма кредита не превышает (стоимость − первоначальный взнос).
      cross(model.$.loanAmount, (f: Form) => {
        const rest = (f.propertyValue ?? 0) - (f.initialPayment ?? 0);
        return rest > 0 && (f.loanAmount ?? 0) > rest
          ? {
              code: 'loan-exceeds-property',
              message: `Сумма кредита не может превышать ${rest.toLocaleString('ru-RU')} ₽`,
            }
          : null;
      });
    }
  );

  // Автокредит.
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [
        required({ message: 'Выберите марку' }),
        minLength(2, { message: 'Не менее 2 символов' }),
        maxLength(50, { message: 'Не более 50 символов' }),
      ]);
      validate(model.$.carModel, [
        required({ message: 'Выберите модель' }),
        minLength(1, { message: 'Не менее 1 символа' }),
        maxLength(50, { message: 'Не более 50 символов' }),
      ]);
      validate(model.$.carYear, [
        required({ message: 'Укажите год выпуска' }),
        min(2000, { message: 'Не ранее 2000 года' }),
        max(CURRENT_YEAR_PLUS_ONE, { message: `Не позднее ${CURRENT_YEAR_PLUS_ONE} года` }),
      ]);
      validate(model.$.carPrice, [
        required({ message: 'Укажите стоимость автомобиля' }),
        min(300_000, { message: 'Минимальная стоимость — 300 000 ₽' }),
        max(10_000_000, { message: 'Максимальная стоимость — 10 000 000 ₽' }),
      ]);
    }
  );
});

/* ------------------------------------------------------------------ */
/* Шаг 2 — персональные данные                                        */
/* ------------------------------------------------------------------ */

const personalStep = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.personalData.lastName, [required({ message: 'Введите фамилию' })]);
  validate(model.$.personalData.firstName, [required({ message: 'Введите имя' })]);
  validate(model.$.personalData.middleName, [required({ message: 'Введите отчество' })]);
  validate(model.$.personalData.birthDate, [required({ message: 'Укажите дату рождения' })]);
  validate(model.$.personalData.gender, [required({ message: 'Укажите пол' })]);
  validate(model.$.personalData.birthPlace, [required({ message: 'Введите место рождения' })]);

  validate(model.$.passportData.series, [required({ message: 'Введите серию паспорта' })]);
  validate(model.$.passportData.number, [required({ message: 'Введите номер паспорта' })]);
  validate(model.$.passportData.issueDate, [required({ message: 'Укажите дату выдачи' })]);
  validate(model.$.passportData.issuedBy, [required({ message: 'Укажите кем выдан' })]);
  validate(model.$.passportData.departmentCode, [
    required({ message: 'Введите код подразделения' }),
  ]);

  validate(model.$.inn, [required({ message: 'Введите ИНН' })]);
  validate(model.$.snils, [required({ message: 'Введите СНИЛС' })]);

  // Возраст 18–70. Носитель ошибки — редактируемая дата рождения:
  // вычисляемое `age` отключено (readonly) и не показывает ошибок.
  cross(model.$.personalData.birthDate, (f: Form) => {
    const age = f.age;
    if (age === null) return null;
    if (age < 18) return { code: 'age-too-low', message: 'Заемщику должно быть не менее 18 лет' };
    if (age > 70) return { code: 'age-too-high', message: 'Заемщику должно быть не более 70 лет' };
    return null;
  });
});

/* ------------------------------------------------------------------ */
/* Шаг 3 — контакты                                                   */
/* ------------------------------------------------------------------ */

const contactsStep = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.phoneMain, [required({ message: 'Введите основной телефон' })]);
  validate(model.$.email, [
    required({ message: 'Введите email' }),
    emailRule({ message: 'Некорректный email' }),
  ]);
  // Дополнительный email необязателен, но если введён — обязан быть валидным.
  validateWhen(
    () => Boolean(model.emailAdditional),
    () => {
      validate(model.$.emailAdditional, [emailRule({ message: 'Некорректный email' })]);
    }
  );

  validate(model.$.registrationAddress.region, [required({ message: 'Выберите регион' })]);
  validate(model.$.registrationAddress.city, [required({ message: 'Выберите город' })]);
  validate(model.$.registrationAddress.street, [required({ message: 'Введите улицу' })]);
  validate(model.$.registrationAddress.house, [required({ message: 'Введите дом' })]);
  validate(model.$.registrationAddress.postalCode, [required({ message: 'Введите индекс' })]);

  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.region, [required({ message: 'Выберите регион' })]);
      validate(model.$.residenceAddress.city, [required({ message: 'Выберите город' })]);
      validate(model.$.residenceAddress.street, [required({ message: 'Введите улицу' })]);
      validate(model.$.residenceAddress.house, [required({ message: 'Введите дом' })]);
      validate(model.$.residenceAddress.postalCode, [required({ message: 'Введите индекс' })]);
    }
  );
});

/* ------------------------------------------------------------------ */
/* Шаг 4 — занятость и доходы                                         */
/* ------------------------------------------------------------------ */

const employmentStep = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.employmentStatus, [required({ message: 'Укажите статус занятости' })]);

  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [required({ message: 'Введите название компании' })]);
      validate(model.$.companyInn, [required({ message: 'Введите ИНН компании' })]);
      validate(model.$.position, [required({ message: 'Введите должность' })]);
    }
  );

  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required({ message: 'Укажите тип бизнеса' })]);
      validate(model.$.businessInn, [required({ message: 'Введите ИНН' })]);
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
  // Стаж на текущем месте не больше общего.
  cross(model.$.workExperienceCurrent, (f: Form) =>
    (f.workExperienceCurrent ?? 0) > (f.workExperienceTotal ?? 0)
      ? {
          code: 'experience-mismatch',
          message: 'Стаж на текущем месте не может превышать общий стаж',
        }
      : null
  );
  // Предупреждение: малый стаж (не блокирует submit).
  cross(model.$.workExperienceCurrent, (f: Form) =>
    f.workExperienceCurrent !== null && f.workExperienceCurrent < 3
      ? {
          code: 'experience-warning',
          message: 'Малый стаж на текущем месте работы',
          severity: 'warning',
        }
      : null
  );

  validate(model.$.monthlyIncome, [
    required({ message: 'Укажите ежемесячный доход' }),
    min(10_000, { message: 'Минимальный доход — 10 000 ₽' }),
  ]);
  validateWhen(
    () => (model.additionalIncome ?? 0) > 0,
    () => {
      validate(model.$.additionalIncome, [
        min(0, { message: 'Доход не может быть отрицательным' }),
      ]);
      validate(model.$.additionalIncomeSource, [
        required({ message: 'Укажите источник дополнительного дохода' }),
      ]);
    }
  );
});

/* ------------------------------------------------------------------ */
/* Шаг 5 — дополнительная информация                                  */
/* ------------------------------------------------------------------ */

const additionalStep = defineValidationSchema<Form>(({ model }) => {
  validate(model.$.maritalStatus, [required({ message: 'Укажите семейное положение' })]);
  validate(model.$.dependents, [
    required({ message: 'Укажите количество иждивенцев' }),
    min(0, { message: 'Не может быть отрицательным' }),
    max(10, { message: 'Не более 10' }),
  ]);
  validate(model.$.education, [required({ message: 'Выберите уровень образования' })]);

  each(model.properties, (item) => {
    validate(item.$.type, [required({ message: 'Выберите тип имущества' })]);
    validate(item.$.description, [required({ message: 'Опишите имущество' })]);
    validate(item.$.estimatedValue, [
      required({ message: 'Укажите стоимость' }),
      min(0, { message: 'Не может быть отрицательной' }),
    ]);
  });

  each(model.existingLoans, (item) => {
    validate(item.$.bank, [required({ message: 'Укажите банк' })]);
    validate(item.$.type, [required({ message: 'Укажите тип кредита' })]);
    validate(item.$.amount, [required({ message: 'Укажите сумму' }), min(0)]);
    validate(item.$.remainingAmount, [required({ message: 'Укажите остаток' }), min(0)]);
    validate(item.$.monthlyPayment, [required({ message: 'Укажите платёж' }), min(0)]);
    validate(item.$.maturityDate, [required({ message: 'Укажите дату погашения' })]);
    // Остаток не больше суммы кредита. Снимок элемента берём в замыкание:
    // cross всегда получает модель корневого scope.
    const snapshot = item.get();
    cross(item.$.remainingAmount, () =>
      (snapshot.remainingAmount ?? 0) > (snapshot.amount ?? 0)
        ? { code: 'remaining-too-big', message: 'Остаток не может превышать сумму кредита' }
        : null
    );
  });

  each(model.coBorrowers, (item) => {
    validate(item.$.personalData.lastName, [required({ message: 'Введите фамилию' })]);
    validate(item.$.personalData.firstName, [required({ message: 'Введите имя' })]);
    validate(item.$.personalData.middleName, [required({ message: 'Введите отчество' })]);
    validate(item.$.personalData.birthDate, [required({ message: 'Укажите дату рождения' })]);
    validate(item.$.personalData.birthPlace, [required({ message: 'Введите место рождения' })]);
    validate(item.$.phone, [required({ message: 'Введите телефон' })]);
    validate(item.$.email, [required({ message: 'Введите email' }), emailRule()]);
    validate(item.$.relationship, [required({ message: 'Укажите родство' })]);
    validate(item.$.monthlyIncome, [required({ message: 'Укажите доход' }), min(0)]);
  });
});

/* ------------------------------------------------------------------ */
/* Шаг 6 — согласия и подтверждение                                   */
/* ------------------------------------------------------------------ */

const mustBeTrue =
  (message: string) =>
  (value: boolean | null): ValidationError | null =>
    value === true ? null : { code: 'must-accept', message };

const confirmStep = defineValidationSchema<Form>(({ model }) => {
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
    minLength(6, { message: 'Код состоит из 6 цифр' }),
  ]);
});

/* ------------------------------------------------------------------ */
/* Cross-field правила всей формы (только на submit)                  */
/* ------------------------------------------------------------------ */

const crossFieldRules = defineValidationSchema<Form>(({ model }) => {
  // Платёж не более 50 % дохода. Носитель — редактируемая сумма кредита.
  cross(model.$.loanAmount, (f: Form) =>
    (f.paymentToIncomeRatio ?? 0) > 50
      ? {
          code: 'payment-to-income',
          message: 'Ежемесячный платёж не должен превышать 50 % от дохода',
        }
      : null
  );
  // Динамический лимит: не более 10 годовых доходов.
  cross(model.$.loanAmount, (f: Form) => {
    const limit = maxLoanByIncome(f.totalIncome);
    return (f.loanAmount ?? 0) > limit
      ? {
          code: 'loan-over-income-limit',
          message: `С таким доходом максимальная сумма — ${limit.toLocaleString('ru-RU')} ₽`,
        }
      : null;
  });
  // Динамический лимит: погашение до 70 лет.
  cross(model.$.loanTerm, (f: Form) => {
    const limit = maxTermByAge(f.age);
    return (f.loanTerm ?? 0) > limit
      ? {
          code: 'term-over-age-limit',
          message: `С учётом возраста максимальный срок — ${limit} мес.`,
        }
      : null;
  });
  // Предупреждение о высокой долговой нагрузке (не блокирует submit).
  cross(model.$.monthlyIncome, (f: Form) => {
    const ratio = f.paymentToIncomeRatio ?? 0;
    return ratio > 40 && ratio <= 50
      ? { code: 'debt-load-warning', message: 'Высокая долговая нагрузка', severity: 'warning' }
      : null;
  });
  // Предупреждение о возрасте.
  cross(model.$.personalData.birthDate, (f: Form) =>
    (f.age ?? 0) > 60
      ? {
          code: 'age-warning',
          message: 'Могут потребоваться дополнительные гарантии',
          severity: 'warning',
        }
      : null
  );
});

/**
 * Правила, адресованные по `selector` шага. Порядок ключей = порядок шагов,
 * поэтому `validateStep(n)` не зависит от индексации массива, а шаг без правил
 * объявляется явным `null`.
 */
export const stepValidation: Record<StepSelector, ValidationSchema<Form> | null> = {
  loan: loanStep,
  personal: personalStep,
  contacts: contactsStep,
  employment: employmentStep,
  additional: additionalStep,
  confirm: confirmStep,
};

export const creditValidation = {
  steps: stepValidation,
  extras: crossFieldRules,
};
