// MCP-only sandbox iter-12 / renderer-react.
// All construction backed by MCP `find_recipe`/`get_symbol_docs` outputs in
// .tmp/iter-artifacts/iter-12/renderer-react/discovery.md.
/* eslint-disable react-refresh/only-export-components */

import {
  createForm,
  type FormProxy,
  type FormSchema,
  type FieldConfig,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  email,
  minLength,
  maxLength,
  applyWhen,
  validate,
  validateItems,
} from '@reformer/core/validators';
import { computeFrom, copyFrom } from '@reformer/core/behaviors';
import {
  Box,
  Section,
  Input,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
} from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import {
  createRenderSchema,
  type RenderSchemaFn,
  type RenderNode,
} from '@reformer/renderer-react';

// ─── Domain types (Recipe 2: type, NOT interface) ──────────────────────────

type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
type Gender = 'male' | 'female';
type EmploymentStatus =
  | 'employed'
  | 'selfEmployed'
  | 'unemployed'
  | 'retired'
  | 'student';
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
type PropertyType = 'apartment' | 'house' | 'land' | 'car';

type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
};

type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

type Address = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

type PropertyItem = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
};

type ExistingLoan = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

type CoBorrower = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

export type CreditApplicationForm = {
  // Step 1 — loan
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null;
  initialPayment: number | null;
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;
  // Step 2 — personal
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  // Step 3 — contacts
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
  // Step 4 — employment
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;
  // Step 5 — additional
  maritalStatus: MaritalStatus;
  dependents: number;
  education: Education;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
  // Step 6 — agreements
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
  // computed
  fullName: string;
  age: number | null;
  totalIncome: number | null;
  monthlyPayment: number | null;
  interestRate: number | null;
};

// ─── Options for selects/radios ────────────────────────────────────────────

const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];
const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];
const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];
const MARITAL_OPTIONS = [
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];
const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Учёная степень' },
];
const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'car', label: 'Автомобиль' },
];

// ─── Form schema (Recipe 8: satisfies FieldConfig<UnionType> for unions) ───

