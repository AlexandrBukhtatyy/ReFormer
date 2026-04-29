/**
 * Form schema + behavior + validation for the iter-9 credit-application form.
 *
 * Composed via `createForm({ form, behavior, validation })`. All input-rendering
 * `componentProps` (label / placeholder / options / mask / type / rows /
 * maxLength) live here so the renderer reads them from `state.componentProps`
 * at render time (no JSON-only props).
 *
 * camelCase React-style prop names per Patch H (`readOnly`, `maxLength`).
 */

import { createForm, type FormProxy, type FormSchema } from '@reformer/core';
import { apply } from '@reformer/core/validators';
import { computeFrom, copyFrom } from '@reformer/core/behaviors';
import {
  email as emailValidator,
  max,
  maxLength as maxLengthValidator,
  min,
  minLength as minLengthValidator,
  required,
} from '@reformer/core/validators';
import {
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import type {
  Address,
  CoBorrower,
  CreditApplicationForm,
  ExistingLoan,
  PassportData,
  PersonalData,
  Property,
} from './types';

// ============================================================================
// Option lists (declared once, referenced in componentProps)
// ============================================================================

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
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / вдова' },
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
  { value: 'car', label: 'Автомобиль' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Другое' },
];

// ============================================================================
// Nested form schemas
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
    componentProps: {
      label: 'Место рождения',
      placeholder: 'Введите место рождения',
    },
  },
};

const passportDataSchema: FormSchema<PassportData> = {
  series: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Серия паспорта',
      placeholder: '12 34',
      mask: '99 99',
    },
  },
  number: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Номер паспорта',
      placeholder: '123456',
      mask: '999999',
    },
  },
  issueDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата выдачи', type: 'date' },
  },
  issuedBy: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Кем выдан',
      placeholder: 'Введите название органа',
    },
  },
  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подразделения',
      placeholder: '123-456',
      mask: '999-999',
    },
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
      label: 'Оценочная стоимость',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
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
    componentProps: {
      label: 'Сумма кредита',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток задолженности',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
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
      label: 'Ежемесячный доход',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
};

// ============================================================================
// Top-level form schema
// ============================================================================

const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ---- Step 1: Основная информация о кредите --------------------------------
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

  // Mortgage-specific
  propertyValue: {
    value: null,
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
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Введите сумму',
      type: 'number',
      min: 0,
      step: 10000,
      readOnly: true,
    },
  },

  // Car-loan-specific
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
      min: 300000,
      max: 10000000,
      step: 10000,
    },
  },

  // ---- Step 2: Персональные данные ------------------------------------------
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

  // ---- Step 3: Контакты -----------------------------------------------------
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

  // ---- Step 4: Занятость ----------------------------------------------------
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
      min: 10000,
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

  // ---- Step 5: Доп. информация ----------------------------------------------
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
  // FormArray template — array tuple `[itemSchema]` shape (NOT { value: [], itemSchema })
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

  // ---- Step 6: Согласия и подпись -------------------------------------------
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

  // ---- Computed (readonly) --------------------------------------------------
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
      label: 'Ежемесячный платёж (₽)',
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
    value: null,
    component: Input,
    componentProps: {
      label: 'Возраст (лет)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
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
      label: 'Доход созаёмщиков (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
};

// ============================================================================
// Behavior — copyFrom + computeFrom (Patch I — group-node subscription, no `as never`)
// ============================================================================

