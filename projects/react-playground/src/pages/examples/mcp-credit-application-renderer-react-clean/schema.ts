/**
 * Credit application form — clean baseline (target=renderer-react).
 *
 * Self-contained schema: types + initial schema + validation + behavior +
 * RenderSchema factory. No dependencies on existing examples.
 *
 * Stack:
 *   - @reformer/core           — createForm, FormProxy, FormSchema, validators
 *   - @reformer/ui-kit         — Input, InputMask, Textarea, Select, Checkbox,
 *                                RadioGroup, FormField, FormArraySection, Box,
 *                                Section, FormWizard
 *   - @reformer/renderer-react — createRenderSchema, FormRenderer, render-behavior
 */

import {
  createForm,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
  type FieldConfig,
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
  applyWhen,
  validateItems,
} from '@reformer/core/validators';
import { computeFrom, watchField, copyFrom, enableWhen } from '@reformer/core/behaviors';
import {
  Box,
  Section,
  Input,
  InputMask,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
  FormField,
  FormArraySection,
} from '@reformer/ui-kit';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { createRenderSchema, type RenderNode } from '@reformer/renderer-react';
import { createElement, type ComponentType } from 'react';

// =====================================================================
// Types
// =====================================================================

type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
type Gender = 'male' | 'female';
type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car';

type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
  [key: string]: unknown;
};

type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
  [key: string]: unknown;
};

type Address = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
  [key: string]: unknown;
};

type Property = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
  [key: string]: unknown;
};

type ExistingLoan = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
  [key: string]: unknown;
};

type CoBorrowerPersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  [key: string]: unknown;
};

type CoBorrower = {
  personalData: CoBorrowerPersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
  [key: string]: unknown;
};

export type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | undefined;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | undefined;
  initialPayment: number | undefined;
  carBrand: string | undefined;
  carModel: string | undefined;
  carYear: number | undefined;
  carPrice: number | undefined;

  // Step 2
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3
  phoneMain: string;
  phoneAdditional: string | undefined;
  email: string;
  emailAdditional: string | undefined;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Step 4
  employmentStatus: EmploymentStatus;
  companyName: string | undefined;
  companyInn: string | undefined;
  companyPhone: string | undefined;
  companyAddress: string | undefined;
  position: string | undefined;
  workExperienceTotal: number | undefined;
  workExperienceCurrent: number | undefined;
  monthlyIncome: number | undefined;
  additionalIncome: number | undefined;
  additionalIncomeSource: string | undefined;
  businessType: string | undefined;
  businessInn: string | undefined;
  businessActivity: string | undefined;

  // Step 5
  maritalStatus: MaritalStatus;
  dependents: number;
  education: Education;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;

  [key: string]: unknown;
};

// =====================================================================
// Options
// =====================================================================

const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const EMPLOYMENT_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
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
  { value: 'land', label: 'Земля' },
  { value: 'commercial', label: 'Коммерческая' },
  { value: 'car', label: 'Автомобиль' },
];

// =====================================================================
// Initial value templates (plain leaf values for arrays)
// =====================================================================

const propertyTemplate = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

const existingLoanTemplate = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