const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPE_OPTIONS,
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: '0' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (мес.)', type: 'number', placeholder: '12' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      maxLength: 500,
      rows: 3,
    },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости (₽)', type: 'number', placeholder: '0' },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос (₽, авто)', type: 'number', disabled: true },
  },
  carBrand: {
    value: '',
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Toyota' },
  },
  carModel: {
    value: '',
    component: Input,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Camry' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость автомобиля (₽)', type: 'number', placeholder: '0' },
  },
  // Step 2
  personalData: {
    lastName: { value: '', component: Input, componentProps: { label: 'Фамилия', placeholder: 'Иванов' } },
    firstName: { value: '', component: Input, componentProps: { label: 'Имя', placeholder: 'Иван' } },
    middleName: { value: '', component: Input, componentProps: { label: 'Отчество', placeholder: 'Иванович' } },
    birthDate: { value: '', component: Input, componentProps: { label: 'Дата рождения', type: 'date' } },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { label: 'Пол', options: GENDER_OPTIONS, className: '!flex-row gap-6' },
    } satisfies FieldConfig<Gender>,
    birthPlace: { value: '', component: Input, componentProps: { label: 'Место рождения', placeholder: 'г. Москва' } },
  },
  passportData: {
    series: { value: '', component: Input, componentProps: { label: 'Серия паспорта', placeholder: '12 34', maxLength: 5 } },
    number: { value: '', component: Input, componentProps: { label: 'Номер паспорта', placeholder: '123456', maxLength: 6 } },
    issueDate: { value: '', component: Input, componentProps: { label: 'Дата выдачи', type: 'date' } },
    issuedBy: { value: '', component: Input, componentProps: { label: 'Кем выдан', placeholder: 'ОВД ...' } },
    departmentCode: { value: '', component: Input, componentProps: { label: 'Код подразделения', placeholder: '123-456', maxLength: 7 } },
  },
  inn: { value: '', component: Input, componentProps: { label: 'ИНН', placeholder: '123456789012', maxLength: 12 } },
  snils: { value: '', component: Input, componentProps: { label: 'СНИЛС', placeholder: '123-456-789 00', maxLength: 14 } },
  // Step 3
  phoneMain: { value: '', component: Input, componentProps: { label: 'Основной телефон', placeholder: '+7 (___) ___-__-__' } },
  phoneAdditional: { value: '', component: Input, componentProps: { label: 'Дополнительный телефон', placeholder: '+7 (___) ___-__-__' } },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' } },
  emailAdditional: { value: '', component: Input, componentProps: { label: 'Дополнительный email', type: 'email' } },
  registrationAddress: {
    region: { value: '', component: Input, componentProps: { label: 'Регион', placeholder: 'Москва' } },
    city: { value: '', component: Input, componentProps: { label: 'Город', placeholder: 'Москва' } },
    street: { value: '', component: Input, componentProps: { label: 'Улица', placeholder: 'Тверская' } },
    house: { value: '', component: Input, componentProps: { label: 'Дом', placeholder: '1' } },
    apartment: { value: '', component: Input, componentProps: { label: 'Квартира', placeholder: '1' } },
    postalCode: { value: '', component: Input, componentProps: { label: 'Индекс', placeholder: '000000', maxLength: 6 } },
  },
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: {
    region: { value: '', component: Input, componentProps: { label: 'Регион' } },
    city: { value: '', component: Input, componentProps: { label: 'Город' } },
    street: { value: '', component: Input, componentProps: { label: 'Улица' } },
    house: { value: '', component: Input, componentProps: { label: 'Дом' } },
    apartment: { value: '', component: Input, componentProps: { label: 'Квартира' } },
    postalCode: { value: '', component: Input, componentProps: { label: 'Индекс', maxLength: 6 } },
  },
  // Step 4
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_OPTIONS },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: { value: '', component: Input, componentProps: { label: 'Название компании', placeholder: 'ООО "Ромашка"' } },
  companyInn: { value: '', component: Input, componentProps: { label: 'ИНН компании', placeholder: '1234567890', maxLength: 10 } },
  companyPhone: { value: '', component: Input, componentProps: { label: 'Телефон компании', placeholder: '+7 (___) ___-__-__' } },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Адрес компании' } },
  position: { value: '', component: Input, componentProps: { label: 'Должность', placeholder: 'Менеджер' } },
  workExperienceTotal: { value: null, component: Input, componentProps: { label: 'Общий стаж работы (мес.)', type: 'number' } },
  workExperienceCurrent: { value: null, component: Input, componentProps: { label: 'Стаж на текущем месте (мес.)', type: 'number' } },
  monthlyIncome: { value: null, component: Input, componentProps: { label: 'Ежемесячный доход (₽)', type: 'number' } },
  additionalIncome: { value: null, component: Input, componentProps: { label: 'Дополнительный доход (₽)', type: 'number' } },
  additionalIncomeSource: { value: '', component: Input, componentProps: { label: 'Источник доп. дохода' } },
  businessType: { value: '', component: Input, componentProps: { label: 'Тип бизнеса', placeholder: 'ИП / ООО' } },
  businessInn: { value: '', component: Input, componentProps: { label: 'ИНН ИП', placeholder: '123456789012', maxLength: 12 } },
  businessActivity: { value: '', component: Textarea, componentProps: { label: 'Вид деятельности', rows: 3 } },
  // Step 5
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_OPTIONS },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: { value: 0, component: Input, componentProps: { label: 'Количество иждивенцев', type: 'number' } },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень',
      options: EDUCATION_OPTIONS,
    },
  } satisfies FieldConfig<Education>,
  hasProperty: { value: false, component: Checkbox, componentProps: { label: 'У меня есть имущество' } },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: { label: 'Тип имущества', options: PROPERTY_TYPE_OPTIONS },
      } satisfies FieldConfig<PropertyType>,
      description: { value: '', component: Textarea, componentProps: { label: 'Описание', rows: 2 } },
      estimatedValue: { value: 0, component: Input, componentProps: { label: 'Оценочная стоимость (₽)', type: 'number' } },
      hasEncumbrance: { value: false, component: Checkbox, componentProps: { label: 'Имеется обременение (залог)' } },
    },
  ],
  hasExistingLoans: { value: false, component: Checkbox, componentProps: { label: 'У меня есть другие кредиты' } },
  existingLoans: [
    {
      bank: { value: '', component: Input, componentProps: { label: 'Банк' } },
      type: { value: '', component: Input, componentProps: { label: 'Тип кредита' } },
      amount: { value: 0, component: Input, componentProps: { label: 'Сумма кредита (₽)', type: 'number' } },
      remainingAmount: { value: 0, component: Input, componentProps: { label: 'Остаток задолженности (₽)', type: 'number' } },
      monthlyPayment: { value: 0, component: Input, componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number' } },
      maturityDate: { value: '', component: Input, componentProps: { label: 'Дата погашения', type: 'date' } },
    },
  ],
  hasCoBorrower: { value: false, component: Checkbox, componentProps: { label: 'Добавить созаёмщика' } },
  coBorrowers: [
    {
      firstName: { value: '', component: Input, componentProps: { label: 'Имя' } },
      lastName: { value: '', component: Input, componentProps: { label: 'Фамилия' } },
      phone: { value: '', component: Input, componentProps: { label: 'Телефон', placeholder: '+7 (___) ___-__-__' } },
      email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
      relationship: { value: '', component: Input, componentProps: { label: 'Родство' } },
      monthlyIncome: { value: 0, component: Input, componentProps: { label: 'Ежемесячный доход (₽)', type: 'number' } },
    },
  ],
  // Step 6
  agreePersonalData: { value: false, component: Checkbox, componentProps: { label: 'Согласие на обработку персональных данных' } },
  agreeCreditHistory: { value: false, component: Checkbox, componentProps: { label: 'Согласие на проверку кредитной истории' } },
  agreeMarketing: { value: false, component: Checkbox, componentProps: { label: 'Согласие на маркетинговые материалы' } },
  agreeTerms: { value: false, component: Checkbox, componentProps: { label: 'Согласен с условиями кредитования' } },
  confirmAccuracy: { value: false, component: Checkbox, componentProps: { label: 'Подтверждаю точность данных' } },
  electronicSignature: { value: '', component: Input, componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456', maxLength: 6 } },
  // Computed (read-only)
  fullName: { value: '', component: Input, componentProps: { label: 'Полное имя', disabled: true } },
  age: { value: null, component: Input, componentProps: { label: 'Возраст (лет)', type: 'number', disabled: true } },
  totalIncome: { value: null, component: Input, componentProps: { label: 'Общий доход (₽)', type: 'number', disabled: true } },
  monthlyPayment: { value: null, component: Input, componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number', disabled: true } },
  interestRate: { value: null, component: Input, componentProps: { label: 'Процентная ставка (%)', type: 'number', disabled: true } },
};

// ─── Validation: per-step + full ───────────────────────────────────────────

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму' });
  min(path.loanAmount, 50000, { message: 'Минимум 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимум 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок' });
  min(path.loanTerm, 6);
  max(path.loanTerm, 240);
  required(path.loanPurpose, { message: 'Опишите цель' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500);

  applyWhen(
    path.loanType,
    (v) => v === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1000000);
    }
  );
  applyWhen(
    path.loanType,
    (v) => v === 'car',
    (p) => {
      required(p.carBrand, { message: 'Введите марку' });
      required(p.carModel, { message: 'Введите модель' });
      required(p.carYear, { message: 'Введите год' });
      min(p.carYear, 2000);
      max(p.carYear, new Date().getFullYear() + 1);
      required(p.carPrice, { message: 'Введите стоимость' });
      min(p.carPrice, 300000);
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Введите дату рождения' });
  required(path.personalData.birthPlace, { message: 'Введите место рождения' });
  required(path.passportData.series, { message: 'Введите серию' });
  required(path.passportData.number, { message: 'Введите номер' });
  required(path.passportData.issueDate, { message: 'Введите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Кем выдан?' });
  required(path.passportData.departmentCode, { message: 'Код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Некорректный email' });
  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите дом' });
  required(path.registrationAddress.postalCode, { message: 'Введите индекс' });
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус' });
  required(path.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Введите стаж' });
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Введите доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });

  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value;
    if (total != null && value != null && value > total) {
      return { code: 'experience-mismatch', message: 'Стаж на текущем месте не может превышать общий' };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (v) => v === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      required(p.position, { message: 'Введите должность' });
    }
  );
  applyWhen(
    path.employmentStatus,
    (v) => v === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Введите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН ИП' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Выберите положение' });
  required(path.dependents, { message: 'Введите количество' });
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education, { message: 'Выберите образование' });

  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (itemPath) => {
        required(itemPath.type);
        required(itemPath.description);
        min(itemPath.estimatedValue, 0);
      });
    }
  );
  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (itemPath) => {
        required(itemPath.bank);
        required(itemPath.type);
        min(itemPath.amount, 0);
      });
    }
  );
  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, (itemPath) => {
        required(itemPath.firstName);
        required(itemPath.lastName);
        required(itemPath.phone);
        required(itemPath.email);
        email(itemPath.email);
      });
    }
  );
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.agreePersonalData, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' }
  );
  validate(path.agreeTerms, (v) =>
    v === true ? null : { code: 'must-agree', message: 'Необходимо согласие' }
  );
  validate(path.confirmAccuracy, (v) =>
    v === true ? null : { code: 'must-confirm', message: 'Подтвердите точность' }
  );
  required(path.electronicSignature, { message: 'Введите код' });
  minLength(path.electronicSignature, 6, { message: '6 цифр' });
};