function calcAge(birthDate: string): number {
  if (!birthDate) return 0;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

function annuityMonthly(amount: number, term: number, rate: number): number {
  if (!amount || !term || !rate) return 0;
  const r = rate / 100 / 12;
  const n = term;
  return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

const creditApplicationBehavior = (path: import('@reformer/core').FieldPath<CreditApplicationForm>) => {
  // copyFrom — registration → residence
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // fullName = lastName + firstName + middleName
  // Patch I: group-node subscription (`path.personalData`) — no `as never`,
  // values arrive as `{ personalData: PersonalData }`.
  computeFrom([path.personalData], path.fullName, (form) => {
    const data = form.personalData;
    return [data?.lastName ?? '', data?.firstName ?? '', data?.middleName ?? '']
      .filter(Boolean)
      .join(' ');
  });

  // age = years since birthDate
  computeFrom([path.personalData], path.age, (form) =>
    calcAge(form.personalData?.birthDate ?? ''),
  );

  // totalIncome = monthly + additional
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    (form) => (form.monthlyIncome ?? 0) + (form.additionalIncome ?? 0),
  );

  // initialPayment = 20% of propertyValue (mortgage only)
  computeFrom([path.propertyValue], path.initialPayment, (form) =>
    form.loanType === 'mortgage' && form.propertyValue
      ? Math.round(form.propertyValue * 0.2)
      : 0,
  );

  // interestRate — derived stub: base by loanType, –1pp if hasProperty
  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    (form) => {
      const base: Record<typeof form.loanType, number> = {
        consumer: 19.5,
        mortgage: 12.5,
        car: 14.0,
        business: 17.0,
        refinancing: 11.5,
      };
      const v = base[form.loanType] ?? 18;
      return form.hasProperty ? Math.max(v - 1, 5) : v;
    },
  );

  // monthlyPayment = annuity(loanAmount, loanTerm, interestRate)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (form) =>
      annuityMonthly(form.loanAmount ?? 0, form.loanTerm ?? 0, form.interestRate ?? 0),
  );

  // paymentToIncomeRatio = (monthlyPayment / totalIncome) * 100
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    (form) =>
      form.totalIncome > 0 ? Math.round((form.monthlyPayment / form.totalIncome) * 100) : 0,
  );

  // coBorrowersIncome = sum of coBorrowers[].monthlyIncome
  // Patch I: subscribe to the array group-node directly (no `as never`).
  computeFrom([path.coBorrowers], path.coBorrowersIncome, (form) => {
    const list = form.coBorrowers ?? [];
    return list.reduce<number>((sum, x) => sum + (x?.monthlyIncome ?? 0), 0);
  });
};

// ============================================================================
// Validation — STEP_VALIDATIONS + fullValidation
// ============================================================================

type V = import('@reformer/core').ValidationSchemaFn<CreditApplicationForm>;

const step1Validation: V = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимум 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимум 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLengthValidator(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLengthValidator(path.loanPurpose, 500, { message: 'Максимум 500 символов' });
};

const step2Validation: V = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.gender, { message: 'Выберите пол' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });
  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Укажите код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const step3Validation: V = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Некорректный формат email' });
  required(path.registrationAddress.region, { message: 'Укажите регион' });
  required(path.registrationAddress.city, { message: 'Укажите город' });
  required(path.registrationAddress.street, { message: 'Укажите улицу' });
  required(path.registrationAddress.house, { message: 'Укажите дом' });
  required(path.registrationAddress.postalCode, { message: 'Укажите индекс' });
};

const step4Validation: V = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });
  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });
};

const step5Validation: V = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Не может быть отрицательным' });
  max(path.dependents, 10, { message: 'Максимум 10' });
  required(path.education, { message: 'Укажите образование' });
};

const step6Validation: V = (path) => {
  required(path.agreePersonalData, {
    message: 'Необходимо согласие на обработку персональных данных',
  });
  required(path.agreeCreditHistory, {
    message: 'Необходимо согласие на проверку кредитной истории',
  });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями кредитования' });
  required(path.confirmAccuracy, { message: 'Необходимо подтвердить точность данных' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
};

export const STEP_VALIDATIONS: Record<number, V> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

const creditApplicationValidation: V = (path) => {
  apply(path, step1Validation);
  apply(path, step2Validation);
  apply(path, step3Validation);
  apply(path, step4Validation);
  apply(path, step5Validation);
  apply(path, step6Validation);
};

export { creditApplicationValidation };

// ============================================================================
// Factory
// ============================================================================

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  // Cast createForm to widen its config to `unknown` to avoid TS2589 from the
  // deep schema (per create-form prompt guidance for 4+ level nested forms).
  const factory = createForm as (config: {
    form: unknown;
    behavior: unknown;
    validation: unknown;
  }) => FormProxy<CreditApplicationForm>;

  return factory({
    form: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
  });
}
