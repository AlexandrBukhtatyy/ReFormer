/**
 * Form schema, validation, behavior — credit-application iter-8 / target=renderer-json.
 *
 * Authored via MCP create-form + add-validation + add-behavior + add-form-array prompts.
 * All `componentProps` (label/placeholder/options/mask/rows/type/min/max/step) live
 * here, in `createForm`'s schema — required for `Select`/`RadioGroup` to render
 * correctly (rule D1 / Patch H). JSON layer references option arrays by name as
 * documentation, but the runtime source-of-truth is this file.
 */

import { createForm, type FormProxy } from '@reformer/core';
import { Input, InputMask, Textarea, Select, Checkbox, RadioGroup } from '@reformer/ui-kit';
import {
  required,
  email,
  min,
  max,
  minLength,
  maxLength,
  validate,
  applyWhen,
} from '@reformer/core/validators';
import {
  copyFrom,
  enableWhen,
  computeFrom,
  watchField,
  type BehaviorSchemaFn,
} from '@reformer/core/behaviors';
import type { FieldPath, ValidationSchemaFn } from '@reformer/core';
import type { CreditApplicationForm } from './types';

// ----------------------------------------------------------------------------
// Option arrays (re-exported via registry for JSON layer documentation)
// ----------------------------------------------------------------------------

export const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Кредит для бизнеса' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUSES = [
  { value: 'single', label: 'Холост/не замужем' },
  { value: 'married', label: 'Женат/Замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец/Вдова' },
];

export const EDUCATIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

export const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Другое' },
];

export const EXISTING_LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'creditCard', label: 'Кредитная карта' },
  { value: 'other', label: 'Другое' },
];

export const RELATIONSHIPS = [
  { value: 'spouse', label: 'Супруг(а)' },
  { value: 'parent', label: 'Родитель' },
  { value: 'child', label: 'Ребёнок' },
  { value: 'sibling', label: 'Брат/Сестра' },
  { value: 'relative', label: 'Другой родственник' },
  { value: 'other', label: 'Другое' },
];

// ----------------------------------------------------------------------------
// Form schema
// ----------------------------------------------------------------------------
//
// Note (Patch C update / Path C): array UI is rendered via `FormArraySection`
// from `@reformer/ui-kit/form-array`. Schema for items uses tuple-literal
// `arr: [itemSchema]`. Plain-leaf primitives only (Patch D3).

const personalDataSchema = {
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Введите имя' },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата рождения', type: 'date' },
  },
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
  gender: {
    value: 'male' as const,
    component: RadioGroup,
    componentProps: { label: 'Пол', options: GENDERS },
  },
};

const passportDataSchema = {
  series: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Серия паспорта', placeholder: '12 34', mask: '99 99' },
  },
  number: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Номер паспорта', placeholder: '123456', mask: '999999' },
  },
  issueDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата выдачи', type: 'date' },
  },
  issuedBy: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Кем выдан', placeholder: 'Введите наименование органа', rows: 2 },
  },
  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подразделения', placeholder: '123-456', mask: '999-999' },
  },
};

const addressSchema = {
  region: {
    value: '',
    component: Input,
    componentProps: { label: 'Регион', placeholder: 'Введите регион' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  street: {
    value: '',
    component: Input,
    componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
  },
  house: { value: '', component: Input, componentProps: { label: 'Дом', placeholder: '№' } },
  apartment: {
    value: '',
    component: Input,
    componentProps: { label: 'Квартира', placeholder: '№' },
  },
  postalCode: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Индекс', placeholder: '123456', mask: '999999' },
  },
};

const propertyItemSchema = {
  type: {
    value: 'apartment' as const,
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: PROPERTY_TYPES,
    },
  },
  description: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Оценочная стоимость (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 10000,
    },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
};

const existingLoanItemSchema = {
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: 'consumer' as const,
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: EXISTING_LOAN_TYPES,
    },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток задолженности (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платёж (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 100,
    },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};

