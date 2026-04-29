/**
 * Form schema, validation, behavior — credit-application iter-7 page 1 (target=core)
 *
 * Patches applied:
 * - Patch B: union-literal types preserved (no `extends FormFields` in types.ts)
 * - Patch D: ALL Select/RadioGroup/Input componentProps (label, placeholder, options, mask)
 *   declared at createForm-level, not in JSON
 * - cycle prevention: every watchField has `{immediate:false}` + value-equality guard before setValue
 * - PLAIN leaves in array template factories (FormArray Risk #3)
 * - NO `enableWhen` on whole ArrayNode — JSX-conditional gating in index.tsx
 */

import {
  createForm,
  type FormSchema,
  type FieldPath,
  type ValidationSchemaFn,
  type FormProxy,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  pattern,
  validate,
  validateItems,
  applyWhen,
  notEmpty,
} from '@reformer/core/validators';
import {
  computeFrom,
  copyFrom,
  enableWhen,
  watchField,
  type BehaviorSchemaFn,
} from '@reformer/core/behaviors';
import { Input, InputMask, Textarea, Checkbox, RadioGroup, Select } from '@reformer/ui-kit';
import type {
  CreditApplicationForm,
  PersonalData,
  PassportData,
  Address,
  Property,
  ExistingLoan,
  CoBorrower,
} from './types';

// ============================================================================
// Option lists (canonical Russian labels from spec)
// ============================================================================

export const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
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
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'Женат / Замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / Вдова' },
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

// ============================================================================
// Nested schemas
// ============================================================================

const personalDataSchema: FormSchema<PersonalData> = {
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
  gender: {
    value: 'male',
    component: RadioGroup,
    componentProps: { label: 'Пол', options: GENDERS },
  },
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
};

const passportDataSchema: FormSchema<PassportData> = {
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
    component: Input,
    componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа' },
  },
  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подразделения', placeholder: '123-456', mask: '999-999' },
  },
};

const addressSchema: FormSchema<Address> = {
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
  house: {
    value: '',
    component: Input,
    componentProps: { label: 'Дом', placeholder: '№' },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: { label: 'Квартира', placeholder: '№' },
  },
  postalCode: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Индекс', placeholder: '000000', mask: '999999' },
  },
};

// Array item schemas
const propertyItemSchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
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
    componentProps: {
      label: 'Описание',
      placeholder: 'Опишите имущество',
      rows: 2,
    },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Оценочная стоимость (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
};