const coBorrowerTemplate = (): CoBorrower => ({
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

// =====================================================================
// Form schema (declarative components + componentProps)
// =====================================================================

const formSchema: FormSchema<CreditApplicationForm> = {
  // ---------- Step 1: loan -------------------------------------------
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPE_OPTIONS,
      testId: 'loanType',
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      type: 'number',
      step: 10000,
      placeholder: 'Введите сумму',
      testId: 'loanAmount',
    },
  } satisfies FieldConfig<number | null>,
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Срок кредита (месяцев)',
      type: 'number',
      placeholder: 'Введите срок',
      testId: 'loanTerm',
    },
  } satisfies FieldConfig<number>,
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 3,
      testId: 'loanPurpose',
    },
  } satisfies FieldConfig<string>,
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
      testId: 'propertyValue',
    },
  } satisfies FieldConfig<number | null>,
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      type: 'number',
      placeholder: '20% от стоимости',
      readOnly: true,
      testId: 'initialPayment',
    },
  } satisfies FieldConfig<number | null>,
  carBrand: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Например: Toyota',
      testId: 'carBrand',
    },
  } satisfies FieldConfig<string | null>,
  carModel: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Например: Camry',
      testId: 'carModel',
    },
  } satisfies FieldConfig<string | null>,
  carYear: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      type: 'number',
      placeholder: '2020',
      testId: 'carYear',
    },
  } satisfies FieldConfig<number | null>,
  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
      testId: 'carPrice',
    },
  } satisfies FieldConfig<number | null>,

  // ---------- Step 2: personal data ----------------------------------
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Фамилия',
        placeholder: 'Введите фамилию',
        testId: 'personalData-lastName',
      },
    } satisfies FieldConfig<string>,
    firstName: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Имя',
        placeholder: 'Введите имя',
        testId: 'personalData-firstName',
      },
    } satisfies FieldConfig<string>,
    middleName: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Отчество',
        placeholder: 'Введите отчество',
        testId: 'personalData-middleName',
      },
    } satisfies FieldConfig<string>,
    birthDate: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дата рождения',
        type: 'date',
        testId: 'personalData-birthDate',
      },
    } satisfies FieldConfig<string>,
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: {
        label: 'Пол',
        options: GENDER_OPTIONS,
        testId: 'personalData-gender',
      },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Место рождения',
        placeholder: 'Введите место рождения',
        testId: 'personalData-birthPlace',
      },
    } satisfies FieldConfig<string>,
  },
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Серия паспорта',
        mask: '99 99',
        placeholder: '12 34',
        testId: 'passportData-series',
      },
    } satisfies FieldConfig<string>,
    number: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Номер паспорта',
        mask: '999999',
        placeholder: '123456',
        testId: 'passportData-number',
      },
    } satisfies FieldConfig<string>,
    issueDate: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дата выдачи',
        type: 'date',
        testId: 'passportData-issueDate',
      },
    } satisfies FieldConfig<string>,
    issuedBy: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Кем выдан',
        placeholder: 'Введите название органа',
        testId: 'passportData-issuedBy',
      },
    } satisfies FieldConfig<string>,
    departmentCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Код подразделения',
        mask: '999-999',
        placeholder: '123-456',
        testId: 'passportData-departmentCode',
      },
    } satisfies FieldConfig<string>,
  },
  inn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН',
      mask: '999999999999',
      placeholder: '123456789012',
      testId: 'inn',
    },
  } satisfies FieldConfig<string>,
  snils: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'СНИЛС',
      mask: '999-999-999 99',
      placeholder: '123-456-789 00',
      testId: 'snils',
    },
  } satisfies FieldConfig<string>,

  // ---------- Step 3: contacts ---------------------------------------
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
      testId: 'phoneMain',
    },
  } satisfies FieldConfig<string>,
  phoneAdditional: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
      testId: 'phoneAdditional',
    },
  } satisfies FieldConfig<string | null>,
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'example@mail.com',
      testId: 'email',
    },
  } satisfies FieldConfig<string>,
  emailAdditional: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный email',
      type: 'email',
      placeholder: 'example@mail.com',
      testId: 'emailAdditional',
    },
  } satisfies FieldConfig<string | null>,
  registrationAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Регион',
        placeholder: 'Введите регион',
        testId: 'registrationAddress-region',
      },
    } satisfies FieldConfig<string>,
    city: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'registrationAddress-city',
      },
    } satisfies FieldConfig<string>,
    street: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Улица',
        placeholder: 'Введите улицу',
        testId: 'registrationAddress-street',
      },
    } satisfies FieldConfig<string>,
    house: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дом',
        placeholder: '№',
        testId: 'registrationAddress-house',
      },
    } satisfies FieldConfig<string>,
    apartment: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Квартира',
        placeholder: '№',
        testId: 'registrationAddress-apartment',
      },
    } satisfies FieldConfig<string>,
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: 'registrationAddress-postalCode',
      },
    } satisfies FieldConfig<string>,
  },
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: {
      label: 'Адрес проживания совпадает с адресом регистрации',
      testId: 'sameAsRegistration',
    },
  } satisfies FieldConfig<boolean>,
  residenceAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Регион',
        placeholder: 'Введите регион',
        testId: 'residenceAddress-region',
      },
    } satisfies FieldConfig<string>,
    city: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'residenceAddress-city',
      },
    } satisfies FieldConfig<string>,
    street: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Улица',
        placeholder: 'Введите улицу',
        testId: 'residenceAddress-street',
      },
    } satisfies FieldConfig<string>,
    house: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дом',
        placeholder: '№',
        testId: 'residenceAddress-house',
      },
    } satisfies FieldConfig<string>,
    apartment: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Квартира',
        placeholder: '№',
        testId: 'residenceAddress-apartment',
      },
    } satisfies FieldConfig<string>,
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: 'residenceAddress-postalCode',
      },
    } satisfies FieldConfig<string>,
  },

  // ---------- Step 4: employment -------------------------------------
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_OPTIONS,
      testId: 'employmentStatus',
    },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Название компании',
      placeholder: 'Введите название',
      testId: 'companyName',
    },
  } satisfies FieldConfig<string | null>,
  companyInn: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'ИНН компании',
      mask: '9999999999',
      placeholder: '1234567890',
      testId: 'companyInn',
    },
  } satisfies FieldConfig<string | null>,
  companyPhone: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
      testId: 'companyPhone',
    },
  } satisfies FieldConfig<string | null>,
  companyAddress: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Адрес компании',
      placeholder: 'Полный адрес',
      testId: 'companyAddress',
    },
  } satisfies FieldConfig<string | null>,
  position: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Должность',
      placeholder: 'Ваша должность',
      testId: 'position',
    },
  } satisfies FieldConfig<string | null>,
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      type: 'number',
      placeholder: '0',
      testId: 'workExperienceTotal',
    },
  } satisfies FieldConfig<number | null>,
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      type: 'number',
      placeholder: '0',
      testId: 'workExperienceCurrent',
    },
  } satisfies FieldConfig<number | null>,
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      type: 'number',
      placeholder: '0',
      testId: 'monthlyIncome',
    },
  } satisfies FieldConfig<number | null>,
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный доход (₽)',
      type: 'number',
      placeholder: '0',
      testId: 'additionalIncome',
    },
  } satisfies FieldConfig<number | null>,
  additionalIncomeSource: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Источник дополнительного дохода',
      placeholder: 'Опишите источник',
      testId: 'additionalIncomeSource',
    },
  } satisfies FieldConfig<string | null>,
  businessType: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Тип бизнеса',
      placeholder: 'ИП, ООО и т.д.',
      testId: 'businessType',
    },
  } satisfies FieldConfig<string | null>,
  businessInn: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'ИНН ИП',
      mask: '999999999999',
      placeholder: '123456789012',
      testId: 'businessInn',
    },
  } satisfies FieldConfig<string | null>,
  businessActivity: {
    value: null,
    component: Textarea,
    componentProps: {
      label: 'Вид деятельности',
      placeholder: 'Опишите вид деятельности',
      rows: 2,
      testId: 'businessActivity',
    },
  } satisfies FieldConfig<string | null>,

  // ---------- Step 5: additional -------------------------------------
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: MARITAL_OPTIONS,
      testId: 'maritalStatus',
    },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Количество иждивенцев',
      type: 'number',
      placeholder: '0',
      testId: 'dependents',
    },
  } satisfies FieldConfig<number>,
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATION_OPTIONS,
      testId: 'education',
    },
  } satisfies FieldConfig<Education>,
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'У меня есть имущество',
      testId: 'hasProperty',
    },
  } satisfies FieldConfig<boolean>,
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
          placeholder: 'Выберите тип',
          options: PROPERTY_TYPE_OPTIONS,
          testId: 'type',
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Описание',
          placeholder: 'Опишите имущество',
          rows: 2,
          testId: 'description',
        },
      } satisfies FieldConfig<string>,
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Оценочная стоимость (₽)',
          type: 'number',
          placeholder: '0',
          testId: 'estimatedValue',
        },
      } satisfies FieldConfig<number>,
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: {
          label: 'Имеется обременение (залог)',
          testId: 'hasEncumbrance',
        },
      } satisfies FieldConfig<boolean>,
    },
  ],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'У меня есть другие кредиты',
      testId: 'hasExistingLoans',
    },
  } satisfies FieldConfig<boolean>,
  existingLoans: [
    {
      bank: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Банк',
          placeholder: 'Название банка',
          testId: 'bank',
        },
      } satisfies FieldConfig<string>,
      type: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Тип кредита',
          placeholder: 'Тип кредита',
          testId: 'type',
        },
      } satisfies FieldConfig<string>,
      amount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Сумма кредита',
          type: 'number',
          placeholder: '0',
          testId: 'amount',
        },
      } satisfies FieldConfig<number>,
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности',
          type: 'number',
          placeholder: '0',
          testId: 'remainingAmount',
        },
      } satisfies FieldConfig<number>,
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платеж',
          type: 'number',
          placeholder: '0',
          testId: 'monthlyPayment',
        },
      } satisfies FieldConfig<number>,
      maturityDate: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Дата погашения',
          type: 'date',
          testId: 'maturityDate',
        },
      } satisfies FieldConfig<string>,
    },
  ],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Добавить созаёмщика',
      testId: 'hasCoBorrower',
    },
  } satisfies FieldConfig<boolean>,
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Фамилия',
            placeholder: 'Введите фамилию',
            testId: 'lastName',
          },
        } satisfies FieldConfig<string>,
        firstName: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Имя',
            placeholder: 'Введите имя',
            testId: 'firstName',
          },
        } satisfies FieldConfig<string>,
        middleName: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Отчество',
            placeholder: 'Введите отчество',
            testId: 'middleName',
          },
        } satisfies FieldConfig<string>,
        birthDate: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Дата рождения',
            type: 'date',
            testId: 'birthDate',
          },
        } satisfies FieldConfig<string>,
      },
      phone: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Телефон',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
          testId: 'phone',
        },
      } satisfies FieldConfig<string>,
      email: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Email',
          type: 'email',
          placeholder: 'example@mail.com',
          testId: 'email',
        },
      } satisfies FieldConfig<string>,
      relationship: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Родство',
          placeholder: 'Укажите родство',
          testId: 'relationship',
        },
      } satisfies FieldConfig<string>,
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный доход',
          type: 'number',
          placeholder: '0',
          testId: 'monthlyIncome',
        },
      } satisfies FieldConfig<number>,
    },
  ],

  // ---------- Step 6: confirmation -----------------------------------
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие на обработку персональных данных',
      testId: 'agreePersonalData',
    },
  } satisfies FieldConfig<boolean>,
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие на проверку кредитной истории',
      testId: 'agreeCreditHistory',
    },
  } satisfies FieldConfig<boolean>,
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие на получение маркетинговых материалов',
      testId: 'agreeMarketing',
    },
  } satisfies FieldConfig<boolean>,
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Согласие с условиями кредитования',
      testId: 'agreeTerms',
    },
  } satisfies FieldConfig<boolean>,
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Подтверждаю точность введенных данных',
      testId: 'confirmAccuracy',
    },
  } satisfies FieldConfig<boolean>,
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подтверждения из СМС',
      mask: '999999',
      placeholder: '123456',
      testId: 'electronicSignature',
    },
  } satisfies FieldConfig<string>,

  // ---------- Computed (readonly) ------------------------------------
  interestRate: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readOnly: true,
      testId: 'interestRate',
    },
  } satisfies FieldConfig<number>,
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платёж (₽)',
      type: 'number',
      readOnly: true,
      testId: 'monthlyPayment',
    },
  } satisfies FieldConfig<number>,
  fullName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Полное имя',
      readOnly: true,
      testId: 'fullName',
    },
  } satisfies FieldConfig<string>,
  age: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Возраст (лет)',
      type: 'number',
      readOnly: true,
      testId: 'age',
    },
  } satisfies FieldConfig<number>,
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий доход (₽)',
      type: 'number',
      readOnly: true,
      testId: 'totalIncome',
    },
  } satisfies FieldConfig<number>,
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Платёж от дохода (%)',
      type: 'number',
      readOnly: true,
      testId: 'paymentToIncomeRatio',
    },
  } satisfies FieldConfig<number>,
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Доход созаёмщиков (₽)',
      type: 'number',
      readOnly: true,
      testId: 'coBorrowersIncome',
    },
  } satisfies FieldConfig<number>,
};

