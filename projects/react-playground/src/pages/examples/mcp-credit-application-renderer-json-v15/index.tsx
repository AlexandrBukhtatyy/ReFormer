/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createForm,
  useFormControlValue,
  type FieldConfig,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  email as emailValidator,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  applyWhen,
  validate,
  validateItems,
} from '@reformer/core/validators';
import { computeFrom, watchField, copyFrom } from '@reformer/core/behaviors';
import {
  Box,
  Button,
  Checkbox,
  FormField,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import {
  FIELD_WRAPPER,
  JsonRendererProvider,
  createRenderSchemaFromJson,
  defineRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';

import jsonSchema from './schema.json';

// ============================================================================
// Types
// ============================================================================

type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
type Gender = 'male' | 'female';
type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
type PropertyType = 'apartment' | 'house' | 'land' | 'commercial';

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

type ExistingLoanItem = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

type CoBorrowerItem = {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

export type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  propertyValue: number | null;
  initialPayment: number | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;
  // Step 2
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  // Step 3
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
  // Step 4
  employmentStatus: EmploymentStatus;
  companyName: string | null;
  companyInn: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  position: string | null;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string | null;
  businessType: string | null;
  businessInn: string | null;
  businessActivity: string | null;
  // Step 5
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];
  // Step 6
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
  // Computed
  fullName: string;
  age: number;
  interestRate: number;
  monthlyPayment: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

// ============================================================================
// Options & sources
// ============================================================================

const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Самозанятый/ИП' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUSES = [
  { value: 'single', label: 'Холост/не замужем' },
  { value: 'married', label: 'Женат/замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец/вдова' },
];

const EDUCATION_LEVELS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
];

const CITIES_DEFAULT = [
  { value: 'moscow', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
];

// Plain-leaf factories for FormArraySection initialValue
const propertyTemplate = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

const existingLoanTemplate = (): ExistingLoanItem => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

const coBorrowerTemplate = (): CoBorrowerItem => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

// ============================================================================
// Computed helpers
// ============================================================================

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
  return Math.max(0, years);
}

function annuity(amount: number, term: number, rate: number): number {
  if (!amount || !term || !rate) return 0;
  const i = rate / 100 / 12;
  const n = term;
  const numerator = amount * i * Math.pow(1 + i, n);
  const denominator = Math.pow(1 + i, n) - 1;
  if (denominator === 0) return 0;
  return Math.round(numerator / denominator);
}

function getInterestRate(loanType: LoanType, hasProperty: boolean): number {
  const base: Record<LoanType, number> = {
    consumer: 14.5,
    mortgage: 9.5,
    car: 11.5,
    business: 13.5,
    refinance: 12.5,
  };
  let rate = base[loanType] ?? 13;
  if (hasProperty) rate -= 0.5;
  return rate;
}

// Async mocks
async function checkEmailUnique(value: string): Promise<{ code: string; message: string } | null> {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 300));
  const banned = ['taken@example.com', 'used@mail.com'];
  if (banned.includes(value.toLowerCase())) {
    return { code: 'email-taken', message: 'Email уже зарегистрирован' };
  }
  return null;
}

async function fetchCitiesByRegion(
  region: string
): Promise<Array<{ value: string; label: string }>> {
  await new Promise((r) => setTimeout(r, 200));
  if (!region) return [];
  const lower = region.toLowerCase();
  if (lower.includes('моск')) {
    return [
      { value: 'moscow', label: 'Москва' },
      { value: 'zelenograd', label: 'Зеленоград' },
    ];
  }
  if (lower.includes('петер') || lower.includes('лен')) {
    return [
      { value: 'spb', label: 'Санкт-Петербург' },
      { value: 'gatchina', label: 'Гатчина' },
    ];
  }
  return [
    { value: 'city-1', label: `Главный город (${region})` },
    { value: 'city-2', label: `Другой город (${region})` },
  ];
}

async function fetchCarModels(brand: string): Promise<Array<{ value: string; label: string }>> {
  await new Promise((r) => setTimeout(r, 200));
  if (!brand) return [];
  return [
    { value: `${brand}-model-a`, label: `${brand} Model A` },
    { value: `${brand}-model-b`, label: `${brand} Model B` },
  ];
}

