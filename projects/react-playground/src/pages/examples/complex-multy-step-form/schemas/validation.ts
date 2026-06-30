/**
 * Единый слой валидации кредитной заявки (контракт `(value, scope, root)` + `validateFormModel`).
 *
 * Схема — дерево узлов движка M1: поле `field(model.$.x, [rules])`, контейнер `{ children }`,
 * условная группа `applyWhen(cond, [...])`, секция массива `arraySection(control, item)`.
 * Исполняется `validateFormModel(model, schema)` — он же роутит ошибки в ноды формы по сигналу.
 *
 * Авторские хелперы (`field`/`when`/`applyWhen`/`crossField`) типобезопасны: `field` выводит тип
 * поля из сигнала и проверяет правила против него; cross-field читают зависимости через типизированный
 * `root`/`scope` без `as Root`. Встроенные фабрики (`required`/`min`/…) переиспользуются как есть.
 *
 * Используется всеми 3 вариантами флагмана через `makeCreditValidationConfig(model)` →
 * `{ validateStep, validateAll }` (колбэки для `FormWizard`).
 */

import {
  validateFormModel,
  type ModelValidator,
  type FormModel,
  type ModelSignals,
  type ModelArray,
  type PathAwareSignal,
  type ValidationError,
} from '@reformer/core';
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

/**
 * Правило поля типа `TField`. Проверяется ТОЛЬКО значение (`value`): движок игнорирует scope/root
 * для value-only фабрик, а cross-field/async читают их через свои типы (`crossField`/`when`/именованный
 * `ModelValidator`). Поэтому scope/root помечены `never` — благодаря этому `field(m.loanAmount, [email()])`
 * подсветится ошибкой (поле `number`, `email` ждёт `string`), а фабрики/cross-field присваиваются без `any`.
 */
type Rule<TField> = (
  value: TField,
  scope: never,
  root: never
) => ValidationError | null | Promise<ValidationError | null>;

/** Узел схемы движка (плоский объект, движок типизирует схему как `unknown`). */
type SchemaNode = Record<string, unknown>;

/** Узел поля: `{ value: сигнал, validators }`. Единственный каст правил→ModelValidator — здесь. */
const field = <TField>(signal: PathAwareSignal<TField>, rules: Rule<TField>[]): SchemaNode => ({
  value: signal,
  validators: rules as unknown as ModelValidator[],
});

/** Cross-field правило: читает корень формы типобезопасно, без `root as Root`. */
const crossField =
  (fn: (form: Root) => ValidationError | null): ModelValidator<unknown, unknown, Root> =>
  (_value, _scope, root) =>
    fn(root);

/**
 * Одно условное правило внутри поля (элемент массива, без spread): применяется, только если `cond(root)`.
 * Для синхронных правил (cross-field/фабрики). Для async-правил условность задаётся иначе.
 */
const when = <TField>(cond: (form: Root) => boolean, ...rules: Rule<TField>[]): Rule<TField> =>
  ((value: TField, scope: unknown, root: unknown) => {
    if (!cond(root as Root)) return null;
    for (const rule of rules) {
      const err = (rule as unknown as ModelValidator)(value, scope, root);
      if (err) return err;
    }
    return null;
  }) as unknown as Rule<TField>;

/**
 * Условная группа узлов (= аналог legacy `applyWhen`): применяется, только если `cond(root)` истинно.
 * Эмитит нативный узел движка `{ when, children }` — `walk` вычисляет условие ОДИН раз; при ложном
 * поддерево пропускается, а ошибки его полей очищаются движком (`setErrors([])`).
 */
const applyWhen = (cond: (form: Root) => boolean, children: SchemaNode[]): SchemaNode => ({
  when: (_scope: unknown, root: unknown) => cond(root as Root),
  children,
});

/** Секция массива: per-item под-схема для каждого элемента модели. */
const arraySection = <T>(
  control: ModelArray<T>,
  itemComponent: (item: FormModel<T>) => unknown
): SchemaNode => ({ componentProps: { control, itemComponent } });

const CURRENT_YEAR = new Date().getFullYear();
const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

// ============================================================================
// Cross-field правила уровня формы (читают корень)
// ============================================================================

const initialPaymentVsProperty = crossField((f) => {
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
});