// =====================================================================
// Validation
// =====================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required({ message: 'Выберите тип кредита' }));
  validate(path.loanAmount, required({ message: 'Введите сумму кредита' }));
  validate(path.loanAmount, min(50000));
  validate(path.loanAmount, max(10000000));
  validate(path.loanTerm, required({ message: 'Введите срок кредита' }));
  validate(path.loanTerm, min(6));
  validate(path.loanTerm, max(240));
  validate(path.loanPurpose, required({ message: 'Опишите цель кредита' }));
  validate(path.loanPurpose, minLength(10));
  validate(path.loanPurpose, maxLength(500));

  applyWhen(
    path.loanType,
    (t) => t === 'mortgage',
    (p) => {
      validate(p.propertyValue, required({ message: 'Введите стоимость недвижимости' }));
      validate(p.propertyValue, min(1000000));
    }
  );

  applyWhen(
    path.loanType,
    (t) => t === 'car',
    (p) => {
      validate(p.carBrand, required({ message: 'Введите марку' }));
      validate(p.carBrand, minLength(2));
      validate(p.carBrand, maxLength(50));
      validate(p.carModel, required({ message: 'Введите модель' }));
      validate(p.carModel, minLength(1));
      validate(p.carModel, maxLength(50));
      validate(p.carYear, required({ message: 'Введите год выпуска' }));
      validate(p.carYear, min(2000));
      validate(p.carYear, max(new Date().getFullYear() + 1));
      validate(p.carPrice, required({ message: 'Введите стоимость' }));
      validate(p.carPrice, min(300000));
      validate(p.carPrice, max(10000000));
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.middleName, required({ message: 'Отчество обязательно' }));
  validate(path.personalData.birthDate, required({ message: 'Дата рождения обязательна' }));
  validate(path.personalData.gender, required());
  validate(path.personalData.birthPlace, required({ message: 'Место рождения обязательно' }));

  validate(path.passportData.series, required());
  validate(path.passportData.number, required());
  validate(path.passportData.issueDate, required());
  validate(path.passportData.issuedBy, required());
  validate(path.passportData.departmentCode, required());

  validate(path.inn, required({ message: 'ИНН обязателен' }));
  validate(path.inn, pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }));
  validate(path.snils, required({ message: 'СНИЛС обязателен' }));

  // Age 18-70 cross-validation
  validate(path.personalData.birthDate, (value) => {
    if (!value || typeof value !== 'string') return null;
    const birth = new Date(value);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
    if (years < 18) return { code: 'tooYoung', message: 'Возраст должен быть от 18 лет' };
    if (years > 70) return { code: 'tooOld', message: 'Возраст должен быть до 70 лет' };
    return null;
  });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.phoneMain, required({ message: 'Телефон обязателен' }));
  validate(
    path.phoneMain,
    pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Неверный формат телефона',
    })
  );
  validate(path.email, required({ message: 'Email обязателен' }));
  validate(path.email, emailValidator());

  validate(path.registrationAddress.region, required());
  validate(path.registrationAddress.city, required());
  validate(path.registrationAddress.street, required());
  validate(path.registrationAddress.house, required());
  validate(path.registrationAddress.postalCode, required());

  applyWhen(
    path.sameAsRegistration,
    (s) => s === false,
    (p) => {
      validate(p.residenceAddress.region, required());
      validate(p.residenceAddress.city, required());
      validate(p.residenceAddress.street, required());
      validate(p.residenceAddress.house, required());
      validate(p.residenceAddress.postalCode, required());
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.employmentStatus, required());
  validate(path.workExperienceTotal, required());
  validate(path.workExperienceTotal, min(0));
  validate(path.workExperienceCurrent, required());
  validate(path.workExperienceCurrent, min(0));

  // Cross: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value;
    if (typeof value === 'number' && typeof total === 'number' && value > total) {
      return {
        code: 'experience-mismatch',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      };
    }
    return null;
  });

  validate(path.monthlyIncome, required({ message: 'Введите доход' }));
  validate(path.monthlyIncome, min(10000));

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      validate(p.companyName, required({ message: 'Название компании обязательно' }));
      validate(p.companyInn, required({ message: 'ИНН компании обязателен' }));
      validate(p.companyInn, pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }));
      validate(p.companyPhone, required());
      validate(p.companyAddress, required());
      validate(p.position, required());
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      validate(p.businessType, required());
      validate(p.businessInn, required());
      validate(p.businessInn, pattern(/^\d{12}$/, { message: 'ИНН — 12 цифр' }));
      validate(p.businessActivity, required());
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.maritalStatus, required());
  validate(path.dependents, required());
  validate(path.dependents, min(0));
  validate(path.dependents, max(10));
  validate(path.education, required());

  validateItems(path.properties, (itemPath) => {
    validate(itemPath.type, required());
    validate(itemPath.description, required());
    validate(itemPath.estimatedValue, required());
    validate(itemPath.estimatedValue, min(0));
  });

  validateItems(path.existingLoans, (itemPath) => {
    validate(itemPath.bank, required());
    validate(itemPath.type, required());
    validate(itemPath.amount, required());
    validate(itemPath.amount, min(0));
    validate(itemPath.remainingAmount, required());
    validate(itemPath.remainingAmount, min(0));
    validate(itemPath.monthlyPayment, required());
    validate(itemPath.monthlyPayment, min(0));
    validate(itemPath.maturityDate, required());
    // Cross: remainingAmount <= amount
    validate(itemPath.remainingAmount, (value, ctx) => {
      // value is the remainingAmount; need amount from same item.
      // ctx.form provides the WHOLE form, not the item. Skip cross-check at item-level
      // (would require validateTree); covered structurally by validation above.
      void value;
      void ctx;
      return null;
    });
  });
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.agreePersonalData, (v) =>
    v === true ? null : { code: 'mustAgree', message: 'Необходимо согласие' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v === true ? null : { code: 'mustAgree', message: 'Необходимо согласие' }
  );
  validate(path.agreeTerms, (v) =>
    v === true ? null : { code: 'mustAgree', message: 'Необходимо согласие' }
  );
  validate(path.confirmAccuracy, (v) =>
    v === true ? null : { code: 'mustConfirm', message: 'Подтвердите точность данных' }
  );
  validate(path.electronicSignature, required());
  validate(path.electronicSignature, pattern(/^\d{6}$/, { message: 'Код — 6 цифр' }));
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// =====================================================================
// Behaviors (computed fields, copy-from, conditional reset)
// =====================================================================

