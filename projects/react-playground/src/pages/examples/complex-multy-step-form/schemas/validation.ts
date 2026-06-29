/**
 * M1: единый слой валидации кредитной заявки (контракт `(value, model, root)`).
 *
 * Заменяет легаси `validateForm` + `ValidationSchemaFn` (FieldPath). Валидаторы живут в
 * validation-схемах (дерево `{ value: model.$.x, validators: [...] }`), которые исполняет
 * `validateFormModel(model, schema)` — он же роутит ошибки в ноды формы по сигналу.
 *
 * Используется всеми 3 вариантами флагмана через `makeCreditValidationConfig(model)` →
 * `{ validateStep, validateAll }` (колбэки для `FormWizard`). Встроенные фабрики
 * (`required`/`min`/`pattern`/…) переиспользуются как есть (они value-only).
 */

import { validateFormModel, type ModelValidator, type FormModel } from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  email,
} from '@reformer/core/validators';
import type { CreditApplicationForm } from '../types/credit-application';
import type { Property } from '../components/nested-forms/Property/types';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Root = CreditApplicationForm;
type V = ModelValidator;

/** Встроенные фабрики value-only → ModelValidator (игнорируют model/root). */
const mv = (validator: unknown): V => validator as V;

/** Список валидаторов поля (приведение фабрик к ModelValidator). */
const vs = (...validators: unknown[]): V[] => validators as V[];

/** Условные валидаторы: применяются только когда `cond(root)` истинно. */
const when =
  (cond: (root: Root) => boolean) =>
  (...validators: unknown[]): V[] =>
    (validators as V[]).map(
      (val): V =>
        (value, scope, root) =>
          cond(root as Root) ? val(value, scope, root) : null
    );

/** Узел валидации поля. */
const vf = (signal: any, validators: V[]) => ({ value: signal, validators });

const RU_NAME = /^[А-ЯЁа-яё\s-]+$/;
const PHONE = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;

// ============================================================================
// Кастомные cross-field валидаторы (root — value-proxy модели)
// ============================================================================

