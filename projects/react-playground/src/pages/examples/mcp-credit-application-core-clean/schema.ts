/**
 * Credit Application Form — clean baseline (target=core)
 *
 * Pure @reformer/core + @reformer/ui-kit (FormWizard + FormField).
 * Spec: docs/specs/credit-application-form.md.
 *
 * Built using only the spec + MCP recipes. Architecture inspired by
 * recommended @reformer/core patterns: schema/behavior/validation triple
 * passed to createForm.
 */

import {
  createForm,
  type FormSchema,
  type FormProxy,
  type FieldConfig,
  type ValidationSchemaFn,
  type GroupValidator,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  email,
  minLength,
  maxLength,
  pattern,
  applyWhen,
  validateItems,
  validateGroup,
  validate,
} from '@reformer/core/validators';
import {
  computeFrom,
  enableWhen,
  watchField,
  copyFrom,
  revalidateWhen,
} from '@reformer/core/behaviors';
import { Input, Select, Checkbox, RadioGroup, Textarea, InputMask } from '@reformer/ui-kit';

// ============================================================================
// Domain types
// ============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type Gender = 'male' | 'female';
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'other';

export type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
};

export type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

export type Address = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

export type PropertyItem = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
};

export type ExistingLoanItem = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

export type CoBorrowerItem = {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

export type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | undefined;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | undefined;
  carBrand: string;
  carModel: string;
  carYear: number | undefined;
  carPrice: number | undefined;

  // Step 2
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
  sameEmail: boolean;

  // Step 4
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | undefined;
  workExperienceCurrent: number | undefined;
  monthlyIncome: number | undefined;
  additionalIncome: number | undefined;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;

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
  interestRate: number;
  monthlyPayment: number;
  initialPayment: number | undefined;
  fullName: string;
  age: number | undefined;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

// ============================================================================
// Constants (option lists)
// ============================================================================

const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUSES = [
  { value: 'single', label: 'Холост/не замужем' },
  { value: 'married', label: 'Женат/Замужем' },
  { value: 'divorced', label: 'Разведен(а)' },
  { value: 'widowed', label: 'Вдовец/Вдова' },
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
  { value: 'car', label: 'Автомобиль' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'other', label: 'Иное' },
];

// ============================================================================
// Nested schemas
// ============================================================================

const personalDataSchema: FormSchema<PersonalData> = {
  lastName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Фамилия',
      placeholder: 'Введите фамилию',
      testId: 'personalData-lastName',
    },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Имя',
      placeholder: 'Введите имя',
      testId: 'personalData-firstName',
    },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Отчество',
      placeholder: 'Введите отчество',
      testId: 'personalData-middleName',
    },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дата рождения',
      type: 'date',
      testId: 'personalData-birthDate',
    },
  },
  gender: {
    value: 'male',
    component: RadioGroup,
    componentProps: {
      label: 'Пол',
      options: GENDERS,
      testId: 'personalData-gender',
    },
  },
  birthPlace: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Место рождения',
      placeholder: 'Введите место рождения',
      testId: 'personalData-birthPlace',
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
      testId: 'passportData-series',
    },
  },
  number: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Номер паспорта',
      placeholder: '123456',
      mask: '999999',
      testId: 'passportData-number',
    },
  },
  issueDate: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дата выдачи',
      type: 'date',
      testId: 'passportData-issueDate',
    },
  },
  issuedBy: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Кем выдан',
      placeholder: 'Введите название органа',
      testId: 'passportData-issuedBy',
    },
  },
  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подразделения',
      placeholder: '123-456',
      mask: '999-999',
      testId: 'passportData-departmentCode',
    },
  },
};

const buildAddressSchema = (
  prefix: 'registrationAddress' | 'residenceAddress'
): FormSchema<Address> => ({
  region: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Регион',
      placeholder: 'Введите регион',
      testId: `${prefix}-region`,
    },
  },
  city: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Город',
      placeholder: 'Введите город',
      testId: `${prefix}-city`,
    },
  },
  street: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Улица',
      placeholder: 'Введите улицу',
      testId: `${prefix}-street`,
    },
  },
  house: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дом',
      placeholder: '№',
      testId: `${prefix}-house`,
    },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Квартира',
      placeholder: '№',
      testId: `${prefix}-apartment`,
    },
  },
  postalCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Индекс',
      placeholder: '000000',
      mask: '999999',
      testId: `${prefix}-postalCode`,
    },
  },
});