// ============================================================================
// createForm — schema literal extracted as typed local (Recipe 5 from common-mistakes)
// ============================================================================

const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
      testId: 'loanType',
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', testId: 'loanAmount' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', testId: 'loanTerm' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', rows: 3, testId: 'loanPurpose' },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      type: 'number',
      testId: 'propertyValue',
    },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      type: 'number',
      readOnly: true,
      testId: 'initialPayment',
    },
  },
  carBrand: {
    value: null,
    component: Input,
    componentProps: { label: 'Марка автомобиля', testId: 'carBrand' },
  },
  carModel: {
    value: null,
    component: Input,
    componentProps: { label: 'Модель автомобиля', testId: 'carModel' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', testId: 'carYear' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость автомобиля (₽)', type: 'number', testId: 'carPrice' },
  },
  // Step 2 — personalData
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', testId: 'lastName' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', testId: 'firstName' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', testId: 'middleName' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date', testId: 'birthDate' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { label: 'Пол', options: GENDERS, testId: 'gender' },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', testId: 'birthPlace' },
    },
  },
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Серия паспорта', mask: '99 99', testId: 'passportSeries' },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Номер паспорта', mask: '999999', testId: 'passportNumber' },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата выдачи', type: 'date', testId: 'passportIssueDate' },
    },
    issuedBy: {
      value: '',
      component: Input,
      componentProps: { label: 'Кем выдан', testId: 'passportIssuedBy' },
    },
    departmentCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Код подразделения',
        mask: '999-999',
        testId: 'passportDepartmentCode',
      },
    },
  },
  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', mask: '999999999999', testId: 'inn' },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: { label: 'СНИЛС', mask: '999-999-999 99', testId: 'snils' },
  },
  // Step 3
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      mask: '+7 (999) 999-99-99',
      testId: 'phoneMain',
    },
  },
  phoneAdditional: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      mask: '+7 (999) 999-99-99',
      testId: 'phoneAdditional',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', testId: 'email' },
    asyncValidators: [checkEmailUnique],
    debounce: 500,
  },
  emailAdditional: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email', testId: 'emailAdditional' },
  },
  registrationAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', testId: 'registrationRegion' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'registrationCity',
      },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', testId: 'registrationStreet' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', testId: 'registrationHouse' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', testId: 'registrationApartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', testId: 'registrationPostalCode' },
    },
  },
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: {
      label: 'Адрес проживания совпадает с адресом регистрации',
      testId: 'sameAsRegistration',
    },
  },
  residenceAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', testId: 'residenceRegion' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'residenceCity',
      },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', testId: 'residenceStreet' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', testId: 'residenceHouse' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', testId: 'residenceApartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', testId: 'residencePostalCode' },
    },
  },
  // Step 4
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_STATUSES,
      testId: 'employmentStatus',
    },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: null,
    component: Input,
    componentProps: { label: 'Название компании', testId: 'companyName' },
  },
  companyInn: {
    value: null,
    component: InputMask,
    componentProps: { label: 'ИНН компании', mask: '9999999999', testId: 'companyInn' },
  },
  companyPhone: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      mask: '+7 (999) 999-99-99',
      testId: 'companyPhone',
    },
  },
  companyAddress: {
    value: null,
    component: Input,
    componentProps: { label: 'Адрес компании', testId: 'companyAddress' },
  },
  position: {
    value: null,
    component: Input,
    componentProps: { label: 'Должность', testId: 'position' },
  },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      type: 'number',
      testId: 'workExperienceTotal',
    },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      type: 'number',
      testId: 'workExperienceCurrent',
    },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', testId: 'monthlyIncome' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный доход (₽)',
      type: 'number',
      testId: 'additionalIncome',
    },
  },
  additionalIncomeSource: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Источник дополнительного дохода',
      testId: 'additionalIncomeSource',
    },
  },
  businessType: {
    value: null,
    component: Input,
    componentProps: { label: 'Тип бизнеса', testId: 'businessType' },
  },
  businessInn: {
    value: null,
    component: InputMask,
    componentProps: { label: 'ИНН ИП', mask: '999999999999', testId: 'businessInn' },
  },
  businessActivity: {
    value: null,
    component: Textarea,
    componentProps: { label: 'Вид деятельности', rows: 3, testId: 'businessActivity' },
  },
  // Step 5
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: MARITAL_STATUSES,
      testId: 'maritalStatus',
    },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', testId: 'dependents' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATION_LEVELS,
      testId: 'education',
    },
  } satisfies FieldConfig<EducationLevel>,
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
  },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
          options: PROPERTY_TYPES,
          testId: 'propertyType',
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', rows: 2, testId: 'propertyDescription' },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Оценочная стоимость',
          type: 'number',
          testId: 'propertyEstimatedValue',
        },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: {
          label: 'Имеется обременение (залог)',
          testId: 'propertyHasEncumbrance',
        },
      },
    },
  ],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
  },
  existingLoans: [
    {
      bank: { value: '', component: Input, componentProps: { label: 'Банк', testId: 'loanBank' } },
      type: {
        value: '',
        component: Input,
        componentProps: { label: 'Тип кредита', testId: 'loanTypeItem' },
      },
      amount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Сумма кредита', type: 'number', testId: 'loanAmountItem' },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности',
          type: 'number',
          testId: 'loanRemainingAmount',
        },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платёж',
          type: 'number',
          testId: 'loanMonthlyPayment',
        },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата погашения', type: 'date', testId: 'loanMaturityDate' },
      },
    },
  ],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаёмщика', testId: 'hasCoBorrower' },
  },
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Фамилия', testId: 'coBorrowerLastName' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя', testId: 'coBorrowerFirstName' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество', testId: 'coBorrowerMiddleName' },
        },
        birthDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата рождения', type: 'date', testId: 'coBorrowerBirthDate' },
        },
        gender: {
          value: 'male',
          component: RadioGroup,
          componentProps: { label: 'Пол', options: GENDERS, testId: 'coBorrowerGender' },
        } satisfies FieldConfig<Gender>,
        birthPlace: {
          value: '',
          component: Input,
          componentProps: { label: 'Место рождения', testId: 'coBorrowerBirthPlace' },
        },
      },
      phone: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Телефон',
          mask: '+7 (999) 999-99-99',
          testId: 'coBorrowerPhone',
        },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', testId: 'coBorrowerEmail' },
      },
      relationship: {
        value: '',
        component: Input,
        componentProps: { label: 'Родство', testId: 'coBorrowerRelationship' },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный доход',
          type: 'number',
          testId: 'coBorrowerMonthlyIncome',
        },
      },
    },
  ],
  // Step 6
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие на обработку персональных данных',
      testId: 'agreePersonalData',
    },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие на проверку кредитной истории',
      testId: 'agreeCreditHistory',
    },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие на получение маркетинговых материалов',
      testId: 'agreeMarketing',
    },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Подтверждаю точность введённых данных',
      testId: 'confirmAccuracy',
    },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подтверждения из СМС',
      mask: '999999',
      testId: 'electronicSignature',
    },
  },
  // Computed
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, testId: 'fullName' },
  },
  age: {
    value: 0,
    component: Input,
    componentProps: { label: 'Возраст (лет)', type: 'number', readOnly: true, testId: 'age' },
  },
  interestRate: {
    value: 14.5,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readOnly: true,
      testId: 'interestRate',
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платёж (₽)',
      type: 'number',
      readOnly: true,
      testId: 'monthlyPayment',
    },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий доход (₽)',
      type: 'number',
      readOnly: true,
      testId: 'totalIncome',
    },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процент платежа от дохода (%)',
      type: 'number',
      readOnly: true,
      testId: 'paymentToIncomeRatio',
    },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Доход созаёмщиков (₽)',
      type: 'number',
      readOnly: true,
      testId: 'coBorrowersIncome',
    },
  },
};