const loanAmountVsPropertyMinusPayment = crossField((f) => {
  if (f.loanAmount && f.propertyValue && f.initialPayment) {
    const maxLoan = f.propertyValue - f.initialPayment;
    if (f.loanAmount > maxLoan)
      return {
        code: 'loanAmountExceedsMax',
        message: `Сумма кредита не может превышать ${maxLoan.toLocaleString('ru-RU')} ₽ (стоимость минус взнос)`,
      };
  }
  return null;
});

const phoneAdditionalDiffers = crossField((f) => {
  if (!f.phoneAdditional) return null;
  return f.phoneMain === f.phoneAdditional
    ? { code: 'phoneDuplicate', message: 'Дополнительный телефон должен отличаться от основного' }
    : null;
});

const emailAdditionalDiffers = crossField((f) => {
  if (!f.emailAdditional) return null;
  return f.email.toLowerCase() === f.emailAdditional.toLowerCase()
    ? { code: 'emailDuplicate', message: 'Дополнительный email должен отличаться от основного' }
    : null;
});

const passportIssuedAfter14 = crossField((f) => {
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
});

const currentExperienceVsTotal = crossField((f) =>
  f.workExperienceCurrent &&
  f.workExperienceTotal &&
  f.workExperienceCurrent > f.workExperienceTotal
    ? {
        code: 'currentExperienceExceedsTotal',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      }
    : null
);

const additionalIncomeSourceRequired = crossField((f) =>
  f.additionalIncome && f.additionalIncome > 0 && !f.additionalIncomeSource
    ? { code: 'additionalIncomeSourceRequired', message: 'Укажите источник дополнительного дохода' }
    : null
);

// Cross-field / warnings уровня всей формы (полная валидация)
const paymentToIncome = crossField((f) =>
  f.paymentToIncomeRatio && f.paymentToIncomeRatio > 50
    ? {
        code: 'paymentTooHigh',
        message: `Ежемесячный платеж не должен превышать 50% дохода (сейчас ${f.paymentToIncomeRatio}%)`,
      }
    : null
);

const validateAge = crossField((f) => {
  if (!f.age) return null;
  if (f.age < 18) return { code: 'ageTooYoung', message: 'Заемщик должен быть старше 18 лет' };
  if (f.age > 70) return { code: 'ageTooOld', message: 'Заемщик должен быть младше 70 лет' };
  return null;
});

const warnHighDebt = crossField((f) =>
  f.paymentToIncomeRatio && f.paymentToIncomeRatio > 40 && f.paymentToIncomeRatio <= 50
    ? {
        code: 'highDebtLoad',
        message: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму или увеличить срок.',
        severity: 'warning',
      }
    : null
);

const warnSeniorAge = crossField((f) =>
  f.age && f.age > 60 && f.age <= 70
    ? {
        code: 'seniorAge',
        message: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
        severity: 'warning',
      }
    : null
);

const warnLowExperience = crossField((f) =>
  f.workExperienceCurrent !== null &&
  f.workExperienceCurrent !== undefined &&
  f.workExperienceCurrent < 3
    ? {
        code: 'lowWorkExperience',
        message: 'Малый стаж на текущем месте может повлиять на решение.',
        severity: 'warning',
      }
    : null
);

// Per-item cross-field (scope — под-модель элемента массива)
const remainingNotExceedAmount: ModelValidator<number, ExistingLoan> = (_value, loan) =>
  loan.remainingAmount > loan.amount
    ? { code: 'remainingExceedsAmount', message: 'Остаток долга не может превышать сумму кредита' }
    : null;

const maturityInFuture: ModelValidator<string, ExistingLoan> = (_value, loan) => {
  if (!loan.maturityDate) return null;
  const date = new Date(loan.maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today
    ? { code: 'maturityDateInPast', message: 'Дата погашения должна быть в будущем' }
    : null;
};

// Array-level: «добавьте хотя бы один…», навешено на чекбокс-носитель
const notEmptyWhen =
  (flag: keyof Root, arr: keyof Root, message: string): ModelValidator<unknown, unknown, Root> =>
  (_value, _scope, root) => {
    const arrValue = root[arr] as unknown as { length: number };
    return root[flag] && arrValue.length === 0 ? { code: 'arrayEmpty', message } : null;
  };

// ============================================================================
// Переиспользуемые наборы правил
// ============================================================================

/** Правила ФИО (русское имя). Переиспользуется в step2 и в созаёмщике. */
export const ruName = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
  pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' }),
];