const existingLoanItemSchema: FormSchema<ExistingLoan> = {
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита' },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', placeholder: '0', type: 'number', min: 0 },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток задолженности (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', placeholder: '0', type: 'number', min: 0 },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};

const coBorrowerItemSchema: FormSchema<CoBorrower> = {
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
    componentProps: {
      label: 'Email',
      placeholder: 'example@mail.com',
      type: 'email',
    },
  },
  relationship: {
    value: '',
    component: Input,
    componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
};

// ============================================================================
// Root form schema
// ============================================================================

const formSchema: FormSchema<CreditApplicationForm> = {
  // -------------------- Шаг 1 --------------------
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
    value: 0,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      placeholder: 'Введите сумму',
      type: 'number',
      min: 50000,
      max: 10000000,
      step: 10000,
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
    value: 0,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 1000000,
      step: 100000,
    },
  },
  initialPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Введите сумму',
      type: 'number',
      min: 0,
      readOnly: true,
      disabled: true,
    },
  },
  carBrand: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Например: Toyota',
    },
  },
  carModel: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Например: Camry',
    },
  },
  carYear: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      placeholder: '2020',
      type: 'number',
      min: 2000,
    },
  },
  carPrice: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 300000,
      max: 10000000,
    },
  },

  // -------------------- Шаг 2 --------------------
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН',
      placeholder: '123456789012',
      mask: '999999999999',
    },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'СНИЛС',
      placeholder: '123-456-789 00',
      mask: '999-999-999 99',
    },
  },

  // -------------------- Шаг 3 --------------------
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
    componentProps: {
      label: 'Email',
      placeholder: 'example@mail.com',
      type: 'email',
    },
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
    componentProps: {
      label: 'Адрес проживания совпадает с адресом регистрации',
    },
  },
  residenceAddress: addressSchema,

  // -------------------- Шаг 4 --------------------
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_STATUSES,
    },
  },
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН компании',
      placeholder: '1234567890',
      mask: '9999999999',
    },
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
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  workExperienceCurrent: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 10000,
      step: 1000,
    },
  },
  additionalIncome: {
    value: 0,
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
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
  },
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
  },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН ИП',
      placeholder: '123456789012',
      mask: '999999999999',
    },
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

  // -------------------- Шаг 5 --------------------
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

  // -------------------- Шаг 6 --------------------
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
    componentProps: { label: 'Подтверждаю точность введенных данных' },
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

  // -------------------- Computed (read-only) --------------------
  interestRate: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, disabled: true },
  },
  age: {
    value: 0,
    component: Input,
    componentProps: { label: 'Возраст (лет)', type: 'number', readOnly: true, disabled: true },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий доход (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процент платежа от дохода (%)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Доход созаемщиков (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
};

// ============================================================================
// Validation — per-step + full
// ============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок: 240 месяцев (20 лет)' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Опишите цель подробнее (минимум 10 символов)' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' });
      validate(p.initialPayment, (value, ctx) => {
        const propVal = ctx.form.propertyValue.getValue() as number;
        const ip = (value ?? 0) as number;
        if (propVal && ip < propVal * 0.2) {
          return {
            code: 'initialPaymentTooLow',
            message: 'Первоначальный взнос должен составлять минимум 20% от стоимости недвижимости',
          };
        }
        return null;
      });
    }
  );

  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (p) => {
      required(p.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(p.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(p.carBrand, 50, { message: 'Максимум 50 символов' });
      required(p.carModel, { message: 'Укажите модель автомобиля' });
      minLength(p.carModel, 1, { message: 'Минимум 1 символ' });
      maxLength(p.carModel, 50, { message: 'Максимум 50 символов' });
      required(p.carYear, { message: 'Укажите год выпуска' });
      min(p.carYear, 2000, { message: 'Год выпуска не ранее 2000' });
      max(p.carYear, new Date().getFullYear() + 1, {
        message: `Год выпуска не позднее ${new Date().getFullYear() + 1}`,
      });
      required(p.carPrice, { message: 'Укажите стоимость автомобиля' });
      min(p.carPrice, 300000, { message: 'Минимальная стоимость: 300 000 ₽' });
      max(p.carPrice, 10000000, { message: 'Максимальная стоимость: 10 000 000 ₽' });
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.gender, { message: 'Укажите пол' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });

  required(path.passportData.series, { message: 'Введите серию паспорта' });
  pattern(path.passportData.series, /^\d{2}\s\d{2}$/, {
    message: 'Серия должна быть в формате 99 99',
  });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  pattern(path.passportData.number, /^\d{6}$/, { message: 'Номер паспорта — 6 цифр' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите, кем выдан паспорт' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });
  pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, {
    message: 'Код подразделения в формате 999-999',
  });

  required(path.inn, { message: 'Введите ИНН' });
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН — 12 цифр' });
  required(path.snils, { message: 'Введите СНИЛС' });
  pattern(path.snils, /^\d{3}-\d{3}-\d{3}\s\d{2}$/, {
    message: 'СНИЛС в формате 999-999-999 99',
  });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Некорректный формат email' });

  required(path.registrationAddress.region, { message: 'Укажите регион' });
  required(path.registrationAddress.city, { message: 'Укажите город' });
  required(path.registrationAddress.street, { message: 'Укажите улицу' });
  required(path.registrationAddress.house, { message: 'Укажите дом' });
  required(path.registrationAddress.postalCode, { message: 'Укажите индекс' });

  applyWhen(
    path.sameAsRegistration,
    (same) => same === false,
    (p) => {
      required(p.residenceAddress.region, { message: 'Укажите регион проживания' });
      required(p.residenceAddress.city, { message: 'Укажите город проживания' });
      required(p.residenceAddress.street, { message: 'Укажите улицу проживания' });
      required(p.residenceAddress.house, { message: 'Укажите дом проживания' });
      required(p.residenceAddress.postalCode, { message: 'Укажите индекс проживания' });
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });

  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (p) => {
      required(p.companyName, { message: 'Укажите название компании' });
      required(p.companyInn, { message: 'Укажите ИНН компании' });
      pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН компании — 10 цифр' });
      required(p.companyPhone, { message: 'Укажите телефон компании' });
      required(p.companyAddress, { message: 'Укажите адрес компании' });
      required(p.position, { message: 'Укажите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Укажите тип бизнеса' });
      required(p.businessInn, { message: 'Укажите ИНН ИП' });
      pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН ИП — 12 цифр' });
      required(p.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );

  required(path.workExperienceTotal, { message: 'Укажите общий стаж работы' });
  min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.getValue() as number;
    const cur = (value ?? 0) as number;
    if (total && cur > total) {
      return {
        code: 'currentExperienceExceedsTotal',
        message: 'Стаж на текущем месте не может быть больше общего стажа',
      };
    }
    return null;
  });

  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });
  validate(path.additionalIncomeSource, (value, ctx) => {
    const additional = (ctx.form.additionalIncome.getValue() ?? 0) as number;
    if (additional > 0 && (!value || (value as string).trim() === '')) {
      return {
        code: 'sourceRequired',
        message: 'Укажите источник дополнительного дохода',
      };
    }
    return null;
  });
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Количество не может быть отрицательным' });
  max(path.dependents, 10, { message: 'Максимальное количество иждивенцев: 10' });
  required(path.education, { message: 'Укажите уровень образования' });

  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      notEmpty(p.properties, { message: 'Добавьте хотя бы один объект имущества' });
      validateItems(p.properties, (item) => {
        required(item.type, { message: 'Укажите тип имущества' });
        required(item.description, { message: 'Опишите имущество' });
        minLength(item.description, 5, { message: 'Описание минимум 5 символов' });
        required(item.estimatedValue, { message: 'Укажите оценочную стоимость' });
        min(item.estimatedValue, 0, { message: 'Стоимость не может быть отрицательной' });
      });
    }
  );

  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Добавьте информацию о существующем кредите' });
      validateItems(p.existingLoans, (item) => {
        required(item.bank, { message: 'Укажите банк' });
        required(item.type, { message: 'Укажите тип кредита' });
        required(item.amount, { message: 'Укажите сумму кредита' });
        min(item.amount, 0, { message: 'Сумма не может быть отрицательной' });
        required(item.remainingAmount, { message: 'Укажите остаток задолженности' });
        min(item.remainingAmount, 0, { message: 'Остаток не может быть отрицательным' });
        required(item.monthlyPayment, { message: 'Укажите ежемесячный платеж' });
        min(item.monthlyPayment, 0, { message: 'Платеж не может быть отрицательным' });
        required(item.maturityDate, { message: 'Укажите дату погашения' });
      });
    }
  );

  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Добавьте созаемщика' });
      validateItems(p.coBorrowers, (item) => {
        required(item.personalData.lastName, { message: 'Введите фамилию созаемщика' });
        required(item.personalData.firstName, { message: 'Введите имя созаемщика' });
        required(item.personalData.middleName, { message: 'Введите отчество созаемщика' });
        required(item.personalData.birthDate, { message: 'Укажите дату рождения созаемщика' });
        required(item.phone, { message: 'Введите телефон созаемщика' });
        required(item.email, { message: 'Введите email созаемщика' });
        emailValidator(item.email, { message: 'Некорректный формат email' });
        required(item.relationship, { message: 'Укажите родство' });
        required(item.monthlyIncome, { message: 'Укажите доход созаемщика' });
        min(item.monthlyIncome, 0, { message: 'Доход не может быть отрицательным' });
      });
    }
  );
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.agreePersonalData, {
    message: 'Согласие на обработку персональных данных обязательно',
  });
  required(path.agreeCreditHistory, {
    message: 'Согласие на проверку кредитной истории обязательно',
  });
  required(path.agreeTerms, {
    message: 'Согласие с условиями кредитования обязательно',
  });
  required(path.confirmAccuracy, {
    message: 'Подтверждение точности данных обязательно',
  });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  pattern(path.electronicSignature, /^\d{6}$/, {
    message: 'Код подтверждения должен содержать 6 цифр',
  });
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