// ============================================================================
// Validation
// ============================================================================

const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: (path) => {
    required(path.loanType, { message: 'Выберите тип кредита' });
    required(path.loanAmount, { message: 'Введите сумму кредита' });
    min(path.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });
    max(path.loanAmount, 10000000, { message: 'Максимальная сумма — 10 000 000 ₽' });
    required(path.loanTerm, { message: 'Введите срок кредита' });
    min(path.loanTerm, 6);
    max(path.loanTerm, 240);
    required(path.loanPurpose);
    minLength(path.loanPurpose, 10);
    maxLength(path.loanPurpose, 500);

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'mortgage',
      (p) => {
        required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
        min(p.propertyValue, 1000000);
      }
    );

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'car',
      (p) => {
        required(p.carBrand);
        minLength(p.carBrand, 2);
        maxLength(p.carBrand, 50);
        required(p.carModel);
        minLength(p.carModel, 1);
        maxLength(p.carModel, 50);
        required(p.carYear);
        min(p.carYear, 2000);
        max(p.carYear, new Date().getFullYear() + 1);
        required(p.carPrice);
        min(p.carPrice, 300000);
        max(p.carPrice, 10000000);
      }
    );
  },
  2: (path) => {
    required(path.personalData.lastName);
    required(path.personalData.firstName);
    required(path.personalData.middleName);
    required(path.personalData.birthDate);
    required(path.personalData.gender);
    required(path.personalData.birthPlace);
    required(path.passportData.series);
    required(path.passportData.number);
    required(path.passportData.issueDate);
    required(path.passportData.issuedBy);
    required(path.passportData.departmentCode);
    required(path.inn);
    pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
    required(path.snils);

    validate(path.age, (value) => {
      if (value == null) return null;
      if (value < 18) return { code: 'too-young', message: 'Возраст должен быть от 18 лет' };
      if (value > 70) return { code: 'too-old', message: 'Возраст должен быть до 70 лет' };
      return null;
    });
  },
  3: (path) => {
    required(path.phoneMain);
    pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Неверный формат телефона',
    });
    required(path.email);
    emailValidator(path.email);
    required(path.registrationAddress.region);
    required(path.registrationAddress.city);
    required(path.registrationAddress.street);
    required(path.registrationAddress.house);
    required(path.registrationAddress.postalCode);

    applyWhen(
      path.sameAsRegistration,
      (value) => value === false,
      (p) => {
        required(p.residenceAddress.region);
        required(p.residenceAddress.city);
        required(p.residenceAddress.street);
        required(p.residenceAddress.house);
        required(p.residenceAddress.postalCode);
      }
    );
  },
  4: (path) => {
    required(path.employmentStatus);
    required(path.workExperienceTotal);
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent);
    min(path.workExperienceCurrent, 0);
    required(path.monthlyIncome);
    min(path.monthlyIncome, 10000);

    validate(path.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.workExperienceTotal.value.value;
      if (total != null && value != null && value > total) {
        return {
          code: 'experience-mismatch',
          message: 'Текущий стаж не может превышать общий',
        };
      }
      return null;
    });

    applyWhen(
      path.employmentStatus,
      (status) => status === 'employed',
      (p) => {
        required(p.companyName);
        required(p.companyInn);
        required(p.companyPhone);
        required(p.companyAddress);
        required(p.position);
      }
    );

    applyWhen(
      path.employmentStatus,
      (status) => status === 'selfEmployed',
      (p) => {
        required(p.businessType);
        required(p.businessInn);
        required(p.businessActivity);
      }
    );

    validate(path.additionalIncome, (value, ctx) => {
      const source = ctx.form.additionalIncomeSource.value.value;
      if (value != null && value > 0 && (!source || source.trim() === '')) {
        return {
          code: 'source-required',
          message: 'Укажите источник дополнительного дохода',
        };
      }
      return null;
    });

    validate(path.paymentToIncomeRatio, (value) => {
      if (value != null && value > 50) {
        return {
          code: 'payment-too-high',
          message: 'Платёж не должен превышать 50% от дохода',
        };
      }
      return null;
    });
  },
  5: (path) => {
    required(path.maritalStatus);
    required(path.dependents);
    min(path.dependents, 0);
    max(path.dependents, 10);
    required(path.education);

    applyWhen(
      path.hasProperty,
      (value) => value === true,
      (p) => {
        validateItems(p.properties, (itemPath) => {
          required(itemPath.type);
          required(itemPath.description);
          required(itemPath.estimatedValue);
          min(itemPath.estimatedValue, 0);
        });
      }
    );

    applyWhen(
      path.hasExistingLoans,
      (value) => value === true,
      (p) => {
        validateItems(p.existingLoans, (itemPath) => {
          required(itemPath.bank);
          required(itemPath.type);
          required(itemPath.amount);
          min(itemPath.amount, 0);
          required(itemPath.remainingAmount);
          min(itemPath.remainingAmount, 0);
          required(itemPath.monthlyPayment);
          min(itemPath.monthlyPayment, 0);
          required(itemPath.maturityDate);
        });
      }
    );

    applyWhen(
      path.hasCoBorrower,
      (value) => value === true,
      (p) => {
        validateItems(p.coBorrowers, (itemPath) => {
          required(itemPath.personalData.lastName);
          required(itemPath.personalData.firstName);
          required(itemPath.phone);
          required(itemPath.email);
          emailValidator(itemPath.email);
          required(itemPath.relationship);
          required(itemPath.monthlyIncome);
          min(itemPath.monthlyIncome, 0);
        });
      }
    );
  },
  6: (path) => {
    validate(path.agreePersonalData, (value) =>
      value === true ? null : { code: 'required', message: 'Необходимо согласие' }
    );
    validate(path.agreeCreditHistory, (value) =>
      value === true ? null : { code: 'required', message: 'Необходимо согласие' }
    );
    validate(path.agreeTerms, (value) =>
      value === true ? null : { code: 'required', message: 'Необходимо согласие' }
    );
    validate(path.confirmAccuracy, (value) =>
      value === true
        ? null
        : { code: 'required', message: 'Необходимо подтверждение точности данных' }
    );
    required(path.electronicSignature);
    pattern(path.electronicSignature, /^\d{6}$/, {
      message: 'Код должен содержать 6 цифр',
    });
  },
};

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  STEP_VALIDATIONS[1](path);
  STEP_VALIDATIONS[2](path);
  STEP_VALIDATIONS[3](path);
  STEP_VALIDATIONS[4](path);
  STEP_VALIDATIONS[5](path);
  STEP_VALIDATIONS[6](path);
};