// ============================================================================
// Под-схемы вложенных групп / элементов массивов
// ============================================================================

const addressFields = (s: ModelSignals<Address>): SchemaNode[] => [
  field(s.region, [
    required({ message: 'Укажите регион' }),
    minLength(2, { message: 'Минимум 2 символа' }),
    maxLength(100, { message: 'Максимум 100 символов' }),
  ]),
  field(s.city, [
    required({ message: 'Укажите город' }),
    minLength(2, { message: 'Минимум 2 символа' }),
    maxLength(100, { message: 'Максимум 100 символов' }),
  ]),
  field(s.street, [
    required({ message: 'Укажите улицу' }),
    minLength(3, { message: 'Минимум 3 символа' }),
    maxLength(200, { message: 'Максимум 200 символов' }),
  ]),
  field(s.house, [
    required({ message: 'Укажите номер дома' }),
    maxLength(10, { message: 'Максимум 10 символов' }),
  ]),
  // apartment опционален в типе Address, но всегда материализован в модели
  field(s.apartment!, [maxLength(10, { message: 'Максимум 10 символов' })]),
  field(s.postalCode, [
    required({ message: 'Укажите почтовый индекс' }),
    pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' }),
  ]),
];

const propertyItem = (im: FormModel<Property>): SchemaNode => ({
  children: [
    field(im.$.type, [required({ message: 'Укажите тип имущества' })]),
    field(im.$.description, [
      required({ message: 'Добавьте описание имущества' }),
      minLength(10, { message: 'Минимум 10 символов' }),
      maxLength(500, { message: 'Максимум 500 символов' }),
    ]),
    field(im.$.estimatedValue, [
      required({ message: 'Укажите оценочную стоимость' }),
      min(10000, { message: 'Минимальная стоимость: 10 000 ₽' }),
    ]),
  ],
});

const existingLoanItem = (im: FormModel<ExistingLoan>): SchemaNode => ({
  children: [
    field(im.$.bank, [
      required({ message: 'Укажите название банка' }),
      minLength(3, { message: 'Минимум 3 символа' }),
      maxLength(100, { message: 'Максимум 100 символов' }),
    ]),
    field(im.$.type, [required({ message: 'Укажите тип кредита' })]),
    field(im.$.amount, [
      required({ message: 'Укажите сумму кредита' }),
      min(1000, { message: 'Минимум 1 000 ₽' }),
      max(100000000, { message: 'Максимум 100 000 000 ₽' }),
    ]),
    field(im.$.remainingAmount, [
      required({ message: 'Укажите остаток долга' }),
      min(0, { message: 'Не может быть отрицательным' }),
      remainingNotExceedAmount,
    ]),
    field(im.$.monthlyPayment, [
      required({ message: 'Укажите ежемесячный платеж' }),
      min(100, { message: 'Минимум 100 ₽' }),
    ]),
    field(im.$.maturityDate, [required({ message: 'Укажите дату погашения' }), maturityInFuture]),
  ],
});

const coBorrowerItem = (im: FormModel<CoBorrower>): SchemaNode => ({
  children: [
    field(im.$.personalData.lastName, ruName('Фамилия')),
    field(im.$.personalData.firstName, ruName('Имя')),
    field(im.$.personalData.middleName, ruName('Отчество')),
    field(im.$.personalData.birthDate, [
      required({ message: 'Дата рождения обязательна' }),
      minAge(18, { message: 'Созаемщику должно быть не менее 18 лет' }),
      maxAge(80, { message: 'Созаемщику должно быть не более 80 лет' }),
    ]),
    field(im.$.phone, [required({ message: 'Телефон обязателен' })]),
    field(im.$.email, [
      required({ message: 'Email обязателен' }),
      email({ message: 'Введите корректный email' }),
    ]),
    field(im.$.relationship, [required({ message: 'Укажите отношение к заемщику' })]),
    field(im.$.monthlyIncome, [
      required({ message: 'Укажите доход созаемщика' }),
      min(10000, { message: 'Минимум 10 000 ₽' }),
    ]),
  ],
});

// ============================================================================
// Per-step схемы валидации
// ============================================================================