// Property item schema (template for array of FieldConfig)
const propertyItemSchema = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: PROPERTY_TYPES,
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
      label: 'Оценочная стоимость',
      type: 'number',
      min: 0,
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
};

const existingLoanItemSchema = {
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
      min: 0,
      testId: 'amount',
    },
  } satisfies FieldConfig<number>,
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток задолженности',
      type: 'number',
      min: 0,
      testId: 'remainingAmount',
    },
  } satisfies FieldConfig<number>,
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж',
      type: 'number',
      min: 0,
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
};

const coBorrowerItemSchema = {
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
    } satisfies FieldConfig<string>,
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', testId: 'personalData-firstName' },
    } satisfies FieldConfig<string>,
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
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
        options: GENDERS,
        testId: 'personalData-gender',
      },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Место рождения',
        testId: 'personalData-birthPlace',
      },
    } satisfies FieldConfig<string>,
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
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
      min: 0,
      testId: 'monthlyIncome',
    },
  } satisfies FieldConfig<number>,
};

// ============================================================================
// Main schema
// ============================================================================

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ----- Step 1: Loan basics -----
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
      testId: 'loanType',
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
      testId: 'loanAmount',
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
      testId: 'loanTerm',
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
      testId: 'loanPurpose',
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
      testId: 'propertyValue',
    },
  },
  carBrand: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Например: Toyota',
      testId: 'carBrand',
    },
  },
  carModel: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Например: Camry',
      testId: 'carModel',
    },
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
      testId: 'carYear',
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
      testId: 'carPrice',
    },
  },

  // ----- Step 2: Personal data -----
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН',
      placeholder: '123456789012',
      mask: '999999999999',
      testId: 'inn',
    },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'СНИЛС',
      placeholder: '123-456-789 00',
      mask: '999-999-999 99',
      testId: 'snils',
    },
  },

  // ----- Step 3: Contacts -----
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
      testId: 'phoneMain',
    },
  },
  phoneAdditional: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
      testId: 'phoneAdditional',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      placeholder: 'example@mail.com',
      type: 'email',
      testId: 'email',
    },
    debounce: 500,
  },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дополнительный email',
      placeholder: 'example@mail.com',
      type: 'email',
      testId: 'emailAdditional',
    },
  },
  registrationAddress: buildAddressSchema('registrationAddress'),
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: {
      label: 'Адрес проживания совпадает с адресом регистрации',
      testId: 'sameAsRegistration',
    },
  },
  residenceAddress: buildAddressSchema('residenceAddress'),
  sameEmail: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Дублировать основной email',
      testId: 'sameEmail',
    },
  },

  // ----- Step 4: Employment -----
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_STATUSES,
      testId: 'employmentStatus',
    },
  },
  companyName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Название компании',
      placeholder: 'Введите название',
      testId: 'companyName',
    },
  },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН компании',
      placeholder: '1234567890',
      mask: '9999999999',
      testId: 'companyInn',
    },
  },
  companyPhone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
      testId: 'companyPhone',
    },
  },
  companyAddress: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Адрес компании',
      placeholder: 'Полный адрес',
      testId: 'companyAddress',
    },
  },
  position: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Должность',
      placeholder: 'Ваша должность',
      testId: 'position',
    },
  },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
      testId: 'workExperienceTotal',
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
      testId: 'workExperienceCurrent',
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
      testId: 'monthlyIncome',
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
      testId: 'additionalIncome',
    },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Источник дополнительного дохода',
      placeholder: 'Опишите источник',
      testId: 'additionalIncomeSource',
    },
  },
  businessType: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Тип бизнеса',
      placeholder: 'ИП, ООО и т.д.',
      testId: 'businessType',
    },
  },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН ИП',
      placeholder: '123456789012',
      mask: '999999999999',
      testId: 'businessInn',
    },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Вид деятельности',
      placeholder: 'Опишите вид деятельности',
      rows: 3,
      testId: 'businessActivity',
    },
  },

  // ----- Step 5: Additional info -----
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: MARITAL_STATUSES,
      testId: 'maritalStatus',
    },
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
      testId: 'dependents',
    },
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
  },
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'У меня есть имущество',
      testId: 'hasProperty',
    },
  },
  properties: [propertyItemSchema],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'У меня есть другие кредиты',
      testId: 'hasExistingLoans',
    },
  },
  existingLoans: [existingLoanItemSchema],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Добавить созаемщика',
      testId: 'hasCoBorrower',
    },
  },
  coBorrowers: [coBorrowerItemSchema],

  // ----- Step 6: Confirmation / consents -----
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
    componentProps: {
      label: 'Согласие с условиями кредитования',
      testId: 'agreeTerms',
    },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Подтверждаю точность введенных данных',
      testId: 'confirmAccuracy',
    },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подтверждения из СМС',
      placeholder: '123456',
      mask: '999999',
      testId: 'electronicSignature',
    },
  },

  // ----- Computed (readonly) -----
  interestRate: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'interestRate',
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'monthlyPayment',
    },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'initialPayment',
    },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Полное имя',
      readonly: true,
      disabled: true,
      testId: 'fullName',
    },
  },
  age: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Возраст (лет)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'age',
    },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий доход (₽)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'totalIncome',
    },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процент платежа от дохода (%)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'paymentToIncomeRatio',
    },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Доход созаемщиков (₽)',
      type: 'number',
      readonly: true,
      disabled: true,
      testId: 'coBorrowersIncome',
    },
  },
};