const initialPaymentVsProperty: V = (_v, _s, root) => {
  const f = root as Root;
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

const loanAmountVsPropertyMinusPayment: V = (_v, _s, root) => {
  const f = root as Root;
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

const phoneAdditionalDiffers: V = (_v, _s, root) => {
  const f = root as Root;
  if (!f.phoneAdditional) return null;
  return f.phoneMain === f.phoneAdditional
    ? { code: 'phoneDuplicate', message: 'Дополнительный телефон должен отличаться от основного' }
    : null;
};

const emailAdditionalDiffers: V = (_v, _s, root) => {
  const f = root as Root;
  if (!f.emailAdditional) return null;
  return f.email.toLowerCase() === f.emailAdditional.toLowerCase()
    ? { code: 'emailDuplicate', message: 'Дополнительный email должен отличаться от основного' }
    : null;
};

const passportIssuedAfter14: V = (_v, _s, root) => {
  const f = root as Root;
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

const passportIssueNotFuture: V = (value) => {
  if (!value) return null;
  return new Date(value as string) > new Date()
    ? { code: 'issueDateInFuture', message: 'Дата выдачи не может быть в будущем' }
    : null;
};

const adultAge: V = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value as string).getFullYear();
  if (age < 18) return { code: 'tooYoung', message: 'Заемщику должно быть не менее 18 лет' };
  if (age > 70) return { code: 'tooOld', message: 'Максимальный возраст заемщика: 70 лет' };
  return null;
};

const currentExperienceVsTotal: V = (_v, _s, root) => {
  const f = root as Root;
  return f.workExperienceCurrent &&
    f.workExperienceTotal &&
    f.workExperienceCurrent > f.workExperienceTotal
    ? {
        code: 'currentExperienceExceedsTotal',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      }
    : null;
};

const additionalIncomeSourceRequired: V = (_v, _s, root) => {
  const f = root as Root;
  return f.additionalIncome && f.additionalIncome > 0 && !f.additionalIncomeSource
    ? { code: 'additionalIncomeSourceRequired', message: 'Укажите источник дополнительного дохода' }
    : null;
};

// Cross-field / warnings уровня всей формы (полная валидация)
const paymentToIncome: V = (_v, _s, root) => {
  const ratio = (root as Root).paymentToIncomeRatio;
  return ratio && ratio > 50
    ? {
        code: 'paymentTooHigh',
        message: `Ежемесячный платеж не должен превышать 50% дохода (сейчас ${ratio}%)`,
      }
    : null;
};
const validateAge: V = (_v, _s, root) => {
  const age = (root as Root).age;
  if (!age) return null;
  if (age < 18) return { code: 'ageTooYoung', message: 'Заемщик должен быть старше 18 лет' };
  if (age > 70) return { code: 'ageTooOld', message: 'Заемщик должен быть младше 70 лет' };
  return null;
};
const warnHighDebt: V = (_v, _s, root) => {
  const r = (root as Root).paymentToIncomeRatio;
  return r && r > 40 && r <= 50
    ? {
        code: 'highDebtLoad',
        message: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму или увеличить срок.',
        severity: 'warning',
      }
    : null;
};
const warnSeniorAge: V = (_v, _s, root) => {
  const a = (root as Root).age;
  return a && a > 60 && a <= 70
    ? {
        code: 'seniorAge',
        message: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
        severity: 'warning',
      }
    : null;
};
const warnLowExperience: V = (_v, _s, root) => {
  const e = (root as Root).workExperienceCurrent;
  return e !== null && e !== undefined && e < 3
    ? {
        code: 'lowWorkExperience',
        message: 'Малый стаж на текущем месте может повлиять на решение.',
        severity: 'warning',
      }
    : null;
};

// Per-item cross-field (scope — под-модель элемента; root — корень)
const remainingNotExceedAmount: V = (_v, scope) => {
  const loan = scope as { remainingAmount: number; amount: number };
  return loan.remainingAmount > loan.amount
    ? { code: 'remainingExceedsAmount', message: 'Остаток долга не может превышать сумму кредита' }
    : null;
};
const maturityInFuture: V = (_v, scope) => {
  const loan = scope as { maturityDate: string };
  if (!loan.maturityDate) return null;
  const d = new Date(loan.maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today
    ? { code: 'maturityDateInPast', message: 'Дата погашения должна быть в будущем' }
    : null;
};
const coBorrowerAge18to80: V = (value) => {
  if (!value) return null;
  const birth = new Date(value as string);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age < 18)
    return { code: 'coBorrowerTooYoung', message: 'Созаемщику должно быть не менее 18 лет' };
  if (age > 80)
    return { code: 'coBorrowerTooOld', message: 'Созаемщику должно быть не более 80 лет' };
  return null;
};

// Array-level: «добавьте хотя бы один…», навешено на чекбокс-носитель
const notEmptyWhen =
  (flag: keyof Root, arr: keyof Root, message: string): V =>
  (_value, _s, root) =>
    (root as any)[flag] && ((root as any)[arr] as { length: number }).length === 0
      ? { code: 'arrayEmpty', message }
      : null;

// ============================================================================
// Под-схемы вложенных групп / элементов массивов
// ============================================================================

const addressChildren = (s: any) => [
  vf(
    s.region,
    vs(
      required({ message: 'Укажите регион' }),
      minLength(2, { message: 'Минимум 2 символа' }),
      maxLength(100, { message: 'Максимум 100 символов' })
    )
  ),
  vf(
    s.city,
    vs(
      required({ message: 'Укажите город' }),
      minLength(2, { message: 'Минимум 2 символа' }),
      maxLength(100, { message: 'Максимум 100 символов' })
    )
  ),
  vf(
    s.street,
    vs(
      required({ message: 'Укажите улицу' }),
      minLength(3, { message: 'Минимум 3 символа' }),
      maxLength(200, { message: 'Максимум 200 символов' })
    )
  ),
  vf(
    s.house,
    vs(
      required({ message: 'Укажите номер дома' }),
      maxLength(10, { message: 'Максимум 10 символов' })
    )
  ),
  vf(s.apartment, vs(maxLength(10, { message: 'Максимум 10 символов' }))),
  vf(
    s.postalCode,
    vs(
      required({ message: 'Укажите почтовый индекс' }),
      pattern(/^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' })
    )
  ),
];

const propertyItem = (im: FormModel<Property>) => ({
  children: [
    vf(im.$.type, vs(required({ message: 'Укажите тип имущества' }))),
    vf(
      im.$.description,
      vs(
        required({ message: 'Добавьте описание имущества' }),
        minLength(10, { message: 'Минимум 10 символов' }),
        maxLength(500, { message: 'Максимум 500 символов' })
      )
    ),
    vf(
      im.$.estimatedValue,
      vs(
        required({ message: 'Укажите оценочную стоимость' }),
        min(10000, { message: 'Минимальная стоимость: 10 000 ₽' })
      )
    ),
  ],
});

const existingLoanItem = (im: FormModel<ExistingLoan>) => ({
  children: [
    vf(
      im.$.bank,
      vs(
        required({ message: 'Укажите название банка' }),
        minLength(3, { message: 'Минимум 3 символа' }),
        maxLength(100, { message: 'Максимум 100 символов' })
      )
    ),
    vf(im.$.type, vs(required({ message: 'Укажите тип кредита' }))),
    vf(
      im.$.amount,
      vs(
        required({ message: 'Укажите сумму кредита' }),
        min(1000, { message: 'Минимум 1 000 ₽' }),
        max(100000000, { message: 'Максимум 100 000 000 ₽' })
      )
    ),
    vf(
      im.$.remainingAmount,
      vs(
        required({ message: 'Укажите остаток долга' }),
        min(0, { message: 'Не может быть отрицательным' }),
        remainingNotExceedAmount
      )
    ),
    vf(
      im.$.monthlyPayment,
      vs(
        required({ message: 'Укажите ежемесячный платеж' }),
        min(100, { message: 'Минимум 100 ₽' })
      )
    ),
    vf(im.$.maturityDate, vs(required({ message: 'Укажите дату погашения' }), maturityInFuture)),
  ],
});

const coBorrowerItem = (im: FormModel<CoBorrower>) => ({
  children: [
    vf(
      im.$.personalData.lastName,
      vs(
        required({ message: 'Фамилия обязательна' }),
        minLength(2, { message: 'Минимум 2 символа' }),
        maxLength(50, { message: 'Максимум 50 символов' }),
        pattern(RU_NAME, { message: 'Только русские буквы' })
      )
    ),
    vf(
      im.$.personalData.firstName,
      vs(
        required({ message: 'Имя обязательно' }),
        minLength(2, { message: 'Минимум 2 символа' }),
        maxLength(50, { message: 'Максимум 50 символов' }),
        pattern(RU_NAME, { message: 'Только русские буквы' })
      )
    ),
    vf(
      im.$.personalData.middleName,
      vs(
        required({ message: 'Отчество обязательно' }),
        minLength(2, { message: 'Минимум 2 символа' }),
        maxLength(50, { message: 'Максимум 50 символов' }),
        pattern(RU_NAME, { message: 'Только русские буквы' })
      )
    ),
    vf(
      im.$.personalData.birthDate,
      vs(required({ message: 'Дата рождения обязательна' }), coBorrowerAge18to80)
    ),
    vf(im.$.phone, vs(required({ message: 'Телефон обязателен' }))),
    vf(
      im.$.email,
      vs(required({ message: 'Email обязателен' }), email({ message: 'Введите корректный email' }))
    ),
    vf(im.$.relationship, vs(required({ message: 'Укажите отношение к заемщику' }))),
    vf(
      im.$.monthlyIncome,
      vs(
        required({ message: 'Укажите доход созаемщика' }),
        min(10000, { message: 'Минимум 10 000 ₽' })
      )
    ),
  ],
});

const arraySection = (control: any, itemComponent: (im: any) => unknown) => ({
  componentProps: { control, itemComponent },
});

// ============================================================================
// Per-step схемы валидации
// ============================================================================

type M = FormModel<CreditApplicationForm>;

const step1 = (model: M) => {
  const m = model.$;
  const mortgage = (r: Root) => r.loanType === 'mortgage';
  const car = (r: Root) => r.loanType === 'car';
  const w = when(mortgage);
  const wc = when(car);
  return {
    children: [
      vf(m.loanType, vs(required({ message: 'Выберите тип кредита' }))),
      vf(m.loanAmount, [
        ...vs(
          required({ message: 'Укажите сумму кредита' }),
          min(50000, { message: 'Минимум 50 000 ₽' }),
          max(10000000, { message: 'Максимум 10 000 000 ₽' })
        ),
        ...w(loanAmountVsPropertyMinusPayment),
      ]),
      vf(
        m.loanTerm,
        vs(
          required({ message: 'Укажите срок кредита' }),
          min(6, { message: 'Минимум 6 месяцев' }),
          max(240, { message: 'Максимум 240 месяцев' })
        )
      ),
      vf(
        m.loanPurpose,
        vs(
          required({ message: 'Укажите цель кредита' }),
          minLength(10, { message: 'Минимум 10 символов' }),
          maxLength(500, { message: 'Не более 500 символов' })
        )
      ),
      vf(
        m.propertyValue,
        w(
          required({ message: 'Укажите стоимость недвижимости' }),
          min(1000000, { message: 'Минимум 1 000 000 ₽' })
        )
      ),
      vf(m.initialPayment, [
        ...w(
          required({ message: 'Укажите первоначальный взнос' }),
          min(0, { message: 'Не может быть отрицательным' })
        ),
        ...w(initialPaymentVsProperty),
      ]),
      vf(
        m.carBrand,
        wc(
          required({ message: 'Укажите марку автомобиля' }),
          minLength(2, { message: 'Минимум 2 символа' }),
          maxLength(50, { message: 'Максимум 50 символов' })
        )
      ),
      vf(
        m.carModel,
        wc(
          required({ message: 'Укажите модель автомобиля' }),
          minLength(1, { message: 'Минимум 1 символ' }),
          maxLength(50, { message: 'Максимум 50 символов' })
        )
      ),
      vf(
        m.carYear,
        wc(
          required({ message: 'Укажите год выпуска' }),
          min(2000, { message: 'Не ранее 2000' }),
          max(new Date().getFullYear() + 1, {
            message: `Не позднее ${new Date().getFullYear() + 1}`,
          })
        )
      ),
      vf(
        m.carPrice,
        wc(
          required({ message: 'Укажите стоимость автомобиля' }),
          min(300000, { message: 'Минимум 300 000 ₽' }),
          max(10000000, { message: 'Максимум 10 000 000 ₽' })
        )
      ),
    ],
  };
};

const step2 = (model: M) => {
  const m = model.$;
  const nameRules = (label: string) =>
    vs(
      required({ message: `${label} обязательно` }),
      minLength(2, { message: 'Минимум 2 символа' }),
      maxLength(50, { message: 'Максимум 50 символов' }),
      pattern(RU_NAME, { message: 'Только русские буквы, пробелы и дефис' })
    );
  return {
    children: [
      vf(m.personalData.lastName, nameRules('Фамилия')),
      vf(m.personalData.firstName, nameRules('Имя')),
      vf(m.personalData.middleName, nameRules('Отчество')),
      vf(
        m.personalData.birthDate,
        vs(required({ message: 'Дата рождения обязательна' }), adultAge)
      ),
      vf(m.personalData.gender, vs(required({ message: 'Выберите пол' }))),
      vf(
        m.personalData.birthPlace,
        vs(
          required({ message: 'Место рождения обязательно' }),
          minLength(5, { message: 'Минимум 5 символов' }),
          maxLength(100, { message: 'Максимум 100 символов' })
        )
      ),
      vf(
        m.passportData.series,
        vs(
          required({ message: 'Серия паспорта обязательна' }),
          pattern(/^\d{2}\s\d{2}$/, { message: 'Формат: 00 00' })
        )
      ),
      vf(
        m.passportData.number,
        vs(
          required({ message: 'Номер паспорта обязателен' }),
          pattern(/^\d{6}$/, { message: 'Номер должен содержать 6 цифр' })
        )
      ),
      vf(
        m.passportData.issueDate,
        vs(
          required({ message: 'Дата выдачи обязательна' }),
          passportIssueNotFuture,
          passportIssuedAfter14
        )
      ),
      vf(
        m.passportData.issuedBy,
        vs(
          required({ message: 'Кем выдан обязательно' }),
          minLength(10, { message: 'Минимум 10 символов' }),
          maxLength(200, { message: 'Максимум 200 символов' })
        )
      ),
      vf(
        m.passportData.departmentCode,
        vs(
          required({ message: 'Код подразделения обязателен' }),
          pattern(/^\d{3}-\d{3}$/, { message: 'Формат: 000-000' })
        )
      ),
      vf(
        m.inn,
        vs(
          required({ message: 'ИНН обязателен' }),
          pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' })
        )
      ),
      vf(
        m.snils,
        vs(
          required({ message: 'СНИЛС обязателен' }),
          pattern(/^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 000-000-000 00' })
        )
      ),
    ],
  };
};

const step3 = (model: M) => {
  const m = model.$;
  const wRes = when((r) => r.sameAsRegistration === false);
  return {
    children: [
      vf(
        m.phoneMain,
        vs(
          required({ message: 'Телефон обязателен' }),
          pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' })
        )
      ),
      vf(
        m.phoneAdditional,
        vs(pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' }), phoneAdditionalDiffers)
      ),
      vf(
        m.email,
        vs(
          required({ message: 'Email обязателен' }),
          email({ message: 'Введите корректный email' })
        )
      ),
      vf(
        m.emailAdditional,
        vs(email({ message: 'Введите корректный email' }), emailAdditionalDiffers)
      ),
      { children: addressChildren(m.registrationAddress) },
      // адрес проживания — только если не совпадает
      {
        children: addressChildren(m.residenceAddress).map((node) => ({
          ...node,
          validators: wRes(...node.validators),
        })),
      },
    ],
  };
};

const step4 = (model: M) => {
  const m = model.$;
  const emp = when((r) => r.employmentStatus === 'employed');
  const self = when((r) => r.employmentStatus === 'selfEmployed');
  return {
    children: [
      vf(m.employmentStatus, vs(required({ message: 'Укажите статус занятости' }))),
      vf(
        m.companyName,
        emp(
          required({ message: 'Укажите название компании' }),
          minLength(3, { message: 'Минимум 3 символа' }),
          maxLength(200, { message: 'Максимум 200 символов' })
        )
      ),
      vf(
        m.companyInn,
        emp(
          required({ message: 'ИНН компании обязателен' }),
          pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' })
        )
      ),
      vf(
        m.companyPhone,
        emp(
          required({ message: 'Телефон компании обязателен' }),
          pattern(PHONE, { message: 'Формат: +7 (___) ___-__-__' })
        )
      ),
      vf(
        m.companyAddress,
        emp(
          required({ message: 'Адрес компании обязателен' }),
          minLength(10, { message: 'Минимум 10 символов' }),
          maxLength(300, { message: 'Максимум 300 символов' })
        )
      ),
      vf(
        m.position,
        emp(
          required({ message: 'Укажите должность' }),
          minLength(3, { message: 'Минимум 3 символа' }),
          maxLength(100, { message: 'Максимум 100 символов' })
        )
      ),
      vf(
        m.workExperienceTotal,
        emp(
          required({ message: 'Укажите общий стаж' }),
          min(0, { message: 'Не может быть отрицательным' }),
          max(60, { message: 'Максимум 60 лет' })
        )
      ),
      vf(m.workExperienceCurrent, [
        ...emp(
          required({ message: 'Укажите стаж на текущем месте' }),
          min(0, { message: 'Не может быть отрицательным' }),
          max(60, { message: 'Максимум 60 лет' })
        ),
        ...emp(currentExperienceVsTotal),
      ]),
      vf(m.businessType, self(required({ message: 'Укажите тип бизнеса' }))),
      vf(
        m.businessInn,
        self(
          required({ message: 'ИНН ИП обязателен' }),
          pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' })
        )
      ),
      vf(
        m.businessActivity,
        self(
          required({ message: 'Укажите вид деятельности' }),
          minLength(10, { message: 'Минимум 10 символов' }),
          maxLength(300, { message: 'Максимум 300 символов' })
        )
      ),
      vf(
        m.monthlyIncome,
        vs(
          required({ message: 'Укажите ежемесячный доход' }),
          min(10000, { message: 'Минимум 10 000 ₽' }),
          max(10000000, { message: 'Максимум 10 000 000 ₽' })
        )
      ),
      vf(
        m.additionalIncome,
        vs(
          min(0, { message: 'Не может быть отрицательным' }),
          max(10000000, { message: 'Максимум 10 000 000 ₽' })
        )
      ),
      vf(m.additionalIncomeSource, vs(additionalIncomeSourceRequired)),
    ],
  };
};

const step5 = (model: M) => {
  const m = model.$;
  return {
    children: [
      vf(m.maritalStatus, vs(required({ message: 'Укажите семейное положение' }))),
      vf(
        m.dependents,
        vs(
          required({ message: 'Укажите количество иждивенцев' }),
          min(0, { message: 'Не может быть отрицательным' }),
          max(10, { message: 'Максимум 10' })
        )
      ),
      vf(m.education, vs(required({ message: 'Укажите уровень образования' }))),
      vf(
        m.hasProperty,
        vs(notEmptyWhen('hasProperty', 'properties', 'Добавьте хотя бы один объект имущества'))
      ),
      vf(
        m.hasExistingLoans,
        vs(notEmptyWhen('hasExistingLoans', 'existingLoans', 'Добавьте информацию о кредите'))
      ),
      vf(
        m.hasCoBorrower,
        vs(notEmptyWhen('hasCoBorrower', 'coBorrowers', 'Добавьте информацию о созаемщике'))
      ),
      arraySection(model.properties, propertyItem),
      arraySection(model.existingLoans, existingLoanItem),
      arraySection(model.coBorrowers, coBorrowerItem),
    ],
  };
};

const step6 = (model: M) => {
  const m = model.$;
  const smsCode: V = async (value) => {
    if (!value || (value as string).length !== 6) return null;
    await new Promise((r) => setTimeout(r, 200));
    return value !== '123456'
      ? {
          code: 'invalidSmsCode',
          message: 'Неверный код подтверждения. Для демо используйте: 123456',
        }
      : null;
  };
  return {
    children: [
      vf(m.agreePersonalData, vs(required({ message: 'Согласие на обработку ПД обязательно' }))),
      vf(
        m.agreeCreditHistory,
        vs(required({ message: 'Согласие на проверку кредитной истории обязательно' }))
      ),
      vf(m.agreeTerms, vs(required({ message: 'Согласие с условиями обязательно' }))),
      vf(m.confirmAccuracy, vs(required({ message: 'Подтверждение точности обязательно' }))),
      vf(
        m.electronicSignature,
        vs(
          required({ message: 'Введите код из СМС' }),
          minLength(6, { message: 'Код — 6 символов' }),
          maxLength(6, { message: 'Код — 6 символов' }),
          pattern(/^\d{6}$/, { message: 'Только цифры' }),
          mv(smsCode)
        )
      ),
    ],
  };
};

/** Cross-field/warnings уровня всей формы (вне per-step). */
const fullExtras = (model: M) => {
  const m = model.$;
  return {
    children: [
      vf(m.monthlyPayment, vs(paymentToIncome)),
      vf(m.age, vs(validateAge, warnSeniorAge)),
      vf(m.paymentToIncomeRatio, vs(warnHighDebt)),
      vf(m.workExperienceCurrent, vs(warnLowExperience)),
    ],
  };
};

const STEP_BUILDERS = [step1, step2, step3, step4, step5, step6] as const;

/** Схема валидации конкретного шага (1-based). */
export const creditStepSchema = (step: number, model: M) =>
  STEP_BUILDERS[step - 1]?.(model) ?? { children: [] };

/** Полная схема валидации (все шаги + form-level cross-field/warnings). */
export const creditFullSchema = (model: M) => ({
  children: [...STEP_BUILDERS.map((b) => b(model)), fullExtras(model)],
});

/** Истинно, если среди ошибок нет блокирующих (severity ≠ 'warning'). */
const noBlocking = (errors: Record<string, { severity?: string }[]>): boolean =>
  Object.values(errors)
    .flat()
    .every((e) => e.severity === 'warning');

/**
 * Конфиг валидации для `FormWizard` (M1): per-step и полная валидация через `validateFormModel`.
 * Ошибки роутятся в ноды формы; warnings (severity: 'warning') не блокируют.
 */
export function makeCreditValidationConfig(model: M) {
  return {
    validateStep: async (step: number): Promise<boolean> => {
      const res = await validateFormModel(model, creditStepSchema(step, model));
      return noBlocking(res.errors);
    },
    validateAll: async (): Promise<boolean> => {
      const res = await validateFormModel(model, creditFullSchema(model));
      return noBlocking(res.errors);
    },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