const step1 = (model: M): SchemaNode => {
  const m = model.$;
  const isMortgage = (r: Root) => r.loanType === 'mortgage';
  const isCar = (r: Root) => r.loanType === 'car';
  return {
    children: [
      field(m.loanType, [required({ message: 'Выберите тип кредита' })]),
      field(m.loanAmount, [
        required({ message: 'Укажите сумму кредита' }),
        min(50000, { message: 'Минимум 50 000 ₽' }),
        max(10000000, { message: 'Максимум 10 000 000 ₽' }),
        when(isMortgage, loanAmountVsPropertyMinusPayment),
      ]),
      field(m.loanTerm, [
        required({ message: 'Укажите срок кредита' }),
        min(6, { message: 'Минимум 6 месяцев' }),
        max(240, { message: 'Максимум 240 месяцев' }),
      ]),
      field(m.loanPurpose, [
        required({ message: 'Укажите цель кредита' }),
        minLength(10, { message: 'Минимум 10 символов' }),
        maxLength(500, { message: 'Не более 500 символов' }),
      ]),
      applyWhen(isMortgage, [
        field(m.propertyValue, [
          required({ message: 'Укажите стоимость недвижимости' }),
          min(1000000, { message: 'Минимум 1 000 000 ₽' }),
        ]),
        field(m.initialPayment, [
          required({ message: 'Укажите первоначальный взнос' }),
          min(0, { message: 'Не может быть отрицательным' }),
          initialPaymentVsProperty,
        ]),
      ]),
      applyWhen(isCar, [
        field(m.carBrand, [
          required({ message: 'Укажите марку автомобиля' }),
          minLength(2, { message: 'Минимум 2 символа' }),
          maxLength(50, { message: 'Максимум 50 символов' }),
        ]),
        field(m.carModel, [
          required({ message: 'Укажите модель автомобиля' }),
          minLength(1, { message: 'Минимум 1 символ' }),
          maxLength(50, { message: 'Максимум 50 символов' }),
        ]),
        field(m.carYear, [
          required({ message: 'Укажите год выпуска' }),
          min(2000, { message: 'Не ранее 2000' }),
          max(CURRENT_YEAR + 1, { message: `Не позднее ${CURRENT_YEAR + 1}` }),
        ]),
        field(m.carPrice, [
          required({ message: 'Укажите стоимость автомобиля' }),
          min(300000, { message: 'Минимум 300 000 ₽' }),
          max(10000000, { message: 'Максимум 10 000 000 ₽' }),
        ]),
      ]),
    ],
  };
};

const step2 = (model: M): SchemaNode => {
  const m = model.$;
  return {
    children: [
      field(m.personalData.lastName, ruName('Фамилия')),
      field(m.personalData.firstName, ruName('Имя')),
      field(m.personalData.middleName, ruName('Отчество')),
      field(m.personalData.birthDate, [
        required({ message: 'Дата рождения обязательна' }),
        minAge(18, { message: 'Заемщику должно быть не менее 18 лет' }),
        maxAge(70, { message: 'Максимальный возраст заемщика: 70 лет' }),
      ]),
      field(m.personalData.gender, [required({ message: 'Выберите пол' })]),
      field(m.personalData.birthPlace, [
        required({ message: 'Место рождения обязательно' }),
        minLength(5, { message: 'Минимум 5 символов' }),
        maxLength(100, { message: 'Максимум 100 символов' }),
      ]),
      field(m.passportData.series, [
        required({ message: 'Серия паспорта обязательна' }),
        pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' }),
      ]),
      field(m.passportData.number, [
        required({ message: 'Номер паспорта обязателен' }),
        pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' }),
      ]),
      field(m.passportData.issueDate, [
        required({ message: 'Дата выдачи обязательна' }),
        pastDate({ message: 'Дата выдачи не может быть в будущем' }),
        passportIssuedAfter14,
      ]),
      field(m.passportData.issuedBy, [
        required({ message: 'Кем выдан обязательно' }),
        minLength(10, { message: 'Минимум 10 символов' }),
        maxLength(200, { message: 'Максимум 200 символов' }),
      ]),
      field(m.passportData.departmentCode, [
        required({ message: 'Код подразделения обязателен' }),
        pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' }),
      ]),
      field(m.inn, [
        required({ message: 'ИНН обязателен' }),
        pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }),
      ]),
      field(m.snils, [
        required({ message: 'СНИЛС обязателен' }),
        pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 000-000-000 00' }),
      ]),
    ],
  };
};