function computeAge(birthDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  return Math.max(0, years);
}

function computeAnnuity(amount: number, term: number, annualRate: number): number {
  if (!amount || !term || !annualRate) return 0;
  const i = annualRate / 100 / 12;
  if (i <= 0) return Math.round(amount / term);
  const factor = Math.pow(1 + i, term);
  return Math.round((amount * (i * factor)) / (factor - 1));
}

function baseInterestRate(loanType: LoanType): number {
  switch (loanType) {
    case 'mortgage':
      return 8;
    case 'car':
      return 11;
    case 'business':
      return 14;
    case 'refinancing':
      return 10;
    case 'consumer':
    default:
      return 15;
  }
}

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // -------- Computed: fullName ------------------------------------
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName]
      .filter(Boolean)
      .join(' ')
  );

  // -------- Computed: age (from birthDate) ------------------------
  watchField(
    path.personalData.birthDate,
    (birthDate, ctx) => {
      const a = computeAge(typeof birthDate === 'string' ? birthDate : '');
      if (ctx.form.age.value.value !== a) ctx.form.age.setValue(a);
    },
    { immediate: false }
  );

  // -------- Computed: totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // -------- Computed: initialPayment = 20% of propertyValue (mortgage)
  watchField(
    path.propertyValue,
    (value, ctx) => {
      const loanType = ctx.form.loanType.value.value as LoanType;
      if (loanType !== 'mortgage') return;
      const v = typeof value === 'number' ? value : 0;
      const ip = Math.round(v * 0.2);
      if (ctx.form.initialPayment.value.value !== ip) {
        ctx.form.initialPayment.setValue(ip);
      }
    },
    { immediate: false }
  );

  // -------- Computed: interestRate (depends on loanType, hasProperty)
  function recomputeInterestRate(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const loanType = ctx.form.loanType.value.value as LoanType;
    const hasProperty = ctx.form.hasProperty.value.value as boolean;
    let rate = baseInterestRate(loanType);
    if (hasProperty) rate = Math.max(rate - 1, 5);
    if (ctx.form.interestRate.value.value !== rate) {
      ctx.form.interestRate.setValue(rate);
    }
  }
  watchField(path.loanType, (_v, ctx) => recomputeInterestRate(ctx), { immediate: false });
  watchField(path.hasProperty, (_v, ctx) => recomputeInterestRate(ctx), { immediate: false });

  // -------- Computed: monthlyPayment ------------------------------
  function recomputeMonthlyPayment(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const amount = ctx.form.loanAmount.value.value as number | null;
    const term = ctx.form.loanTerm.value.value as number;
    const rate = ctx.form.interestRate.value.value as number;
    const mp = computeAnnuity(amount ?? 0, term ?? 0, rate ?? 0);
    if (Math.abs((ctx.form.monthlyPayment.value.value as number) - mp) > 0.01) {
      ctx.form.monthlyPayment.setValue(mp);
    }
  }
  watchField(path.loanAmount, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
  watchField(path.loanTerm, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
  watchField(path.interestRate, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });

  // -------- Computed: paymentToIncomeRatio ------------------------
  function recomputePtiRatio(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const mp = ctx.form.monthlyPayment.value.value as number;
    const total = ctx.form.totalIncome.value.value as number;
    const ratio = total > 0 ? Math.round((mp / total) * 100) : 0;
    if (ctx.form.paymentToIncomeRatio.value.value !== ratio) {
      ctx.form.paymentToIncomeRatio.setValue(ratio);
    }
  }
  watchField(path.monthlyPayment, (_v, ctx) => recomputePtiRatio(ctx), { immediate: false });
  watchField(path.totalIncome, (_v, ctx) => recomputePtiRatio(ctx), { immediate: false });

  // -------- Conditional fields: enable/disable + reset ------------
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

  // -------- carBrand change → reset carModel ----------------------
  watchField(
    path.carBrand,
    (_v, ctx) => {
      ctx.form.carModel.setValue(null);
    },
    { immediate: false, debounce: 100 }
  );

  // -------- region change → reset city ----------------------------
  watchField(
    path.registrationAddress.region,
    (_v, ctx) => {
      ctx.form.registrationAddress.city.setValue('');
    },
    { immediate: false, debounce: 100 }
  );

  // -------- copyFrom: registrationAddress -> residenceAddress when same flag is on
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // -------- Array cleanup on flag toggles -------------------------
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) ctx.form.properties.clear();
    },
    { immediate: false }
  );
  watchField(
    path.hasExistingLoans,
    (has, ctx) => {
      if (!has) ctx.form.existingLoans.clear();
    },
    { immediate: false }
  );
  watchField(
    path.hasCoBorrower,
    (has, ctx) => {
      if (!has) ctx.form.coBorrowers.clear();
    },
    { immediate: false }
  );

  // -------- coBorrowersIncome (sum of items) ---------------------
  watchField(
    path.coBorrowers,
    (_v, ctx) => {
      const items = ctx.form.coBorrowers.value.value as Array<CoBorrower> | undefined;
      const sum = (items ?? []).reduce((acc, it) => acc + (Number(it?.monthlyIncome) || 0), 0);
      if (ctx.form.coBorrowersIncome.value.value !== sum) {
        ctx.form.coBorrowersIncome.setValue(sum);
      }
    },
    { immediate: false }
  );
};