// ============================================================================
// Behavior
// ============================================================================

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 fullName = lastName + firstName + middleName
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName]
      .filter(Boolean)
      .join(' ')
  );

  // C.5 age — from birthDate
  computeFrom([path.personalData], path.age, ({ personalData }: CreditApplicationForm) =>
    calculateAge(personalData.birthDate)
  );

  // C.3 initialPayment — 20% of propertyValue
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) => {
      if (propertyValue == null) return null;
      return Math.round(propertyValue * 0.2);
    }
  );

  // C.6 totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.1 interestRate — depends on loanType, hasProperty
  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    ({ loanType, hasProperty }: CreditApplicationForm) => getInterestRate(loanType, hasProperty)
  );

  // C.2 monthlyPayment — annuity formula
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuity(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
  );

  // C.7 paymentToIncomeRatio
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome) return 0;
      return Math.round((monthlyPayment / totalIncome) * 100 * 100) / 100;
    }
  );

  // C.8 coBorrowersIncome — sum of coBorrowers[].monthlyIncome
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, b) => sum + (b.monthlyIncome ?? 0), 0)
  );

  // copyFrom registration → residence when sameAsRegistration=true
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: ['region', 'city', 'street', 'house', 'apartment', 'postalCode'],
  });

  // Async options loading: cities by region (mock — spec says Input not Select; we still
  // pre-fetch cities for hint use; result currently logged for demo)
  watchField(
    path.registrationAddress.region,
    async (region) => {
      if (!region) return;
      try {
        await fetchCitiesByRegion(region);
      } catch {
        /* ignore */
      }
    },
    { debounce: 300 }
  );

  watchField(
    path.residenceAddress.region,
    async (region) => {
      if (!region) return;
      try {
        await fetchCitiesByRegion(region);
      } catch {
        /* ignore */
      }
    },
    { debounce: 300 }
  );

  // Async carModel options loading
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      if (!brand) {
        ctx.form.carModel.setValue(null);
        return;
      }
      try {
        // Reset model on brand change (per spec)
        ctx.form.carModel.setValue(null);
        await fetchCarModels(brand);
      } catch {
        // ignore
      }
    },
    { debounce: 300 }
  );

  // Reset city on region change (per spec)
  watchField(
    path.registrationAddress.region,
    (_v, ctx) => {
      ctx.form.registrationAddress.city.setValue('');
    },
    { debounce: 50 }
  );

  // Reset specific fields on loanType change (per spec)
  watchField(
    path.loanType,
    (loanType, ctx) => {
      if (loanType !== 'mortgage') {
        ctx.form.propertyValue.setValue(null);
      }
      if (loanType !== 'car') {
        ctx.form.carBrand.setValue(null);
        ctx.form.carModel.setValue(null);
        ctx.form.carYear.setValue(null);
        ctx.form.carPrice.setValue(null);
      }
    },
    { immediate: false }
  );

  // Clear arrays when toggle off
  watchField(
    path.hasProperty,
    (value, ctx) => {
      if (value === false) {
        ctx.form.properties.clear();
      }
    },
    { immediate: false }
  );
  watchField(
    path.hasExistingLoans,
    (value, ctx) => {
      if (value === false) {
        ctx.form.existingLoans.clear();
      }
    },
    { immediate: false }
  );
  watchField(
    path.hasCoBorrower,
    (value, ctx) => {
      if (value === false) {
        ctx.form.coBorrowers.clear();
      }
    },
    { immediate: false }
  );
};