export const STEP_VALIDATIONS = {
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

// ─── Behavior: computed fields + copy-from ─────────────────────────────────

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 fullName
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  // C.5 age
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => {
      if (!personalData.birthDate) return null;
      const birth = new Date(personalData.birthDate);
      if (Number.isNaN(birth.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return age;
    }
  );

  // C.6 totalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.3 initialPayment (mortgage only — 20% of propertyValue)
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue != null ? Math.round(propertyValue * 0.2) : null,
    { condition: (form) => form.loanType === 'mortgage' }
  );

  // C.1 interestRate (simplified — varies by loan type)
  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    ({ loanType, hasProperty }: CreditApplicationForm) => {
      const base: Record<LoanType, number> = {
        consumer: 18,
        mortgage: 9,
        car: 12,
        business: 14,
        refinance: 11,
      };
      let rate = base[loanType] ?? 15;
      if (hasProperty) rate -= 1;
      return rate;
    }
  );

  // C.2 monthlyPayment (annuity formula)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) => {
      const P = loanAmount ?? 0;
      const n = loanTerm ?? 0;
      const r = (interestRate ?? 0) / 100 / 12;
      if (P <= 0 || n <= 0 || r <= 0) return 0;
      return Math.round((P * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1));
    },
    { debounce: 200 }
  );

  // copy registrationAddress → residenceAddress when sameAsRegistration
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });
};