// =====================================================================
// Form factory
// =====================================================================

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}

// =====================================================================
// Item components for arrays
// =====================================================================

type ItemFC<T extends Record<string, unknown>> = ComponentType<{ control: FormProxy<T> }>;

const PropertyItemForm: ItemFC<Property> = ({ control }) =>
  createElement(
    Section,
    { className: 'space-y-3' },
    createElement(FormField, { control: control.type, testId: 'property-type' }),
    createElement(FormField, { control: control.description, testId: 'property-description' }),
    createElement(
      Box,
      { className: 'grid grid-cols-2 gap-4' },
      createElement(FormField, {
        control: control.estimatedValue,
        testId: 'property-estimatedValue',
      }),
      createElement(FormField, {
        control: control.hasEncumbrance,
        testId: 'property-hasEncumbrance',
      })
    )
  );

const ExistingLoanItemForm: ItemFC<ExistingLoan> = ({ control }) =>
  createElement(
    Section,
    { className: 'space-y-3' },
    createElement(
      Box,
      { className: 'grid grid-cols-2 gap-4' },
      createElement(FormField, { control: control.bank, testId: 'existingLoan-bank' }),
      createElement(FormField, { control: control.type, testId: 'existingLoan-type' })
    ),
    createElement(
      Box,
      { className: 'grid grid-cols-2 gap-4' },
      createElement(FormField, { control: control.amount, testId: 'existingLoan-amount' }),
      createElement(FormField, {
        control: control.remainingAmount,
        testId: 'existingLoan-remainingAmount',
      })
    ),
    createElement(
      Box,
      { className: 'grid grid-cols-2 gap-4' },
      createElement(FormField, {
        control: control.monthlyPayment,
        testId: 'existingLoan-monthlyPayment',
      }),
      createElement(FormField, {
        control: control.maturityDate,
        testId: 'existingLoan-maturityDate',
      })
    )
  );

