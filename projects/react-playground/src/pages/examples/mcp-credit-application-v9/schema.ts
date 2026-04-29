/**
 * Schema, behavior, validation for MCP Credit Application v9 (target=core)
 *
 * Iter-9 patch verification:
 * - Patch H: ALL computed-field componentProps use `readOnly: true` (camelCase), NOT `readonly`.
 *            All HTML-attr-like props use camelCase: maxLength, autoFocus, htmlFor, tabIndex.
 * - Patch I: computeFrom that reads `form.personalData.<field>` subscribes to `[path.personalData]`
 *           (group node), NOT individual leaves. NO `as never` cast.
 * - D1: Every Select/RadioGroup has `options` in componentProps in this createForm schema.
 * - D3: FormArray.AddButton initialValue uses item factories returning plain primitives,
 *       NEVER FieldConfig objects.
 * - Patches J/K: target=core uses `form.X` directly (FieldNode), so neither apply here.
 * - Cycle prevention: every watchField has { immediate: false } and value-equality guards.
 */

import { createForm, type FormSchema, type FormProxy, type FieldPath } from '@reformer/core';
import {
  computeFrom,
  enableWhen,
  copyFrom,
  watchField,
  type BehaviorSchemaFn,
} from '@reformer/core/behaviors';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  pattern,
  applyWhen,
  apply,
  type ValidationSchemaFn,
} from '@reformer/core/validators';
import { Input, InputMask, Textarea, Select, RadioGroup, Checkbox } from '@reformer/ui-kit';

import type {
  CreditApplicationForm,
  PersonalData,
  PassportData,
  Address,
  PropertyItem,
  ExistingLoanItem,
  CoBorrowerItem,
} from './types';

// ============================================================================
// Constants — option lists (D1: every Select/RadioGroup gets `options`)
// ============================================================================

export const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Кредит для бизнеса' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Холост/не замужем' },
  { value: 'married', label: 'Женат/Замужем' },
  { value: 'divorced', label: 'Разведен(а)' },
  { value: 'widowed', label: 'Вдовец/Вдова' },
];

export const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Другое' },
];

export const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Супруг(а)' },
  { value: 'parent', label: 'Родитель' },
  { value: 'child', label: 'Ребенок' },
  { value: 'sibling', label: 'Брат/Сестра' },
  { value: 'relative', label: 'Другой родственник' },
  { value: 'other', label: 'Другое' },
];

export const EXISTING_LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'creditCard', label: 'Кредитная карта' },
  { value: 'other', label: 'Другое' },
];

// ============================================================================
// Sub-schemas (nested groups)
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
    componentProps: { label: 'Пол', options: GENDER_OPTIONS },
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
    componentProps: { label: 'Серия паспорта', placeholder: '00 00', mask: '99 99' },
  },
  number: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Номер паспорта', placeholder: '000000', mask: '999999' },
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
    componentProps: { label: 'Код подразделения', placeholder: '000-000', mask: '999-999' },
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

const propertyItemSchema: FormSchema<PropertyItem> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: PROPERTY_TYPE_OPTIONS,
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
    componentProps: { label: 'Оценочная стоимость', placeholder: '0', type: 'number', min: 0 },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
};

const existingLoanItemSchema: FormSchema<ExistingLoanItem> = {
  bank: {
    value: '',
    component: Input,
    componentProps: { label: 'Банк', placeholder: 'Название банка' },
  },
  type: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: EXISTING_LOAN_TYPE_OPTIONS,
    },
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

const coBorrowerItemSchema: FormSchema<CoBorrowerItem> = {
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
    value: 'spouse',
    component: Select,
    componentProps: {
      label: 'Родство',
      placeholder: 'Укажите родство',
      options: RELATIONSHIP_OPTIONS,
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', placeholder: '0', type: 'number', min: 0 },
  },
};

// ============================================================================
// Item factories (D3: plain primitive values, NOT FieldConfig)
// ============================================================================

export const createPropertyItem = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const createExistingLoanItem = (): ExistingLoanItem => ({
  bank: '',
  type: 'consumer',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const createCoBorrowerItem = (): CoBorrowerItem => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
  },
  phone: '',
  email: '',
  relationship: 'spouse',
  monthlyIncome: 0,
});

// ============================================================================
// Root form schema
// ============================================================================