// ─── Form factory ──────────────────────────────────────────────────────────

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}

// ─── Render schema (wizard with FormWizard from ui-kit) ────────────────────

import { FormWizard } from '@reformer/ui-kit/form-wizard';

const propertyTwoCol = (children: RenderNode<CreditApplicationForm>[]) => ({
  component: Box,
  componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
  children,
});

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: (values: CreditApplicationForm) => Promise<void> | void
) {
  const renderSchemaFn: RenderSchemaFn<CreditApplicationForm> = (path) => ({
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      form,
      config: {
        stepValidations: STEP_VALIDATIONS,
        fullValidation,
      },
      onSubmit,
      steps: [
        {
          number: 1,
          title: 'Кредит',
          icon: '💰',
          body: {
            selector: 'step-1',
            component: Section,
            componentProps: { title: 'Параметры кредита', className: 'space-y-4' },
            children: [
              { component: path.loanType, componentProps: { testId: 'loanType' } },
              propertyTwoCol([
                { component: path.loanAmount, componentProps: { testId: 'loanAmount' } },
                { component: path.loanTerm, componentProps: { testId: 'loanTerm' } },
              ]),
              { component: path.loanPurpose, componentProps: { testId: 'loanPurpose' } },
              {
                selector: 'mortgage-section',
                component: Section,
                componentProps: { title: 'Ипотека', className: 'space-y-3' },
                children: [
                  { component: path.propertyValue, componentProps: { testId: 'propertyValue' } },
                  { component: path.initialPayment, componentProps: { testId: 'initialPayment' } },
                ],
              },
              {
                selector: 'car-section',
                component: Section,
                componentProps: { title: 'Автокредит', className: 'space-y-3' },
                children: [
                  propertyTwoCol([
                    { component: path.carBrand, componentProps: { testId: 'carBrand' } },
                    { component: path.carModel, componentProps: { testId: 'carModel' } },
                  ]),
                  propertyTwoCol([
                    { component: path.carYear, componentProps: { testId: 'carYear' } },
                    { component: path.carPrice, componentProps: { testId: 'carPrice' } },
                  ]),
                ],
              },
              {
                selector: 'computed-summary',
                component: Section,
                componentProps: { title: 'Расчёт', className: 'space-y-3 bg-blue-50 p-4 rounded' },
                children: [
                  propertyTwoCol([
                    { component: path.interestRate, componentProps: { testId: 'interestRate' } },
                    { component: path.monthlyPayment, componentProps: { testId: 'monthlyPayment' } },
                  ]),
                ],
              },
            ],
          },
        },
        {
          number: 2,
          title: 'Личные данные',
          icon: '👤',
          body: {
            selector: 'step-2',
            component: Section,
            componentProps: { title: 'Персональная информация', className: 'space-y-4' },
            children: [
              propertyTwoCol([
                { component: path.personalData.lastName, componentProps: { testId: 'lastName' } },
                { component: path.personalData.firstName, componentProps: { testId: 'firstName' } },
              ]),
              propertyTwoCol([
                { component: path.personalData.middleName, componentProps: { testId: 'middleName' } },
                { component: path.personalData.birthDate, componentProps: { testId: 'birthDate' } },
              ]),
              { component: path.personalData.gender, componentProps: { testId: 'gender' } },
              { component: path.personalData.birthPlace, componentProps: { testId: 'birthPlace' } },
              { component: path.fullName, componentProps: { testId: 'fullName' } },
              { component: path.age, componentProps: { testId: 'age' } },
              {
                selector: 'passport-section',
                component: Section,
                componentProps: { title: 'Паспортные данные', className: 'space-y-3' },
                children: [
                  propertyTwoCol([
                    { component: path.passportData.series, componentProps: { testId: 'passportSeries' } },
                    { component: path.passportData.number, componentProps: { testId: 'passportNumber' } },
                  ]),
                  propertyTwoCol([
                    { component: path.passportData.issueDate, componentProps: { testId: 'issueDate' } },
                    { component: path.passportData.departmentCode, componentProps: { testId: 'departmentCode' } },
                  ]),
                  { component: path.passportData.issuedBy, componentProps: { testId: 'issuedBy' } },
                ],
              },
              propertyTwoCol([
                { component: path.inn, componentProps: { testId: 'inn' } },
                { component: path.snils, componentProps: { testId: 'snils' } },
              ]),
            ],
          },
        },
        {
          number: 3,
          title: 'Контакты',
          icon: '📞',
          body: {
            selector: 'step-3',
            component: Section,
            componentProps: { title: 'Контактная информация', className: 'space-y-4' },
            children: [
              propertyTwoCol([
                { component: path.phoneMain, componentProps: { testId: 'phoneMain' } },
                { component: path.phoneAdditional, componentProps: { testId: 'phoneAdditional' } },
              ]),
              propertyTwoCol([
                { component: path.email, componentProps: { testId: 'email' } },
                { component: path.emailAdditional, componentProps: { testId: 'emailAdditional' } },
              ]),
              {
                selector: 'reg-address',
                component: Section,
                componentProps: { title: 'Адрес регистрации', className: 'space-y-3' },
                children: [
                  propertyTwoCol([
                    { component: path.registrationAddress.region, componentProps: { testId: 'regRegion' } },
                    { component: path.registrationAddress.city, componentProps: { testId: 'regCity' } },
                  ]),
                  propertyTwoCol([
                    { component: path.registrationAddress.street, componentProps: { testId: 'regStreet' } },
                    { component: path.registrationAddress.house, componentProps: { testId: 'regHouse' } },
                  ]),
                  propertyTwoCol([
                    { component: path.registrationAddress.apartment, componentProps: { testId: 'regApartment' } },
                    { component: path.registrationAddress.postalCode, componentProps: { testId: 'regPostalCode' } },
                  ]),
                ],
              },
              { component: path.sameAsRegistration, componentProps: { testId: 'sameAsRegistration' } },
            ],
          },
        },
        {
          number: 4,
          title: 'Работа',
          icon: '💼',
          body: {
            selector: 'step-4',
            component: Section,
            componentProps: { title: 'Информация о занятости', className: 'space-y-4' },
            children: [
              { component: path.employmentStatus, componentProps: { testId: 'employmentStatus' } },
              {
                selector: 'employed-section',
                component: Section,
                componentProps: { title: 'Работа по найму', className: 'space-y-3' },
                children: [
                  { component: path.companyName, componentProps: { testId: 'companyName' } },
                  propertyTwoCol([
                    { component: path.companyInn, componentProps: { testId: 'companyInn' } },
                    { component: path.companyPhone, componentProps: { testId: 'companyPhone' } },
                  ]),
                  { component: path.companyAddress, componentProps: { testId: 'companyAddress' } },
                  { component: path.position, componentProps: { testId: 'position' } },
                ],
              },
              propertyTwoCol([
                { component: path.workExperienceTotal, componentProps: { testId: 'workExperienceTotal' } },
                { component: path.workExperienceCurrent, componentProps: { testId: 'workExperienceCurrent' } },
              ]),
              propertyTwoCol([
                { component: path.monthlyIncome, componentProps: { testId: 'monthlyIncome' } },
                { component: path.additionalIncome, componentProps: { testId: 'additionalIncome' } },
              ]),
              { component: path.additionalIncomeSource, componentProps: { testId: 'additionalIncomeSource' } },
              { component: path.totalIncome, componentProps: { testId: 'totalIncome' } },
            ],
          },
        },
        {
          number: 5,
          title: 'Дополнительно',
          icon: '📋',
          body: {
            selector: 'step-5',
            component: Section,
            componentProps: { title: 'Дополнительная информация', className: 'space-y-4' },
            children: [
              { component: path.maritalStatus, componentProps: { testId: 'maritalStatus' } },
              propertyTwoCol([
                { component: path.dependents, componentProps: { testId: 'dependents' } },
                { component: path.education, componentProps: { testId: 'education' } },
              ]),
              { component: path.hasProperty, componentProps: { testId: 'hasProperty' } },
              {
                selector: 'properties-section',
                component: FormArraySection,
                componentProps: {
                  control: path.properties,
                  itemComponent: PropertyItemForm,
                  title: 'Имущество',
                  addButtonLabel: '+ Добавить имущество',
                  emptyMessage: 'Нажмите кнопку чтобы добавить запись',
                  initialValue: { type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false },
                },
              },
              { component: path.hasExistingLoans, componentProps: { testId: 'hasExistingLoans' } },
              {
                selector: 'loans-section',
                component: FormArraySection,
                componentProps: {
                  control: path.existingLoans,
                  itemComponent: ExistingLoanForm,
                  title: 'Существующие кредиты',
                  addButtonLabel: '+ Добавить кредит',
                  initialValue: { bank: '', type: '', amount: 0, remainingAmount: 0, monthlyPayment: 0, maturityDate: '' },
                },
              },
              { component: path.hasCoBorrower, componentProps: { testId: 'hasCoBorrower' } },
              {
                selector: 'co-borrowers-section',
                component: FormArraySection,
                componentProps: {
                  control: path.coBorrowers,
                  itemComponent: CoBorrowerForm,
                  title: 'Созаёмщики',
                  addButtonLabel: '+ Добавить созаёмщика',
                  initialValue: { firstName: '', lastName: '', phone: '', email: '', relationship: '', monthlyIncome: 0 },
                },
              },
            ],
          },
        },
        {
          number: 6,
          title: 'Подтверждение',
          icon: '✓',
          body: {
            selector: 'step-6',
            component: Section,
            componentProps: { title: 'Согласия и подтверждение', className: 'space-y-3' },
            children: [
              { component: path.agreePersonalData, componentProps: { testId: 'agreePersonalData' } },
              { component: path.agreeCreditHistory, componentProps: { testId: 'agreeCreditHistory' } },
              { component: path.agreeMarketing, componentProps: { testId: 'agreeMarketing' } },
              { component: path.agreeTerms, componentProps: { testId: 'agreeTerms' } },
              { component: path.confirmAccuracy, componentProps: { testId: 'confirmAccuracy' } },
              { component: path.electronicSignature, componentProps: { testId: 'electronicSignature' } },
            ],
          },
        },
      ],
    },
  });

  return createRenderSchema<CreditApplicationForm>(renderSchemaFn);
}