const coBorrowerItemSchema = {
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date' },
    },
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  relationship: {
    value: 'spouse' as const,
    component: Select,
    componentProps: { label: 'Родство', placeholder: 'Укажите родство', options: RELATIONSHIPS },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
};

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Step 1
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50_000, { message: 'Сумма не может быть меньше 50 000 ₽' });
  max(path.loanAmount, 10_000_000, { message: 'Сумма не может быть больше 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Срок не может быть меньше 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Срок не может быть больше 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Опишите цель подробнее (мин. 10 символов)' });
  maxLength(path.loanPurpose, 500, { message: 'Не более 500 символов' });

  // Mortgage conditional
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      required(path.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(path.propertyValue, 1_000_000, {
        message: 'Стоимость недвижимости — от 1 000 000 ₽',
      });
      // initialPayment is computed (20% of propertyValue) — readonly, no manual validation needed
    }
  );

  // Car conditional
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (path) => {
      required(path.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(path.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(path.carBrand, 50, { message: 'Максимум 50 символов' });
      required(path.carModel, { message: 'Укажите модель' });
      minLength(path.carModel, 1, { message: 'Минимум 1 символ' });
      maxLength(path.carModel, 50, { message: 'Максимум 50 символов' });
      required(path.carYear, { message: 'Укажите год выпуска' });
      min(path.carYear, 2000, { message: 'Год — от 2000' });
      max(path.carYear, new Date().getFullYear() + 1, {
        message: `Год — не более ${new Date().getFullYear() + 1}`,
      });
      required(path.carPrice, { message: 'Укажите стоимость автомобиля' });
      min(path.carPrice, 300_000, { message: 'Стоимость — от 300 000 ₽' });
      max(path.carPrice, 10_000_000, { message: 'Стоимость — не более 10 000 000 ₽' });
    }
  );

  // Step 2 — personal
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.gender, { message: 'Выберите пол' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });

  // Step 2 — passport
  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите, кем выдан' });
  required(path.passportData.departmentCode, { message: 'Укажите код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });

  // Step 3 — contacts
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Некорректный формат email' });

  // Address (registration always required)
  required(path.registrationAddress.region, { message: 'Укажите регион' });
  required(path.registrationAddress.city, { message: 'Укажите город' });
  required(path.registrationAddress.street, { message: 'Укажите улицу' });
  required(path.registrationAddress.house, { message: 'Укажите номер дома' });
  required(path.registrationAddress.postalCode, { message: 'Укажите индекс' });

  applyWhen(
    path.sameAsRegistration,
    (same) => same === false,
    (path) => {
      required(path.residenceAddress.region, { message: 'Укажите регион проживания' });
      required(path.residenceAddress.city, { message: 'Укажите город проживания' });
      required(path.residenceAddress.street, { message: 'Укажите улицу проживания' });
      required(path.residenceAddress.house, { message: 'Укажите номер дома' });
      required(path.residenceAddress.postalCode, { message: 'Укажите индекс' });
    }
  );

  // Step 4 — employment
  required(path.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10_000, { message: 'Доход — от 10 000 ₽' });

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.getValue().workExperienceTotal;
    if (value != null && total != null && Number(value) > Number(total)) {
      return {
        code: 'currentExceedsTotal',
        message: 'Стаж на текущем месте не может быть больше общего стажа',
      };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (path) => {
      required(path.companyName, { message: 'Введите название компании' });
      required(path.companyInn, { message: 'Введите ИНН компании' });
      required(path.position, { message: 'Введите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (path) => {
      required(path.businessType, { message: 'Укажите тип бизнеса' });
      required(path.businessInn, { message: 'Введите ИНН ИП' });
      required(path.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );

  // Step 5
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.education, { message: 'Укажите уровень образования' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Не может быть отрицательным' });
  max(path.dependents, 10, { message: 'Не более 10' });

  // Step 6 — required consents
  validate(path.agreePersonalData, (v) =>
    v
      ? null
      : { code: 'mustAgree', message: 'Необходимо согласие на обработку персональных данных' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v ? null : { code: 'mustAgree', message: 'Необходимо согласие на проверку кредитной истории' }
  );
  validate(path.agreeTerms, (v) =>
    v ? null : { code: 'mustAgree', message: 'Необходимо согласие с условиями кредитования' }
  );
  validate(path.confirmAccuracy, (v) =>
    v ? null : { code: 'mustAgree', message: 'Подтвердите точность введённых данных' }
  );
  required(path.electronicSignature, { message: 'Введите код подтверждения из СМС' });

  // Cross-field: age 18-70
  validate(path.personalData.birthDate, (value) => {
    if (!value) return null;
    const birth = new Date(String(value));
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
    if (age < 18) return { code: 'tooYoung', message: 'Возраст заёмщика — от 18 лет' };
    if (age > 70) return { code: 'tooOld', message: 'Возраст заёмщика — не более 70 лет' };
    return null;
  });
};

// Per-step validation (for "Далее" button)
const validationStep1: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50_000, { message: 'Сумма не может быть меньше 50 000 ₽' });
  max(path.loanAmount, 10_000_000, { message: 'Сумма не может быть больше 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
};

const validationStep2: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите, кем выдан' });
  required(path.passportData.departmentCode, { message: 'Укажите код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const validationStep3: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Некорректный формат email' });
  required(path.registrationAddress.region, { message: 'Укажите регион' });
  required(path.registrationAddress.city, { message: 'Укажите город' });
  required(path.registrationAddress.street, { message: 'Укажите улицу' });
  required(path.registrationAddress.house, { message: 'Укажите номер дома' });
  required(path.registrationAddress.postalCode, { message: 'Укажите индекс' });
};

const validationStep4: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10_000, { message: 'Доход — от 10 000 ₽' });
};

const validationStep5: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.education, { message: 'Укажите уровень образования' });
};

const validationStep6: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.agreePersonalData, (v) =>
    v
      ? null
      : { code: 'mustAgree', message: 'Необходимо согласие на обработку персональных данных' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v ? null : { code: 'mustAgree', message: 'Необходимо согласие на проверку кредитной истории' }
  );
  validate(path.agreeTerms, (v) =>
    v ? null : { code: 'mustAgree', message: 'Необходимо согласие с условиями кредитования' }
  );
  validate(path.confirmAccuracy, (v) =>
    v ? null : { code: 'mustAgree', message: 'Подтвердите точность введённых данных' }
  );
  required(path.electronicSignature, { message: 'Введите код из СМС' });
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: validationStep1,
  2: validationStep2,
  3: validationStep3,
  4: validationStep4,
  5: validationStep5,
  6: validationStep6,
};

// ----------------------------------------------------------------------------
// Behavior
// ----------------------------------------------------------------------------

const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ---- copyFrom ----
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // ---- enableWhen (conditional fields, hide via enable disable + reset) ----
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', { resetOnDisable: true });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', { resetOnDisable: true });

  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

  enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.companyInn, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.companyPhone, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.companyAddress, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.position, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });

  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });

  // ---- computeFrom ----

  // Patch I: subscribe to GROUP node, computeFn reads nested fields via values.personalData.*
  computeFrom(
    [path.personalData] as never,
    path.fullName,
    (values: { personalData?: { lastName?: string; firstName?: string; middleName?: string } }) => {
      const pd = values.personalData;
      return [pd?.lastName, pd?.firstName, pd?.middleName].filter(Boolean).join(' ').trim();
    }
  );

  // age: subscribe to group node (single-leaf source still works — group form has personalData)
  computeFrom(
    [path.personalData] as never,
    path.age,
    (values: { personalData?: { birthDate?: string } }): number | null => {
      const birthDate = values.personalData?.birthDate;
      if (!birthDate) return null;
      const birth = new Date(String(birthDate));
      if (Number.isNaN(birth.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
      return age;
    }
  );

  // totalIncome = monthlyIncome + additionalIncome (same level, flat shape)
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    (values: { monthlyIncome?: number | null; additionalIncome?: number | null }): number => {
      return Number(values.monthlyIncome ?? 0) + Number(values.additionalIncome ?? 0);
    }
  );

  // initialPayment = 20% of propertyValue (only meaningful for mortgage)
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    (values: { propertyValue?: number | null }): number | null => {
      const pv = values.propertyValue;
      if (pv == null) return null;
      return Math.round(Number(pv) * 0.2);
    }
  );

  // interestRate: simplified model — depends on loanType
  watchField(
    path.loanType,
    (loanType, ctx) => {
      const baseRates: Record<string, number> = {
        consumer: 18,
        mortgage: 8.5,
        car: 12,
        business: 14,
        refinancing: 10,
      };
      const rate = baseRates[String(loanType)] ?? 15;
      const current = Number(ctx.form.getValue().interestRate);
      if (current !== rate) {
        ctx.form.interestRate.setValue(rate);
      }
    },
    { immediate: false }
  );

  // monthlyPayment: annuity formula. watchField on each input, shared compute.
  const computeMonthlyPayment = (form: CreditApplicationForm) => {
    const P = Number(form.loanAmount);
    const months = Number(form.loanTerm);
    const ratePct = Number(form.interestRate);
    if (!P || !months || !ratePct) {
      return 0;
    }
    const i = ratePct / 100 / 12;
    const factor = Math.pow(1 + i, months);
    return Math.round((P * (i * factor)) / (factor - 1));
  };
  const updateMonthlyPayment = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
    const formValues = ctx.form.getValue();
    const payment = computeMonthlyPayment(formValues);
    if (Number(formValues.monthlyPayment) !== payment) {
      ctx.form.monthlyPayment.setValue(payment);
    }
  };
  watchField(path.loanAmount, (_v, ctx) => updateMonthlyPayment(ctx), { immediate: false });
  watchField(path.loanTerm, (_v, ctx) => updateMonthlyPayment(ctx), { immediate: false });
  watchField(path.interestRate, (_v, ctx) => updateMonthlyPayment(ctx), { immediate: false });

  // paymentToIncomeRatio = monthlyPayment / totalIncome * 100
  const updatePaymentRatio = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
    const formValues = ctx.form.getValue();
    const mp = Number(formValues.monthlyPayment);
    const ti = Number(formValues.totalIncome);
    const ratio = ti > 0 ? Math.round((mp / ti) * 100 * 100) / 100 : 0;
    if (Number(formValues.paymentToIncomeRatio) !== ratio) {
      ctx.form.paymentToIncomeRatio.setValue(ratio);
    }
  };
  watchField(path.monthlyPayment, (_v, ctx) => updatePaymentRatio(ctx), { immediate: false });
  watchField(path.totalIncome, (_v, ctx) => updatePaymentRatio(ctx), { immediate: false });

  // Reset car model on car brand change
  watchField(
    path.carBrand,
    (_v, ctx) => {
      if (ctx.form.getValue().carModel) {
        ctx.form.carModel.setValue('');
      }
    },
    { immediate: false }
  );

  // Reset registrationAddress.city when region changes
  watchField(
    path.registrationAddress.region,
    (_v, ctx) => {
      if (ctx.form.getValue().registrationAddress?.city) {
        ctx.form.registrationAddress.city.setValue('');
      }
    },
    { immediate: false }
  );

  // Cleanup arrays on toggle off
  watchField(
    path.hasProperty,
    (value, ctx) => {
      if (!value) {
        const arr = ctx.form.properties;
        if (arr && typeof arr.clear === 'function' && ctx.form.getValue().properties?.length) {
          arr.clear();
        }
      }
    },
    { immediate: false }
  );
  watchField(
    path.hasExistingLoans,
    (value, ctx) => {
      if (!value) {
        const arr = ctx.form.existingLoans;
        if (arr && typeof arr.clear === 'function' && ctx.form.getValue().existingLoans?.length) {
          arr.clear();
        }
      }
    },
    { immediate: false }
  );
  watchField(
    path.hasCoBorrower,
    (value, ctx) => {
      if (!value) {
        const arr = ctx.form.coBorrowers;
        if (arr && typeof arr.clear === 'function' && ctx.form.getValue().coBorrowers?.length) {
          arr.clear();
        }
      }
    },
    { immediate: false }
  );
};