export const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// ============================================================================
// Behavior — computed + conditional + copyFrom + watchField
// ============================================================================

const formBehavior: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // -- copyFrom: registration -> residence (when sameAsRegistration === true)
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // -- enableWhen: leaf-level conditional fields (NOT on whole ArrayNode)
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
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

  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });

  // -- computeFrom: same-level computed fields
  // initialPayment = 20% of propertyValue (mortgage)
  computeFrom([path.propertyValue], path.initialPayment, (values) => {
    const pv = (values.propertyValue ?? 0) as number;
    return pv > 0 ? Math.round(pv * 0.2) : 0;
  });

  // interestRate — depends on loanType (simplified base rates)
  computeFrom([path.loanType, path.hasProperty], path.interestRate, (values) => {
    const base: Record<string, number> = {
      consumer: 15.5,
      mortgage: 8.5,
      car: 11.5,
      business: 13.5,
      refinancing: 10.5,
    };
    let rate = base[values.loanType as string] ?? 15.5;
    if (values.hasProperty) rate -= 0.5; // discount for property collateral
    return Math.round(rate * 100) / 100;
  });

  // monthlyPayment — annuity formula
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const P = (values.loanAmount ?? 0) as number;
      const n = (values.loanTerm ?? 0) as number;
      const annual = (values.interestRate ?? 0) as number;
      if (!P || !n || !annual) return 0;
      const i = annual / 100 / 12;
      const k = Math.pow(1 + i, n);
      return Math.round((P * (i * k)) / (k - 1));
    }
  );

  // fullName = lastName + firstName + middleName
  computeFrom([path.personalData], path.fullName, (values) => {
    const pd = values.personalData;
    return [pd?.lastName, pd?.firstName, pd?.middleName].filter(Boolean).join(' ').trim();
  });

  // age — from birthDate
  computeFrom([path.personalData], path.age, (values) => {
    const bd = values.personalData?.birthDate;
    if (!bd) return 0;
    const date = new Date(bd);
    if (isNaN(date.getTime())) return 0;
    const now = new Date();
    let years = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < date.getDate())) years -= 1;
    return years;
  });

  // totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    (values) => ((values.monthlyIncome ?? 0) as number) + ((values.additionalIncome ?? 0) as number)
  );

  // paymentToIncomeRatio = monthlyPayment / totalIncome * 100
  computeFrom([path.monthlyPayment, path.totalIncome], path.paymentToIncomeRatio, (values) => {
    const mp = (values.monthlyPayment ?? 0) as number;
    const ti = (values.totalIncome ?? 0) as number;
    if (!ti) return 0;
    return Math.round((mp / ti) * 10000) / 100;
  });

  // -- watchField (ALL with `{immediate: false}` + value-equality guards)

  // 1. carBrand changed — clear carModel
  watchField(
    path.carBrand,
    (_value, ctx) => {
      const cur = ctx.form.carModel.getValue() as string;
      if (cur !== '') ctx.form.carModel.setValue('');
    },
    { immediate: false }
  );

  // 2. coBorrowers changes — recompute coBorrowersIncome
  watchField(
    path.coBorrowers,
    (value, ctx) => {
      const items = (value ?? []) as Array<{ monthlyIncome?: number }>;
      const sum = items.reduce((acc, it) => acc + ((it.monthlyIncome ?? 0) as number), 0);
      const cur = ctx.form.coBorrowersIncome.getValue() as number;
      if (cur !== sum) ctx.form.coBorrowersIncome.setValue(sum);
    },
    { immediate: false }
  );

  // 3. hasProperty unchecked — clear properties array
  watchField(
    path.hasProperty,
    (value, ctx) => {
      if (!value) {
        const items = (ctx.form.properties.getValue() ?? []) as unknown[];
        if (items.length > 0) ctx.form.properties.clear();
      }
    },
    { immediate: false }
  );

  // 4. hasExistingLoans unchecked — clear existingLoans array
  watchField(
    path.hasExistingLoans,
    (value, ctx) => {
      if (!value) {
        const items = (ctx.form.existingLoans.getValue() ?? []) as unknown[];
        if (items.length > 0) ctx.form.existingLoans.clear();
      }
    },
    { immediate: false }
  );

  // 5. hasCoBorrower unchecked — clear coBorrowers array
  watchField(
    path.hasCoBorrower,
    (value, ctx) => {
      if (!value) {
        const items = (ctx.form.coBorrowers.getValue() ?? []) as unknown[];
        if (items.length > 0) ctx.form.coBorrowers.clear();
      }
    },
    { immediate: false }
  );

  // 6. totalIncome — dynamic max for loanAmount (no more than 10 yearly incomes)
  watchField(
    path.totalIncome,
    (value, ctx) => {
      const ti = (value ?? 0) as number;
      if (ti > 0) {
        const newMax = Math.min(ti * 12 * 10, 10000000);
        queueMicrotask(() => {
          ctx.form.loanAmount.updateComponentProps({ max: newMax });
        });
      }
    },
    { immediate: false }
  );

  // 7. age — dynamic max for loanTerm (must be paid by age 70)
  watchField(
    path.age,
    (value, ctx) => {
      const a = (value ?? 0) as number;
      if (a >= 18) {
        const yearsLeft = Math.max(70 - a, 1);
        const newMax = Math.min(yearsLeft * 12, 240);
        queueMicrotask(() => {
          ctx.form.loanTerm.updateComponentProps({ max: newMax });
        });
      }
    },
    { immediate: false }
  );

  // 8. loanType — clear non-matching conditional fields explicitly (defensive)
  watchField(
    path.loanType,
    (value, ctx) => {
      const t = value as string;
      if (t !== 'mortgage') {
        const pv = ctx.form.propertyValue.getValue() as number;
        if (pv !== 0) ctx.form.propertyValue.setValue(0);
      }
      if (t !== 'car') {
        const cb = ctx.form.carBrand.getValue() as string;
        if (cb !== '') ctx.form.carBrand.setValue('');
        const cm = ctx.form.carModel.getValue() as string;
        if (cm !== '') ctx.form.carModel.setValue('');
        const cy = ctx.form.carYear.getValue() as number;
        if (cy !== 0) ctx.form.carYear.setValue(0);
        const cp = ctx.form.carPrice.getValue() as number;
        if (cp !== 0) ctx.form.carPrice.setValue(0);
      }
    },
    { immediate: false }
  );
};

// ============================================================================
// Public factory
// ============================================================================

export function createCreditForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior: formBehavior,
  });
}

// Item factories — PLAIN leaves only (NEVER FieldConfig)
export const propertyItemFactory = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const existingLoanItemFactory = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const coBorrowerItemFactory = (): CoBorrower => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});