// ============================================================================
// Page component
// ============================================================================

// FormRoot — closure-pattern container that owns FormWizard.
// Marked __selfManagedChildren so RenderNodeComponent forwards form into it.
type FormRootProps = {
  form: FormProxy<CreditApplicationForm>;
  children?: ReactNode | RenderNode<CreditApplicationForm>[];
  wizardConfig: {
    stepValidations: Record<number, ValidationSchemaFn<CreditApplicationForm>>;
    fullValidation: ValidationSchemaFn<CreditApplicationForm>;
  };
  onSubmit: () => Promise<void> | void;
};

function FormRoot({ form, children, wizardConfig, onSubmit }: FormRootProps): ReactNode {
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);
  const childArray = (Array.isArray(children) ? children : [children]) as RenderNode<
    CreditApplicationForm
  >[];

  const stepTitles = ['Кредит', 'Личные', 'Контакты', 'Работа', 'Доп. инфо', 'Подтверждение'];
  const stepIcons = ['💰', '👤', '📞', '💼', '📋', '✓'];

  const steps: FormWizardStep<CreditApplicationForm>[] = childArray.map((child, idx) => ({
    number: idx + 1,
    title: stepTitles[idx] ?? `Шаг ${idx + 1}`,
    icon: stepIcons[idx] ?? String(idx + 1),
    body: child,
  }));

  return (
    <FormWizard
      ref={navRef}
      form={form}
      config={wizardConfig}
      steps={steps}
      onSubmit={onSubmit}
    />
  );
}
(FormRoot as any).__selfManagedChildren = true;