const formSchema: FormSchema<CreditApplicationForm> = {
  // ----- Step 1: loan -----
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPE_OPTIONS,
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
      maxLength: 500, // Patch H: camelCase
    },
  },
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
      readOnly: true, // Patch H: camelCase
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
    componentProps: { label: 'Год выпуска', placeholder: '2020', type: 'number' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 300000,
      step: 10000,
    },
  },

  // ----- Step 2: personal -----
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
    componentProps: {
      label: 'СНИЛС',
      placeholder: '123-456-789 00',
      mask: '999-999-999 99',
    },
  },

  // ----- Step 3: contacts -----
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

  // ----- Step 4: employment -----
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUS_OPTIONS },
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
    componentProps: { label: 'ИНН ИП', placeholder: '123456789012', mask: '999999999999' },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3 },
  },

  // ----- Step 5: additional -----
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUS_OPTIONS },
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
      options: EDUCATION_OPTIONS,
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

  // ----- Step 6: confirmations -----
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
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456', mask: '999999' },
  },

  // ----- Computed (Patch H: readOnly camelCase) -----
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
    value: null,
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
// Compute helpers
// ============================================================================

/** Annuity formula: P * (i*(1+i)^n) / ((1+i)^n - 1). Rate is annual %. */
function annuityMonthly(amount: number, termMonths: number, annualRatePct: number): number {
  if (!amount || !termMonths || !annualRatePct) return 0;
  const i = annualRatePct / 100 / 12;
  const factor = Math.pow(1 + i, termMonths);
  return Math.round((amount * (i * factor)) / (factor - 1));
}

function ratePerLoanType(loanType: string): number {
  switch (loanType) {
    case 'mortgage':
      return 8.5;
    case 'car':
      return 11.0;
    case 'business':
      return 14.0;
    case 'refinancing':
      return 10.0;
    case 'consumer':
    default:
      return 15.0;
  }
}

function computeAge(birthDateIso: string): number | null {
  if (!birthDateIso) return null;
  const birth = new Date(birthDateIso);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

// ============================================================================
// Behavior schema
// ============================================================================

const behaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ---- enableWhen: mortgage-only fields ----
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // ---- enableWhen: car-only fields ----
  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

  // ---- enableWhen: employed-only fields ----
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

  // ---- enableWhen: selfEmployed-only fields ----
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });

  // ---- copyFrom: registrationAddress -> residenceAddress ----
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // ---- computeFrom: fullName from personalData group (Patch I — group node, no `as never`) ----
  computeFrom([path.personalData], path.fullName, ({ personalData }) => {
    const pd = personalData as PersonalData | undefined;
    if (!pd) return '';
    return [pd.lastName, pd.firstName, pd.middleName].filter(Boolean).join(' ').trim();
  });

  // ---- computeFrom: age from personalData group (Patch I) ----
  computeFrom([path.personalData], path.age, ({ personalData }) => {
    const pd = personalData as PersonalData | undefined;
    if (!pd?.birthDate) return null;
    return computeAge(pd.birthDate);
  });

  // ---- computeFrom: interestRate from loanType ----
  computeFrom([path.loanType], path.interestRate, ({ loanType }) =>
    ratePerLoanType(loanType as string)
  );

  // ---- computeFrom: monthlyPayment ----
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }) => {
      const a = (loanAmount as number | null) ?? 0;
      const t = (loanTerm as number | null) ?? 0;
      const r = (interestRate as number | null) ?? 0;
      return annuityMonthly(a, t, r);
    }
  );

  // ---- computeFrom: initialPayment = 20% of propertyValue ----
  computeFrom([path.propertyValue], path.initialPayment, ({ propertyValue }) => {
    const v = (propertyValue as number | null) ?? 0;
    if (!v) return null;
    return Math.round(v * 0.2);
  });

  // ---- computeFrom: totalIncome = monthlyIncome + additionalIncome ----
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }) => {
      const m = (monthlyIncome as number | null) ?? 0;
      const a = (additionalIncome as number | null) ?? 0;
      return m + a;
    }
  );

  // ---- computeFrom: paymentToIncomeRatio = (monthlyPayment / totalIncome) * 100 ----
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }) => {
      const p = (monthlyPayment as number | null) ?? 0;
      const t = (totalIncome as number | null) ?? 0;
      if (!t) return 0;
      return Math.round((p / t) * 100 * 10) / 10;
    }
  );

  // ---- computeFrom: coBorrowersIncome = sum of coBorrowers[].monthlyIncome ----
  computeFrom([path.coBorrowers], path.coBorrowersIncome, ({ coBorrowers }) => {
    const arr = (coBorrowers as CoBorrowerItem[] | undefined) ?? [];
    return arr.reduce((sum, c) => sum + (c?.monthlyIncome ?? 0), 0);
  });

  // ---- watchField: clear arrays when flag flips false (immediate:false + length-guard) ----
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        const cur = ctx.form.properties.getValue();
        if (Array.isArray(cur) && cur.length > 0) {
          ctx.form.properties.clear();
        }
      }
    },
    { immediate: false }
  );

  watchField(
    path.hasExistingLoans,
    (hasLoans, ctx) => {
      if (!hasLoans) {
        const cur = ctx.form.existingLoans.getValue();
        if (Array.isArray(cur) && cur.length > 0) {
          ctx.form.existingLoans.clear();
        }
      }
    },
    { immediate: false }
  );

  watchField(
    path.hasCoBorrower,
    (hasCoBorrower, ctx) => {
      if (!hasCoBorrower) {
        const cur = ctx.form.coBorrowers.getValue();
        if (Array.isArray(cur) && cur.length > 0) {
          ctx.form.coBorrowers.clear();
        }
      }
    },
    { immediate: false }
  );
};