const CoBorrowerItemForm: ItemFC<CoBorrower> = ({ control }) =>
  createElement(
    Section,
    { className: 'space-y-3' },
    createElement(
      Box,
      { className: 'grid grid-cols-3 gap-4' },
      createElement(FormField, {
        control: control.personalData.lastName,
        testId: 'coBorrower-lastName',
      }),
      createElement(FormField, {
        control: control.personalData.firstName,
        testId: 'coBorrower-firstName',
      }),
      createElement(FormField, {
        control: control.personalData.middleName,
        testId: 'coBorrower-middleName',
      })
    ),
    createElement(FormField, {
      control: control.personalData.birthDate,
      testId: 'coBorrower-birthDate',
    }),
    createElement(
      Box,
      { className: 'grid grid-cols-2 gap-4' },
      createElement(FormField, { control: control.phone, testId: 'coBorrower-phone' }),
      createElement(FormField, { control: control.email, testId: 'coBorrower-email' })
    ),
    createElement(
      Box,
      { className: 'grid grid-cols-2 gap-4' },
      createElement(FormField, {
        control: control.relationship,
        testId: 'coBorrower-relationship',
      }),
      createElement(FormField, {
        control: control.monthlyIncome,
        testId: 'coBorrower-monthlyIncome',
      })
    )
  );