// ─── Item components for FormArraySection ──────────────────────────────────

import { FormField } from '@reformer/ui-kit';

function PropertyItemForm({ control }: { control: FormProxy<PropertyItem> }) {
  return (
    <div className="space-y-2">
      <FormField control={control.type} testId="property-type" />
      <FormField control={control.description} testId="property-description" />
      <FormField control={control.estimatedValue} testId="property-value" />
      <FormField control={control.hasEncumbrance} testId="property-encumbrance" />
    </div>
  );
}

function ExistingLoanForm({ control }: { control: FormProxy<ExistingLoan> }) {
  return (
    <div className="space-y-2">
      <FormField control={control.bank} testId="loan-bank" />
      <FormField control={control.type} testId="loan-type" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField control={control.amount} testId="loan-amount" />
        <FormField control={control.remainingAmount} testId="loan-remaining" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField control={control.monthlyPayment} testId="loan-monthly" />
        <FormField control={control.maturityDate} testId="loan-maturity" />
      </div>
    </div>
  );
}

function CoBorrowerForm({ control }: { control: FormProxy<CoBorrower> }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <FormField control={control.firstName} testId="cb-first" />
        <FormField control={control.lastName} testId="cb-last" />
      </div>
      <FormField control={control.phone} testId="cb-phone" />
      <FormField control={control.email} testId="cb-email" />
      <FormField control={control.relationship} testId="cb-relationship" />
      <FormField control={control.monthlyIncome} testId="cb-income" />
    </div>
  );
}