const step3 = (model: M): SchemaNode => {
  const m = model.$;
  const notSameAddress = (r: Root) => r.sameAsRegistration === false;
  return {
    children: [
      field(m.phoneMain, [
        required({ message: 'Телефон обязателен' }),
        pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
      ]),
      field(m.phoneAdditional, [
        pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
        phoneAdditionalDiffers,
      ]),
      field(m.email, [
        required({ message: 'Email обязателен' }),
        email({ message: 'Введите корректный email' }),
      ]),
      field(m.emailAdditional, [
        email({ message: 'Введите корректный email' }),
        emailAdditionalDiffers,
      ]),
      { children: addressFields(m.registrationAddress) },
      // адрес проживания — только если не совпадает с регистрацией
      applyWhen(notSameAddress, addressFields(m.residenceAddress)),
    ],
  };
};

const step4 = (model: M): SchemaNode => {
  const m = model.$;
  const isEmployed = (r: Root) => r.employmentStatus === 'employed';
  const isSelfEmployed = (r: Root) => r.employmentStatus === 'selfEmployed';
  return {
    children: [
      field(m.employmentStatus, [required({ message: 'Укажите статус занятости' })]),
      applyWhen(isEmployed, [
        field(m.companyName, [
          required({ message: 'Укажите название компании' }),
          minLength(3, { message: 'Минимум 3 символа' }),
          maxLength(200, { message: 'Максимум 200 символов' }),
        ]),
        field(m.companyInn, [
          required({ message: 'ИНН компании обязателен' }),
          pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }),
        ]),
        field(m.companyPhone, [
          required({ message: 'Телефон компании обязателен' }),
          pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }),
        ]),
        field(m.companyAddress, [
          required({ message: 'Адрес компании обязателен' }),
          minLength(10, { message: 'Минимум 10 символов' }),
          maxLength(300, { message: 'Максимум 300 символов' }),
        ]),
        field(m.position, [
          required({ message: 'Укажите должность' }),
          minLength(3, { message: 'Минимум 3 символа' }),
          maxLength(100, { message: 'Максимум 100 символов' }),
        ]),
        field(m.workExperienceTotal, [
          required({ message: 'Укажите общий стаж' }),
          min(0, { message: 'Не может быть отрицательным' }),
          max(60, { message: 'Максимум 60 лет' }),
        ]),
        field(m.workExperienceCurrent, [
          required({ message: 'Укажите стаж на текущем месте' }),
          min(0, { message: 'Не может быть отрицательным' }),
          max(60, { message: 'Максимум 60 лет' }),
          currentExperienceVsTotal,
        ]),
      ]),
      applyWhen(isSelfEmployed, [
        field(m.businessType, [required({ message: 'Укажите тип бизнеса' })]),
        field(m.businessInn, [
          required({ message: 'ИНН ИП обязателен' }),
          pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' }),
        ]),
        field(m.businessActivity, [
          required({ message: 'Укажите вид деятельности' }),
          minLength(10, { message: 'Минимум 10 символов' }),
          maxLength(300, { message: 'Максимум 300 символов' }),
        ]),
      ]),
      field(m.monthlyIncome, [
        required({ message: 'Укажите ежемесячный доход' }),
        min(10000, { message: 'Минимум 10 000 ₽' }),
        max(10000000, { message: 'Максимум 10 000 000 ₽' }),
      ]),
      field(m.additionalIncome, [
        min(0, { message: 'Не может быть отрицательным' }),
        max(10000000, { message: 'Максимум 10 000 000 ₽' }),
      ]),
      field(m.additionalIncomeSource, [additionalIncomeSourceRequired]),
    ],
  };
};