// ============================================================================
// Behaviors
// ============================================================================

const interestRateByLoanType: Record<LoanType, number> = {
  consumer: 14.5,
  mortgage: 8.5,
  car: 12,
  business: 13,
  refinancing: 10,
};

function annuity(amount: number, months: number, ratePct: number): number {
  if (!amount || !months || !ratePct) return 0;
  const i = ratePct / 100 / 12;
  if (i === 0) return amount / months;
  const pow = Math.pow(1 + i, months);
  return Math.round((amount * (i * pow)) / (pow - 1));
}

function diffYears(birthIso: string): number | null {
  if (!birthIso) return null;
  const birth = new Date(birthIso);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years;
}

const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ---- copyFrom ----
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // ---- enableWhen: mortgage-specific ----
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // ---- enableWhen: car-specific ----
  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

  // ---- enableWhen: employed ----
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

  // ---- enableWhen: self-employed ----
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });

  // ---- enableWhen: residence address ----
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });

  // ---- computeFrom: interestRate (depends on loanType, registrationAddress, hasProperty) ----
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty],
    path.interestRate,
    ({ loanType, registrationAddress, hasProperty }: CreditApplicationForm) => {
      let rate = interestRateByLoanType[loanType] ?? 12;
      // Region-based discount
      if (registrationAddress?.region?.toLowerCase().includes('москв')) {
        rate -= 0.5;
      }
      // Discount when borrower has collateral property
      if (hasProperty) {
        rate -= 0.25;
      }
      return Math.max(rate, 1);
    }
  );

  // ---- computeFrom: monthlyPayment ----
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) => {
      if (!loanAmount || !loanTerm || !interestRate) return 0;
      return annuity(loanAmount, loanTerm, interestRate);
    }
  );

  // ---- computeFrom: initialPayment (20% of propertyValue) ----
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) => {
      if (!propertyValue) return null;
      return Math.round(propertyValue * 0.2);
    }
  );

  // ---- computeFrom: fullName ----
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName]
      .filter(Boolean)
      .join(' ')
      .trim()
  );

  // ---- computeFrom: age ----
  computeFrom([path.personalData], path.age, ({ personalData }: CreditApplicationForm) =>
    diffYears(personalData.birthDate)
  );

  // ---- computeFrom: coBorrowersIncome ----
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, cb) => sum + (Number(cb?.monthlyIncome) || 0), 0)
  );

  // ---- computeFrom: totalIncome ----
  computeFrom(
    [path.monthlyIncome, path.additionalIncome, path.coBorrowersIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome, coBorrowersIncome }: CreditApplicationForm) =>
      (Number(monthlyIncome) || 0) +
      (Number(additionalIncome) || 0) +
      (Number(coBorrowersIncome) || 0)
  );

  // ---- computeFrom: paymentToIncomeRatio ----
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome || totalIncome <= 0) return 0;
      return Math.round((monthlyPayment / totalIncome) * 1000) / 10;
    }
  );

  // ---- revalidateWhen ----
  revalidateWhen(path.workExperienceCurrent, [path.workExperienceTotal]);
  revalidateWhen(path.initialPayment, [path.propertyValue]);

  // ---- watchField: clear array on checkbox uncheck ----
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        ctx.form.properties?.clear();
      }
    },
    { immediate: false }
  );

  watchField(
    path.hasExistingLoans,
    (hasExistingLoans, ctx) => {
      if (!hasExistingLoans) {
        ctx.form.existingLoans?.clear();
      }
    },
    { immediate: false }
  );

  watchField(
    path.hasCoBorrower,
    (hasCoBorrower, ctx) => {
      if (!hasCoBorrower) {
        ctx.form.coBorrowers?.clear();
      }
    },
    { immediate: false }
  );

  // ---- watchField: dynamic limit on loanAmount.max from totalIncome ----
  watchField(
    path.totalIncome,
    (totalIncome, ctx) => {
      if (totalIncome && totalIncome > 0) {
        const maxLoanAmount = Math.min(totalIncome * 12 * 10, 10000000);
        queueMicrotask(() => {
          ctx.form.loanAmount.updateComponentProps({ max: maxLoanAmount });
        });
      }
    },
    { immediate: false }
  );

  // ---- watchField: dynamic limit on loanTerm.max from age ----
  watchField(
    path.age,
    (age, ctx) => {
      if (age && age >= 18) {
        const maxTermYears = Math.max(70 - age, 1);
        const maxTermMonths = Math.min(maxTermYears * 12, 240);
        queueMicrotask(() => {
          ctx.form.loanTerm.updateComponentProps({ max: maxTermMonths });
        });
      }
    },
    { immediate: false }
  );

  // ---- watchField: clear carModel when carBrand changes ----
  watchField(
    path.carBrand,
    (_brand, ctx) => {
      ctx.form.carModel.reset();
    },
    { immediate: false, debounce: 300 }
  );

  // ---- watchField: clear city when region changes ----
  watchField(
    path.registrationAddress.region,
    (_region, ctx) => {
      ctx.form.registrationAddress.city.setValue('');
    },
    { immediate: false }
  );
};