// ----------------------------------------------------------------------------
// FormSchema (literal — every spec field present)
// ----------------------------------------------------------------------------

// Cast createForm to dodge TS2589 on deeply nested form (4+ levels via coBorrowers[].personalData)
type CreateFormCast = (config: {
  form: unknown;
  validation: unknown;
  behavior: unknown;
}) => FormProxy<CreditApplicationForm>;

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return (createForm as unknown as CreateFormCast)({
    form: {
      // ---- Step 1 ----
      loanType: {
        value: 'consumer',
        component: Select,
        componentProps: {
          label: 'Тип кредита',
          placeholder: 'Выберите тип кредита',
          options: LOAN_TYPES,
        },
      },
      loanAmount: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Сумма кредита (₽)',
          placeholder: 'Введите сумму',
          type: 'number',
          min: 50_000,
          max: 10_000_000,
          step: 10_000,
        },
      },
      loanTerm: {
        value: 12,
        component: Input,
        componentProps: {
          label: 'Срок кредита (месяцев)',
          placeholder: 'Введите срок',
          type: 'number',
          min: 6,
          max: 240,
        },
      },
      loanPurpose: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Цель кредита',
          placeholder: 'Опишите, на что планируете потратить средства',
          rows: 4,
          maxLength: 500,
        },
      },
      propertyValue: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стоимость недвижимости (₽)',
          placeholder: 'Введите стоимость',
          type: 'number',
          min: 1_000_000,
          step: 100_000,
        },
      },
      initialPayment: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Первоначальный взнос (₽)',
          placeholder: '20% от стоимости',
          type: 'number',
          readOnly: true,
        },
      },
      carBrand: {
        value: '',
        component: Input,
        componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
      },
      carModel: {
        value: '',
        component: Input,
        componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
      },
      carYear: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Год выпуска',
          placeholder: '2020',
          type: 'number',
          min: 2000,
          max: new Date().getFullYear() + 1,
        },
      },
      carPrice: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стоимость автомобиля (₽)',
          placeholder: 'Введите стоимость',
          type: 'number',
          min: 300_000,
          max: 10_000_000,
          step: 10_000,
        },
      },

      // ---- Step 2 ----
      personalData: personalDataSchema,
      passportData: passportDataSchema,
      inn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН', placeholder: '123456789012', mask: '999999999999' },
      },
      snils: {
        value: '',
        component: InputMask,
        componentProps: { label: 'СНИЛС', placeholder: '123-456-789 00', mask: '999-999-999 99' },
      },

      // ---- Step 3 ----
      phoneMain: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Основной телефон',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        },
      },
      phoneAdditional: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Дополнительный телефон',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
      },
      emailAdditional: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Дополнительный email',
          placeholder: 'example@mail.com',
          type: 'email',
        },
      },
      registrationAddress: addressSchema,
      sameAsRegistration: {
        value: true,
        component: Checkbox,
        componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
      },
      residenceAddress: addressSchema,
      sameEmail: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Дублировать email' },
      },

      // ---- Step 4 ----
      employmentStatus: {
        value: 'employed',
        component: RadioGroup,
        componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
      },
      companyName: {
        value: '',
        component: Input,
        componentProps: { label: 'Название компании', placeholder: 'Введите название' },
      },
      companyInn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН компании', placeholder: '1234567890', mask: '9999999999' },
      },
      companyPhone: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Телефон компании',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        },
      },
      companyAddress: {
        value: '',
        component: Input,
        componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
      },
      position: {
        value: '',
        component: Input,
        componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
      },
      workExperienceTotal: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Общий стаж работы (месяцев)',
          placeholder: '0',
          type: 'number',
          min: 0,
        },
      },
      workExperienceCurrent: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стаж на текущем месте (месяцев)',
          placeholder: '0',
          type: 'number',
          min: 0,
        },
      },
      monthlyIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Ежемесячный доход (₽)',
          placeholder: '0',
          type: 'number',
          min: 10_000,
          step: 1000,
        },
      },
      additionalIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Дополнительный доход (₽)',
          placeholder: '0',
          type: 'number',
          min: 0,
          step: 1000,
        },
      },
      additionalIncomeSource: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Источник дополнительного дохода',
          placeholder: 'Опишите источник',
        },
      },
      businessType: {
        value: '',
        component: Input,
        componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
      },
      businessInn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН ИП', placeholder: '123456789012', mask: '999999999999' },
      },
      businessActivity: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Вид деятельности',
          placeholder: 'Опишите вид деятельности',
          rows: 3,
        },
      },

      // ---- Step 5 ----
      maritalStatus: {
        value: 'single',
        component: RadioGroup,
        componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
      },
      dependents: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Количество иждивенцев',
          placeholder: '0',
          type: 'number',
          min: 0,
          max: 10,
        },
      },
      education: {
        value: 'higher',
        component: Select,
        componentProps: {
          label: 'Образование',
          placeholder: 'Выберите уровень образования',
          options: EDUCATIONS,
        },
      },
      hasProperty: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'У меня есть имущество' },
      },
      properties: [propertyItemSchema],
      hasExistingLoans: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'У меня есть другие кредиты' },
      },
      existingLoans: [existingLoanItemSchema],
      hasCoBorrower: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Добавить созаемщика' },
      },
      coBorrowers: [coBorrowerItemSchema],

      // ---- Step 6 ----
      agreePersonalData: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие на обработку персональных данных' },
      },
      agreeCreditHistory: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие на проверку кредитной истории' },
      },
      agreeMarketing: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие на получение маркетинговых материалов' },
      },
      agreeTerms: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие с условиями кредитования' },
      },
      confirmAccuracy: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Подтверждаю точность введённых данных' },
      },
      electronicSignature: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Код подтверждения из СМС',
          placeholder: '123456',
          mask: '999999',
        },
      },

      // ---- Computed (readonly, Patch H camelCase readOnly) ----
      interestRate: {
        value: 0,
        component: Input,
        componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number', readOnly: true },
      },
      fullName: {
        value: '',
        component: Input,
        componentProps: { label: 'Полное имя', readOnly: true },
      },
      age: {
        value: null,
        component: Input,
        componentProps: { label: 'Возраст (лет)', type: 'number', readOnly: true },
      },
      totalIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true },
      },
      paymentToIncomeRatio: {
        value: 0,
        component: Input,
        componentProps: { label: 'Процент платежа от дохода (%)', type: 'number', readOnly: true },
      },
      coBorrowersIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Доход созаёмщиков (₽)', type: 'number', readOnly: true },
      },
    },
    validation: creditApplicationValidation,
    behavior: creditApplicationBehavior,
  });
}