const step5 = (model: M): SchemaNode => {
  const m = model.$;
  return {
    children: [
      field(m.maritalStatus, [required({ message: 'Укажите семейное положение' })]),
      field(m.dependents, [
        required({ message: 'Укажите количество иждивенцев' }),
        min(0, { message: 'Не может быть отрицательным' }),
        max(10, { message: 'Максимум 10' }),
      ]),
      field(m.education, [required({ message: 'Укажите уровень образования' })]),
      field(m.hasProperty, [
        notEmptyWhen('hasProperty', 'properties', 'Добавьте хотя бы один объект имущества'),
      ]),
      field(m.hasExistingLoans, [
        notEmptyWhen('hasExistingLoans', 'existingLoans', 'Добавьте информацию о кредите'),
      ]),
      field(m.hasCoBorrower, [
        notEmptyWhen('hasCoBorrower', 'coBorrowers', 'Добавьте информацию о созаемщике'),
      ]),
      arraySection(model.properties, propertyItem),
      arraySection(model.existingLoans, existingLoanItem),
      arraySection(model.coBorrowers, coBorrowerItem),
    ],
  };
};

const step6 = (model: M): SchemaNode => {
  const m = model.$;
  const smsCode: ModelValidator<string, unknown, Root> = async (value) => {
    if (!value || value.length !== 6) return null;
    await new Promise((resolve) => setTimeout(resolve, 200));
    return value !== '123456'
      ? {
          code: 'invalidSmsCode',
          message: 'Неверный код подтверждения. Для демо используйте: 123456',
        }
      : null;
  };
  return {
    children: [
      field(m.agreePersonalData, [required({ message: 'Согласие на обработку ПД обязательно' })]),
      field(m.agreeCreditHistory, [
        required({ message: 'Согласие на проверку кредитной истории обязательно' }),
      ]),
      field(m.agreeTerms, [required({ message: 'Согласие с условиями обязательно' })]),
      field(m.confirmAccuracy, [required({ message: 'Подтверждение точности обязательно' })]),
      field(m.electronicSignature, [
        required({ message: 'Введите код из СМС' }),
        minLength(6, { message: 'Код — 6 символов' }),
        maxLength(6, { message: 'Код — 6 символов' }),
        pattern(/^\d{6}$/, { message: 'Только цифры' }),
        smsCode,
      ]),
    ],
  };
};

/** Cross-field/warnings уровня всей формы (вне per-step). */
const fullExtras = (model: M): SchemaNode => {
  const m = model.$;
  return {
    children: [
      field(m.monthlyPayment, [paymentToIncome]),
      field(m.age, [validateAge, warnSeniorAge]),
      field(m.paymentToIncomeRatio, [warnHighDebt]),
      field(m.workExperienceCurrent, [warnLowExperience]),
    ],
  };
};

const STEP_BUILDERS = [step1, step2, step3, step4, step5, step6] as const;

/** Схема валидации конкретного шага (1-based). */
export const creditStepSchema = (step: number, model: M): SchemaNode =>
  STEP_BUILDERS[step - 1]?.(model) ?? { children: [] };

/** Полная схема валидации (все шаги + form-level cross-field/warnings). */
export const creditFullSchema = (model: M): SchemaNode => ({
  children: [...STEP_BUILDERS.map((build) => build(model)), fullExtras(model)],
});

/** Истинно, если среди ошибок нет блокирующих (severity ≠ 'warning'). */
const noBlocking = (errors: Record<string, { severity?: string }[]>): boolean =>
  Object.values(errors)
    .flat()
    .every((e) => e.severity === 'warning');

/**
 * Конфиг валидации для `FormWizard` (M1): per-step и полная валидация через `validateFormModel`.
 * Ошибки роутятся в ноды формы; warnings (severity: 'warning') не блокируют.
 *
 * Схема зависит только от ФОРМЫ модели, не от значений (значения читаются через `signal.peek()`
 * в момент прогона, а длина/элементы массивов — через живой `control.length`/`control.at(i)`).
 * Поэтому дерево схемы строится ОДИН раз на `model`, а не пересобирается на каждый вызов —
 * убирает ~300–400 одноразовых аллокаций на `validateAll`.
 */
export function makeCreditValidationConfig(model: M) {
  const stepSchemas = STEP_BUILDERS.map((build) => build(model));
  const fullSchema: SchemaNode = { children: [...stepSchemas, fullExtras(model)] };
  return {
    validateStep: async (step: number): Promise<boolean> => {
      const res = await validateFormModel(model, stepSchemas[step - 1] ?? { children: [] });
      return noBlocking(res.errors);
    },
    validateAll: async (): Promise<boolean> => {
      const res = await validateFormModel(model, fullSchema);
      return noBlocking(res.errors);
    },
  };
}