// ============================================================================
// Validation (per step + cross-field)
// ============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required({ message: 'Выберите тип кредита' }));
  validate(path.loanAmount, required({ message: 'Укажите сумму кредита' }));
  validate(path.loanAmount, min(50000, { message: 'Минимум 50 000 ₽' }));
  validate(path.loanAmount, max(10000000, { message: 'Максимум 10 000 000 ₽' }));
  validate(path.loanTerm, required({ message: 'Укажите срок кредита' }));
  validate(path.loanTerm, min(6, { message: 'Минимум 6 месяцев' }));
  validate(path.loanTerm, max(240, { message: 'Максимум 240 месяцев' }));
  validate(path.loanPurpose, required({ message: 'Опишите цель кредита' }));
  validate(path.loanPurpose, minLength(10, { message: 'Минимум 10 символов' }));
  validate(path.loanPurpose, maxLength(500, { message: 'Максимум 500 символов' }));

  // Mortgage-specific
  applyWhen(
    path.loanType,
    (lt) => lt === 'mortgage',
    (p) => {
      validate(p.propertyValue, required({ message: 'Укажите стоимость недвижимости' }));
      validate(p.propertyValue, min(1000000, { message: 'Минимум 1 000 000 ₽' }));
    }
  );

  // loanAmount must not exceed (propertyValue - initialPayment) — cross-field
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (form.loanType !== 'mortgage') return null;
      if (!form.propertyValue || !form.loanAmount) return null;
      const initialPay = form.initialPayment ?? form.propertyValue * 0.2;
      if (form.loanAmount > form.propertyValue - initialPay) {
        return {
          code: 'loanAmountTooHigh',
          message: 'Сумма кредита превышает стоимость минус первоначальный взнос',
        };
      }
      return null;
    },
    { targetField: path.loanAmount }
  );

  // Car-specific
  applyWhen(
    path.loanType,
    (lt) => lt === 'car',
    (p) => {
      validate(p.carBrand, required({ message: 'Укажите марку автомобиля' }));
      validate(p.carBrand, minLength(2, { message: 'Минимум 2 символа' }));
      validate(p.carBrand, maxLength(50, { message: 'Максимум 50 символов' }));
      validate(p.carModel, required({ message: 'Укажите модель' }));
      validate(p.carModel, maxLength(50, { message: 'Максимум 50 символов' }));
      validate(p.carYear, required({ message: 'Укажите год выпуска' }));
      validate(p.carYear, min(2000, { message: 'Минимум 2000 год' }));
      validate(
        p.carYear,
        max(new Date().getFullYear() + 1, {
          message: 'Год выпуска некорректен',
        })
      );
      validate(p.carPrice, required({ message: 'Укажите стоимость автомобиля' }));
      validate(p.carPrice, min(300000, { message: 'Минимум 300 000 ₽' }));
      validate(p.carPrice, max(10000000, { message: 'Максимум 10 000 000 ₽' }));
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.personalData.lastName, required({ message: 'Укажите фамилию' }));
  validate(path.personalData.firstName, required({ message: 'Укажите имя' }));
  validate(path.personalData.middleName, required({ message: 'Укажите отчество' }));
  validate(path.personalData.birthDate, required({ message: 'Укажите дату рождения' }));
  validate(path.personalData.gender, required({ message: 'Укажите пол' }));
  validate(path.personalData.birthPlace, required({ message: 'Укажите место рождения' }));

  validate(path.passportData.series, required({ message: 'Укажите серию паспорта' }));
  validate(
    path.passportData.series,
    pattern(/^\d{2}\s?\d{2}$/, {
      message: 'Серия должна содержать 4 цифры',
    })
  );
  validate(path.passportData.number, required({ message: 'Укажите номер паспорта' }));
  validate(
    path.passportData.number,
    pattern(/^\d{6}$/, {
      message: 'Номер должен содержать 6 цифр',
    })
  );
  validate(path.passportData.issueDate, required({ message: 'Укажите дату выдачи' }));
  validate(path.passportData.issuedBy, required({ message: 'Укажите кем выдан' }));
  validate(path.passportData.departmentCode, required({ message: 'Укажите код подразделения' }));
  validate(
    path.passportData.departmentCode,
    pattern(/^\d{3}-?\d{3}$/, {
      message: 'Формат: 000-000',
    })
  );

  validate(path.inn, required({ message: 'Укажите ИНН' }));
  validate(path.inn, pattern(/^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' }));
  validate(path.snils, required({ message: 'Укажите СНИЛС' }));
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.phoneMain, required({ message: 'Укажите основной телефон' }));
  validate(
    path.phoneMain,
    pattern(/^\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}$/, {
      message: 'Неверный формат телефона',
    })
  );
  validate(path.email, required({ message: 'Укажите email' }));
  validate(path.email, email({ message: 'Неверный формат email' }));

  validate(path.registrationAddress.region, required({ message: 'Укажите регион' }));
  validate(path.registrationAddress.city, required({ message: 'Укажите город' }));
  validate(path.registrationAddress.street, required({ message: 'Укажите улицу' }));
  validate(path.registrationAddress.house, required({ message: 'Укажите дом' }));
  validate(path.registrationAddress.postalCode, required({ message: 'Укажите индекс' }));
  validate(path.registrationAddress.postalCode, pattern(/^\d{6}$/, { message: '6 цифр' }));

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      validate(p.residenceAddress.region, required({ message: 'Укажите регион' }));
      validate(p.residenceAddress.city, required({ message: 'Укажите город' }));
      validate(p.residenceAddress.street, required({ message: 'Укажите улицу' }));
      validate(p.residenceAddress.house, required({ message: 'Укажите дом' }));
      validate(p.residenceAddress.postalCode, required({ message: 'Укажите индекс' }));
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.employmentStatus, required({ message: 'Укажите статус занятости' }));
  validate(path.workExperienceTotal, required({ message: 'Укажите общий стаж' }));
  validate(path.workExperienceTotal, min(0, { message: 'Не может быть отрицательным' }));
  validate(path.workExperienceCurrent, required({ message: 'Укажите стаж на текущем месте' }));
  validate(path.workExperienceCurrent, min(0, { message: 'Не может быть отрицательным' }));

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (form.workExperienceCurrent == null || form.workExperienceTotal == null) return null;
      if (form.workExperienceCurrent > form.workExperienceTotal) {
        return {
          code: 'currentExceedsTotal',
          message: 'Стаж на текущем месте не может быть больше общего стажа',
        };
      }
      return null;
    },
    { targetField: path.workExperienceCurrent }
  );

  validate(path.monthlyIncome, required({ message: 'Укажите ежемесячный доход' }));
  validate(path.monthlyIncome, min(10000, { message: 'Минимум 10 000 ₽' }));

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      validate(p.companyName, required({ message: 'Укажите название компании' }));
      validate(p.companyInn, required({ message: 'Укажите ИНН компании' }));
      validate(p.companyInn, pattern(/^\d{10}$/, { message: 'ИНН компании — 10 цифр' }));
      validate(p.position, required({ message: 'Укажите должность' }));
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      validate(p.businessType, required({ message: 'Укажите тип бизнеса' }));
      validate(p.businessInn, required({ message: 'Укажите ИНН ИП' }));
      validate(p.businessInn, pattern(/^\d{12}$/, { message: 'ИНН ИП — 12 цифр' }));
    }
  );

  applyWhen(
    path.additionalIncome,
    (ai) => Boolean(ai && ai > 0),
    (p) => {
      validate(
        p.additionalIncomeSource,
        required({
          message: 'Укажите источник дополнительного дохода',
        })
      );
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.maritalStatus, required({ message: 'Укажите семейное положение' }));
  validate(path.dependents, required({ message: 'Укажите количество иждивенцев' }));
  validate(path.dependents, min(0, { message: 'Не может быть отрицательным' }));
  validate(path.dependents, max(10, { message: 'Максимум 10' }));
  validate(path.education, required({ message: 'Укажите образование' }));

  // Properties array (validated when checkbox is on)
  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (item) => {
        validate(item.type, required({ message: 'Выберите тип имущества' }));
        validate(item.description, required({ message: 'Опишите имущество' }));
        validate(item.estimatedValue, min(0, { message: 'Не может быть отрицательным' }));
      });
    }
  );

  // Existing loans array
  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (item) => {
        validate(item.bank, required({ message: 'Укажите банк' }));
        validate(item.type, required({ message: 'Укажите тип кредита' }));
        validate(item.amount, required({ message: 'Укажите сумму кредита' }));
        validate(item.amount, min(0, { message: 'Не может быть отрицательным' }));
        validate(item.remainingAmount, required({ message: 'Укажите остаток' }));
        validate(item.remainingAmount, min(0, { message: 'Не может быть отрицательным' }));
        validate(item.monthlyPayment, required({ message: 'Укажите ежемесячный платеж' }));
        validate(item.monthlyPayment, min(0, { message: 'Не может быть отрицательным' }));
        validate(item.maturityDate, required({ message: 'Укажите дату погашения' }));
      });
    }
  );

  // Co-borrowers array
  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, (item) => {
        validate(item.personalData.lastName, required({ message: 'Укажите фамилию' }));
        validate(item.personalData.firstName, required({ message: 'Укажите имя' }));
        validate(item.phone, required({ message: 'Укажите телефон' }));
        validate(item.email, required({ message: 'Укажите email' }));
        validate(item.email, email({ message: 'Неверный формат email' }));
        validate(item.relationship, required({ message: 'Укажите родство' }));
        validate(item.monthlyIncome, required({ message: 'Укажите доход' }));
        validate(item.monthlyIncome, min(0, { message: 'Не может быть отрицательным' }));
      });
    }
  );
};