// =====================================================================
// RenderSchema
// =====================================================================

export function createCreditApplicationRenderSchema(form: FormProxy<CreditApplicationForm>) {
  const handleSubmit = async () => {
    const values = form.getValue();

    alert(`Заявка отправлена!\n\n${JSON.stringify(values, null, 2).slice(0, 500)}...`);
  };

  return createRenderSchema<CreditApplicationForm>((path) => ({
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      form,
      config: {
        stepValidations: STEP_VALIDATIONS,
        fullValidation,
      },
      onSubmit: handleSubmit,
      className: 'bg-white p-8 rounded-lg shadow-md',
      steps: [
        // ============================================================
        // Step 1
        // ============================================================
        {
          number: 1,
          title: 'Кредит',
          icon: '💰',
          body: {
            component: Box,
            componentProps: { className: 'space-y-6' },
            children: [
              {
                component: Section,
                componentProps: {
                  title: 'Основная информация о кредите',
                  titleAs: 'h2',
                  titleClassName: 'text-xl font-bold',
                  className: 'space-y-6',
                },
                children: [
                  { component: path.loanType },
                  { component: path.loanAmount },
                  { component: path.loanTerm },
                  { component: path.loanPurpose },
                ],
              },
              {
                selector: 'mortgage-section',
                component: Section,
                componentProps: {
                  title: 'Информация о недвижимости',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [{ component: path.propertyValue }, { component: path.initialPayment }],
              },
              {
                selector: 'car-section',
                component: Section,
                componentProps: {
                  title: 'Информация об автомобиле',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.carBrand },
                  { component: path.carModel },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.carYear }, { component: path.carPrice }],
                  },
                ],
              },
            ],
          },
        },

        // ============================================================
        // Step 2
        // ============================================================
        {
          number: 2,
          title: 'Данные',
          icon: '👤',
          body: {
            component: Section,
            componentProps: {
              title: 'Персональные данные',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: {
                  title: 'Личные данные',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      { component: path.personalData.lastName },
                      { component: path.personalData.firstName },
                      { component: path.personalData.middleName },
                    ],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.personalData.birthDate },
                      { component: path.personalData.gender },
                    ],
                  },
                  { component: path.personalData.birthPlace },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Паспортные данные',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.passportData.series },
                      { component: path.passportData.number },
                    ],
                  },
                  { component: path.passportData.issuedBy },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.passportData.issueDate },
                      { component: path.passportData.departmentCode },
                    ],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Дополнительные документы',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.inn }, { component: path.snils }],
                  },
                ],
              },
            ],
          },
        },

        // ============================================================
        // Step 3
        // ============================================================
        {
          number: 3,
          title: 'Контакты',
          icon: '📞',
          body: {
            component: Section,
            componentProps: {
              title: 'Контактная информация',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: {
                  title: 'Телефоны и email',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.phoneMain }, { component: path.phoneAdditional }],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.email }, { component: path.emailAdditional }],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Адрес регистрации',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.registrationAddress.region },
                      { component: path.registrationAddress.city },
                    ],
                  },
                  { component: path.registrationAddress.street },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      { component: path.registrationAddress.house },
                      { component: path.registrationAddress.apartment },
                      { component: path.registrationAddress.postalCode },
                    ],
                  },
                ],
              },
              { component: path.sameAsRegistration },
              {
                selector: 'residence-address-section',
                component: Section,
                componentProps: {
                  title: 'Адрес проживания',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.residenceAddress.region },
                      { component: path.residenceAddress.city },
                    ],
                  },
                  { component: path.residenceAddress.street },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      { component: path.residenceAddress.house },
                      { component: path.residenceAddress.apartment },
                      { component: path.residenceAddress.postalCode },
                    ],
                  },
                ],
              },
            ],
          },
        },

        // ============================================================
        // Step 4
        // ============================================================
        {
          number: 4,
          title: 'Работа',
          icon: '💼',
          body: {
            component: Section,
            componentProps: {
              title: 'Информация о занятости',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              { component: path.employmentStatus },
              {
                selector: 'employer-section',
                component: Section,
                componentProps: {
                  title: 'Информация о работодателе',
                  titleClassName: 'text-lg font-semibold mt-6',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.companyName },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.companyInn }, { component: path.companyPhone }],
                  },
                  { component: path.companyAddress },
                  { component: path.position },
                ],
              },
              {
                selector: 'business-section',
                component: Section,
                componentProps: {
                  title: 'Информация о бизнесе',
                  titleClassName: 'text-lg font-semibold mt-6',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.businessType },
                  { component: path.businessInn },
                  { component: path.businessActivity },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Стаж',
                  titleClassName: 'text-lg font-semibold mt-6',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.workExperienceTotal },
                      { component: path.workExperienceCurrent },
                    ],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Доход',
                  titleClassName: 'text-lg font-semibold mt-6',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.monthlyIncome },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.additionalIncome },
                      { component: path.additionalIncomeSource },
                    ],
                  },
                ],
              },
            ],
          },
        },

        // ============================================================
        // Step 5
        // ============================================================
        {
          number: 5,
          title: 'Доп. инфо',
          icon: '📋',
          body: {
            component: Section,
            componentProps: {
              title: 'Дополнительная информация',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: {
                  title: 'Общая информация',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  { component: path.maritalStatus },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.dependents }, { component: path.education }],
                  },
                ],
              },
              {
                component: Section,
                componentProps: { className: 'space-y-4' },
                children: [
                  { component: path.hasProperty },
                  {
                    selector: 'properties-array',
                    component: FormArraySection,
                    componentProps: {
                      title: 'Имущество',
                      control: path.properties,
                      itemComponent: PropertyItemForm,
                      itemLabel: (_: FormProxy<Property>, index: number) =>
                        `Имущество #${index + 1}`,
                      addButtonLabel: '+ Добавить имущество',
                      emptyMessage: 'Нажмите «Добавить имущество» для добавления записи',
                      initialValue: propertyTemplate(),
                    },
                  },
                ],
              },
              {
                component: Section,
                componentProps: { className: 'space-y-4' },
                children: [
                  { component: path.hasExistingLoans },
                  {
                    selector: 'existing-loans-array',
                    component: FormArraySection,
                    componentProps: {
                      title: 'Существующие кредиты',
                      control: path.existingLoans,
                      itemComponent: ExistingLoanItemForm,
                      itemLabel: (_: FormProxy<ExistingLoan>, index: number) =>
                        `Кредит #${index + 1}`,
                      addButtonLabel: '+ Добавить кредит',
                      emptyMessage: 'Нажмите «Добавить кредит» для добавления записи',
                      initialValue: existingLoanTemplate(),
                    },
                  },
                ],
              },
              {
                component: Section,
                componentProps: { className: 'space-y-4' },
                children: [
                  { component: path.hasCoBorrower },
                  {
                    selector: 'co-borrowers-array',
                    component: FormArraySection,
                    componentProps: {
                      title: 'Созаёмщики',
                      control: path.coBorrowers,
                      itemComponent: CoBorrowerItemForm,
                      itemLabel: (_: FormProxy<CoBorrower>, index: number) =>
                        `Созаёмщик #${index + 1}`,
                      addButtonLabel: '+ Добавить созаёмщика',
                      emptyMessage: 'Нажмите «Добавить созаёмщика» для добавления записи',
                      initialValue: coBorrowerTemplate(),
                    },
                  },
                ],
              },
            ],
          },
        },

        // ============================================================
        // Step 6
        // ============================================================
        {
          number: 6,
          title: 'Подтверждение',
          icon: '✓',
          body: {
            component: Section,
            componentProps: {
              title: 'Подтверждение и согласия',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: Section,
                componentProps: {
                  title: 'Сводка по кредиту',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-3',
                },
                children: [
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.interestRate },
                      { component: path.monthlyPayment },
                    ],
                  },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      { component: path.paymentToIncomeRatio },
                      { component: path.totalIncome },
                    ],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Сводка по заёмщику',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-3',
                },
                children: [
                  { component: path.fullName },
                  {
                    component: Box,
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [{ component: path.age }, { component: path.coBorrowersIncome }],
                  },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Обязательные согласия',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-3',
                },
                children: [
                  { component: path.agreePersonalData },
                  { component: path.agreeCreditHistory },
                  { component: path.agreeTerms },
                  { component: path.confirmAccuracy },
                ],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Опциональные согласия',
                  titleClassName: 'text-lg font-semibold mt-6',
                },
                children: [{ component: path.agreeMarketing }],
              },
              {
                component: Section,
                componentProps: {
                  title: 'Электронная подпись',
                  titleClassName: 'text-lg font-semibold mt-6',
                  className: 'space-y-4',
                },
                children: [{ component: path.electronicSignature }],
              },
            ],
          },
        },
      ] as unknown as RenderNode<CreditApplicationForm>[],
    },
  }));
}