// ============================================================================
// Validation schemas — per step + full
// ============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок: 240 месяцев' });

  applyWhen(
    path.loanType,
    (type) => type !== 'mortgage' && type !== 'car',
    (p) => {
      required(p.loanPurpose, { message: 'Укажите цель кредита' });
      minLength(p.loanPurpose, 10, { message: 'Минимум 10 символов' });
      maxLength(p.loanPurpose, 500, { message: 'Максимум 500 символов' });
    }
  );

  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' });
    }
  );

  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (p) => {
      required(p.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(p.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(p.carBrand, 50, { message: 'Максимум 50 символов' });
      required(p.carModel, { message: 'Укажите модель' });
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

const personalDataValidation: ValidationSchemaFn<PersonalData> = (path) => {
  required(path.lastName, { message: 'Введите фамилию' });
  required(path.firstName, { message: 'Введите имя' });
  required(path.middleName, { message: 'Введите отчество' });
  required(path.birthDate, { message: 'Укажите дату рождения' });
  required(path.gender, { message: 'Укажите пол' });
  required(path.birthPlace, { message: 'Введите место рождения' });
};

const passportDataValidation: ValidationSchemaFn<PassportData> = (path) => {
  required(path.series, { message: 'Введите серию паспорта' });
  required(path.number, { message: 'Введите номер паспорта' });
  required(path.issueDate, { message: 'Укажите дату выдачи' });
  required(path.issuedBy, { message: 'Укажите кем выдан' });
  required(path.departmentCode, { message: 'Укажите код подразделения' });
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path.personalData, personalDataValidation);
  apply(path.passportData, passportDataValidation);
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.region, { message: 'Введите регион' });
  required(path.city, { message: 'Введите город' });
  required(path.street, { message: 'Введите улицу' });
  required(path.house, { message: 'Введите номер дома' });
  required(path.postalCode, { message: 'Введите индекс' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Введите корректный email' });
  apply(path.registrationAddress, addressValidation);

  applyWhen(
    path.sameAsRegistration,
    (same) => same === false,
    (p) => {
      apply(p.residenceAddress, addressValidation);
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });
  required(path.workExperienceTotal, { message: 'Укажите общий стаж работы' });
  min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });

  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (p) => {
      required(p.companyName, { message: 'Укажите название компании' });
      required(p.companyInn, { message: 'Укажите ИНН компании' });
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
      required(p.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Минимум 0' });
  max(path.dependents, 10, { message: 'Максимум 10' });
  required(path.education, { message: 'Выберите уровень образования' });
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, {
    message: 'Согласие на обработку персональных данных обязательно',
  });
  required(path.agreeCreditHistory, {
    message: 'Согласие на проверку кредитной истории обязательно',
  });
  required(path.agreeTerms, { message: 'Согласие с условиями кредитования обязательно' });
  required(path.confirmAccuracy, { message: 'Подтверждение точности данных обязательно' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  minLength(path.electronicSignature, 6, { message: 'Код должен содержать 6 символов' });
  maxLength(path.electronicSignature, 6, { message: 'Код должен содержать 6 символов' });
  pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код должен содержать только цифры' });
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

export const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// ============================================================================
// Form factory
// ============================================================================

export const createCreditApplicationForm = (): FormProxy<CreditApplicationForm> => {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    behavior: behaviorSchema,
    validation: fullValidation,
  });
};