// Page component
export default function MccaRendererJsonV15() {
  const form = useMemo(
    () =>
      createForm<CreditApplicationForm>({
        form: formSchema,
        validation: fullValidation,
        behavior,
      }),
    []
  );

  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    form.markAsTouched();
    await form.validate();
    if (!form.valid.value) {
      setSubmitMessage('Форма содержит ошибки. Проверьте поля.');
      return;
    }
    const payload = form.getValue();
    console.log('[mcp-credit-renderer-json-v15] submit payload:', payload);
    setSubmitMessage('Заявка успешно отправлена.');
  };

  // Closure-pattern: build registry that resolves names from JSON to components+sources
  const registry = useMemo(
    () =>
      defineRegistry((reg) => {
        // FormRoot — top-level container that wraps FormWizard.
        reg.container('FormRoot', FormRoot);
        // Layout containers
        reg.container('Box', Box);
        reg.container('Section', Section);
        // FormArraySection — ui-kit array-section (handles control resolve internally)
        reg.container('FormArraySection', FormArraySection);
        // Field components
        reg.field('Input', Input);
        reg.field('InputMask', InputMask);
        reg.field('Select', Select);
        reg.field('Textarea', Textarea);
        reg.field('Checkbox', Checkbox);
        reg.field('RadioGroup', RadioGroup);
        // FieldWrapper
        reg.container(FIELD_WRAPPER, FormField);
        // Sources — option lists
        reg.source('LOAN_TYPES', LOAN_TYPES);
        reg.source('GENDERS', GENDERS);
        reg.source('EMPLOYMENT_STATUSES', EMPLOYMENT_STATUSES);
        reg.source('MARITAL_STATUSES', MARITAL_STATUSES);
        reg.source('EDUCATION_LEVELS', EDUCATION_LEVELS);
        reg.source('PROPERTY_TYPES', PROPERTY_TYPES);
        reg.source('CITIES_DEFAULT', CITIES_DEFAULT);
        // Sources — array initial-value templates
        reg.source('PROPERTY_TEMPLATE', propertyTemplate());
        reg.source('EXISTING_LOAN_TEMPLATE', existingLoanTemplate());
        reg.source('CO_BORROWER_TEMPLATE', coBorrowerTemplate());
        // Sources — itemLabel functions
        reg.source(
          'PROPERTY_ITEM_LABEL_FN',
          (_: unknown, index: number) => `Имущество #${index + 1}`
        );
        reg.source(
          'EXISTING_LOAN_ITEM_LABEL_FN',
          (_: unknown, index: number) => `Кредит #${index + 1}`
        );
        reg.source(
          'CO_BORROWER_ITEM_LABEL_FN',
          (_: unknown, index: number) => `Созаёмщик #${index + 1}`
        );
        // Sources — wizard config + submit handler
        reg.source('WIZARD_CONFIG', { stepValidations: STEP_VALIDATIONS, fullValidation });
        reg.source('HANDLE_SUBMIT', handleSubmit);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Closure factory — wraps JSON-derived RenderSchemaFn to inject form into FormRoot.
  const renderSchema = useMemo<RenderSchemaFn<CreditApplicationForm>>(() => {
    const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(
      jsonSchema as JsonFormSchema,
      registry
    );
    const wrapped: RenderSchemaFn<CreditApplicationForm> = (path) => {
      const baseRoot = baseFn(path) as unknown as RenderNode<CreditApplicationForm>;
      const baseProps = (baseRoot as { componentProps?: Record<string, unknown> })
        .componentProps;
      return {
        ...(baseRoot as object),
        componentProps: { ...baseProps, form, onSubmit: handleSubmit },
      } as unknown as RenderNode<CreditApplicationForm>;
    };
    return wrapped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, registry]);

  const schema = useMemo(() => createRenderSchema<CreditApplicationForm>(renderSchema), [
    renderSchema,
  ]);

  // Reactive subscriptions to control fields via useFormControlValue (canonical hook).
  const loanTypeValue = useFormControlValue(form.loanType);
  const employmentStatusValue = useFormControlValue(form.employmentStatus);
  const sameAsRegistrationValue = useFormControlValue(form.sameAsRegistration);
  const hasPropertyValue = useFormControlValue(form.hasProperty);
  const hasExistingLoansValue = useFormControlValue(form.hasExistingLoans);
  const hasCoBorrowerValue = useFormControlValue(form.hasCoBorrower);

  // Hide conditional sections via schema.node().setHidden
  useEffect(() => {
    schema.node('mortgage-section')?.setHidden(loanTypeValue !== 'mortgage');
    schema.node('car-section')?.setHidden(loanTypeValue !== 'car');
    schema.node('employed-section')?.setHidden(employmentStatusValue !== 'employed');
    schema.node('self-employed-section')?.setHidden(employmentStatusValue !== 'selfEmployed');
    schema
      .node('residence-address-section')
      ?.setHidden(sameAsRegistrationValue === true);
    schema.node('properties-array-section')?.setHidden(hasPropertyValue === false);
    schema.node('loans-array-section')?.setHidden(hasExistingLoansValue === false);
    schema.node('co-borrowers-array-section')?.setHidden(hasCoBorrowerValue === false);
  }, [
    schema,
    loanTypeValue,
    employmentStatusValue,
    sameAsRegistrationValue,
    hasPropertyValue,
    hasExistingLoansValue,
    hasCoBorrowerValue,
  ]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Заявка на кредит — renderer-json v15</h1>
      <p className="text-sm text-gray-500 mb-4">
        iter-15 full-spec, target=renderer-json (closure pattern + JSON schema)
      </p>
      <JsonRendererProvider settings={{ registry, fieldWrapper: FormField }}>
        <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
      </JsonRendererProvider>
      {submitMessage ? (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          {submitMessage}
        </div>
      ) : null}
      <div className="mt-4">
        <Button type="button" onClick={handleSubmit} data-testid="submit-button-fallback">
          Отправить (fallback)
        </Button>
      </div>
    </div>
  );
}

// silence unused: RenderNodeComponent imported for completeness (closure-pattern visibility)
void RenderNodeComponent;