const requireTrue =
  (field: keyof CreditApplicationForm, message: string): GroupValidator<CreditApplicationForm> =>
  (scope) => {
    const v = scope.getValue()[field];
    return v === true ? null : { code: 'mustBeTrue', message };
  };

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validateGroup(path, requireTrue('agreePersonalData', 'Необходимо согласие'), {
    targetField: path.agreePersonalData,
  });
  validateGroup(path, requireTrue('agreeCreditHistory', 'Необходимо согласие'), {
    targetField: path.agreeCreditHistory,
  });
  validateGroup(path, requireTrue('agreeTerms', 'Необходимо согласие'), {
    targetField: path.agreeTerms,
  });
  validateGroup(path, requireTrue('confirmAccuracy', 'Необходимо подтверждение'), {
    targetField: path.confirmAccuracy,
  });

  validate(path.electronicSignature, required({ message: 'Введите код из СМС' }));
  validate(path.electronicSignature, pattern(/^\d{6}$/, { message: '6 цифр' }));
};

// Cross-field validations applied to whole form
const crossFieldValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Age range 18..70
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (form.age == null) return null;
      if (form.age < 18 || form.age > 70) {
        return {
          code: 'ageOutOfRange',
          message: 'Возраст должен быть от 18 до 70 лет',
        };
      }
      return null;
    },
    { targetField: path.age }
  );

  // Payment-to-income ratio <= 50%
  validateGroup(
    path,
    (scope) => {
      const form = scope.getValue();
      if (!form.paymentToIncomeRatio) return null;
      if (form.paymentToIncomeRatio > 50) {
        return {
          code: 'paymentRatioTooHigh',
          message: 'Ежемесячный платеж не должен превышать 50% от дохода',
        };
      }
      return null;
    },
    { targetField: path.monthlyPayment }
  );
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
  crossFieldValidation(path);
};

// ============================================================================
// Factory
// ============================================================================

export const createCreditApplicationForm = (): FormProxy<CreditApplicationForm> =>
  createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: fullValidation,
  });
