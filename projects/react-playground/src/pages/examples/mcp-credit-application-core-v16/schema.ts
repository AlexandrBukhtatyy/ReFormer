/**
 * Credit application form — iter-16 / target=core
 *
 * Generated through MCP-only sandbox (no peeking into reformer/* sources).
 * Implements the full spec in docs/specs/credit-application-form.md.
 */

import {
  createForm,
  type AsyncValidatorFn,
  type FieldConfig,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  email as emailValidator,
  validate,
  applyWhen as applyWhenValidator,
  validateItems,
} from '@reformer/core/validators';
import {
  computeFrom,
  enableWhen,
  watchField,
  copyFrom,
} from '@reformer/core/behaviors';
import {
  Input,
  Select,
  Checkbox,
  RadioGroup,
  Textarea,
  InputMask,
} from '@reformer/ui-kit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type Gender = 'male' | 'female';
export type EmploymentStatus =
  | 'employed'
  | 'selfEmployed'
  | 'unemployed'
  | 'retired'
  | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'other';

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

export type CoBorrowerPersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
};

export type CoBorrowerItem = {
  personalData: CoBorrowerPersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

export type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
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
  education: Education;
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

  // Computed (readonly)
  fullName: string;
  age: number | null;
  interestRate: number;
  monthlyPayment: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

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
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Не женат / не замужем' },
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
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Иное' },
];

const REGION_OPTIONS = [
  { value: 'moscow', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'novosibirsk', label: 'Новосибирская область' },
  { value: 'sverdlovsk', label: 'Свердловская область' },
];

// ---------------------------------------------------------------------------
// Mock async APIs (per spec — replaced with promise + setTimeout)
// ---------------------------------------------------------------------------

async function fetchCitiesByRegion(region: string): Promise<{ value: string; label: string }[]> {
  await new Promise((r) => setTimeout(r, 250));
  const map: Record<string, { value: string; label: string }[]> = {
    moscow: [
      { value: 'moscow', label: 'Москва' },
      { value: 'zelenograd', label: 'Зеленоград' },
    ],
    spb: [
      { value: 'spb', label: 'Санкт-Петербург' },
      { value: 'pushkin', label: 'Пушкин' },
    ],
    novosibirsk: [
      { value: 'novosibirsk', label: 'Новосибирск' },
      { value: 'berdsk', label: 'Бердск' },
    ],
    sverdlovsk: [
      { value: 'ekb', label: 'Екатеринбург' },
      { value: 'nt', label: 'Нижний Тагил' },
    ],
  };
  return map[region] ?? [];
}

async function fetchCarModelsByBrand(brand: string): Promise<{ value: string; label: string }[]> {
  await new Promise((r) => setTimeout(r, 250));
  const map: Record<string, string[]> = {
    Toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander'],
    BMW: ['3-Series', '5-Series', 'X3', 'X5'],
    Lada: ['Vesta', 'Granta', 'Niva'],
    Hyundai: ['Solaris', 'Tucson', 'Creta'],
  };
  const items = map[brand] ?? [];
  return items.map((m) => ({ value: m, label: m }));
}

const checkEmailUnique: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 250));
  const taken = ['taken@example.com', 'admin@bank.ru'];
  return taken.includes(value.toLowerCase())
    ? { code: 'email-taken', message: 'Email уже зарегистрирован' }
    : null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear();

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function annuity(amount: number, term: number, ratePct: number): number {
  if (!amount || !term || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return Math.round(amount / term);
  return Math.round((amount * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1));
}

function calcInterestRate(
  loanType: LoanType,
  region: string,
  hasProperty: boolean,
  propertiesCount: number,
): number {
  const base: Record<LoanType, number> = {
    consumer: 17,
    mortgage: 9,
    car: 12,
    business: 15,
    refinance: 14,
  };
  let rate = base[loanType] ?? 17;
  // Regional adjustment
  if (region === 'moscow' || region === 'spb') rate -= 0.5;
  // Property adjustment
  if (!hasProperty || propertiesCount === 0) rate += 0.5;
  return Math.round(rate * 100) / 100;
}

export function createEmptyPropertyItem(): PropertyItem {
  return {
    type: 'apartment',
    description: '',
    estimatedValue: 0,
    hasEncumbrance: false,
  };
}

export function createEmptyExistingLoan(): ExistingLoanItem {
  return {
    bank: '',
    type: '',
    amount: 0,
    remainingAmount: 0,
    monthlyPayment: 0,
    maturityDate: '',
  };
}

export function createEmptyCoBorrower(): CoBorrowerItem {
  return {
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
  };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema: FormSchema<CreditApplicationForm> = {
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
    componentProps: {
      label: 'Сумма кредита (₽)',
      type: 'number',
      placeholder: 'Введите сумму',
      step: 10000,
    },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Срок кредита (месяцев)',
      type: 'number',
      placeholder: 'Введите срок',
    },
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
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
    },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      type: 'number',
      placeholder: 'Введите сумму',
      readOnly: true,
      disabled: true,
    },
  },
  carBrand: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Например: Toyota',
    },
  },
  carModel: {
    value: null,
    component: Select,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Например: Camry',
      options: [],
    },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      type: 'number',
      placeholder: '2020',
    },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
    },
  },

  // Step 2 — personalData
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
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { label: 'Пол', options: GENDER_OPTIONS },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
    },
  },

  // Step 2 — passportData
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Серия паспорта', mask: '99 99', placeholder: '12 34' },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Номер паспорта', mask: '999999', placeholder: '123456' },
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
      componentProps: { label: 'Код подразделения', mask: '999-999', placeholder: '123-456' },
    },
  },

  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', mask: '999999999999', placeholder: '123456789012' },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: { label: 'СНИЛС', mask: '999-999-999 99', placeholder: '123-456-789 00' },
  },

  // Step 3
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
    },
  },
  phoneAdditional: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
    asyncValidators: [checkEmailUnique],
    debounce: 500,
  },
  emailAdditional: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email', placeholder: 'example@mail.com' },
  },

  registrationAddress: {
    region: {
      value: '',
      component: Select,
      componentProps: { label: 'Регион', placeholder: 'Введите регион', options: REGION_OPTIONS },
    },
    city: {
      value: '',
      component: Select,
      componentProps: { label: 'Город', placeholder: 'Введите город', options: [] },
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
      componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000' },
    },
  },

  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },

  residenceAddress: {
    region: {
      value: '',
      component: Select,
      componentProps: { label: 'Регион', placeholder: 'Введите регион', options: REGION_OPTIONS },
    },
    city: {
      value: '',
      component: Select,
      componentProps: { label: 'Город', placeholder: 'Введите город', options: [] },
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
      componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000' },
    },
  },

  // Step 4
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_OPTIONS },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: null,
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  companyInn: {
    value: null,
    component: InputMask,
    componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890' },
  },
  companyPhone: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
    },
  },
  companyAddress: {
    value: null,
    component: Input,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
  },
  position: {
    value: null,
    component: Input,
    componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
  },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number', placeholder: '0' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number', placeholder: '0' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number', placeholder: '0' },
  },
  additionalIncomeSource: {
    value: null,
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
  },
  businessType: {
    value: null,
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
  },
  businessInn: {
    value: null,
    component: InputMask,
    componentProps: { label: 'ИНН ИП', mask: '999999999999', placeholder: '123456789012' },
  },
  businessActivity: {
    value: null,
    component: Textarea,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3 },
  },

  // Step 5
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_OPTIONS },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', placeholder: '0' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATION_OPTIONS,
    },
  } satisfies FieldConfig<Education>,
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
          placeholder: 'Выберите тип',
          options: PROPERTY_TYPE_OPTIONS,
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Оценочная стоимость', type: 'number', placeholder: '0' },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Имеется обременение (залог)' },
      },
    },
  ],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты' },
  },
  existingLoans: [
    {
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
        componentProps: { label: 'Сумма кредита', type: 'number', placeholder: '0' },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Остаток задолженности', type: 'number', placeholder: '0' },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платеж', type: 'number', placeholder: '0' },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата погашения', type: 'date' },
      },
    },
  ],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаемщика' },
  },
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Фамилия' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество' },
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
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
      },
      relationship: {
        value: '',
        component: Input,
        componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход', type: 'number', placeholder: '0' },
      },
    },
  ],

  // Step 6
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласен на обработку персональных данных' },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласен на проверку кредитной истории' },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласен на получение маркетинговых материалов' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласен с условиями кредитования' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных' },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подтверждения из СМС', mask: '999999', placeholder: '123456' },
  },

  // Computed (readonly)
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
  interestRate: {
    value: 17,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true, disabled: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number', readOnly: true, disabled: true },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true, disabled: true },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процент платежа от дохода (%)', type: 'number', readOnly: true, disabled: true },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаемщиков (₽)', type: 'number', readOnly: true, disabled: true },
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимум 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимум 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhenValidator(
    path.loanType,
    (loanType) => loanType === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимум 1 000 000 ₽' });
      // initialPayment min 20% от propertyValue — cross-field
      validate(p.initialPayment, (value, ctx) => {
        const pv = ctx.form.propertyValue.value.value as number | null;
        if (pv != null && value != null && value < pv * 0.2) {
          return {
            code: 'initial-payment-min',
            message: 'Первоначальный взнос должен быть минимум 20% от стоимости',
          };
        }
        return null;
      });
      // loanAmount <= propertyValue - initialPayment
      validate(p.loanAmount, (value, ctx) => {
        const pv = ctx.form.propertyValue.value.value as number | null;
        const ip = ctx.form.initialPayment.value.value as number | null;
        if (pv != null && ip != null && value != null && value > pv - ip) {
          return {
            code: 'loan-exceeds-property',
            message: 'Сумма кредита не может превышать стоимость минус первоначальный взнос',
          };
        }
        return null;
      });
    },
  );

  applyWhenValidator(
    path.loanType,
    (loanType) => loanType === 'car',
    (p) => {
      required(p.carBrand, { message: 'Введите марку автомобиля' });
      minLength(p.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(p.carBrand, 50, { message: 'Максимум 50 символов' });
      required(p.carModel, { message: 'Выберите модель' });
      required(p.carYear, { message: 'Введите год выпуска' });
      min(p.carYear, 2000, { message: 'Минимум 2000 год' });
      max(p.carYear, CURRENT_YEAR + 1, { message: `Максимум ${CURRENT_YEAR + 1} год` });
      required(p.carPrice, { message: 'Введите стоимость' });
      min(p.carPrice, 300000, { message: 'Минимум 300 000 ₽' });
      max(p.carPrice, 10000000, { message: 'Максимум 10 000 000 ₽' });
    },
  );
};

export const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Введите дату рождения' });
  required(path.personalData.gender, { message: 'Выберите пол' });
  required(path.personalData.birthPlace, { message: 'Введите место рождения' });

  required(path.passportData.series, { message: 'Введите серию' });
  pattern(path.passportData.series, /^\d{2} \d{2}$/, { message: 'Формат: 99 99' });
  required(path.passportData.number, { message: 'Введите номер' });
  pattern(path.passportData.number, /^\d{6}$/, { message: 'Формат: 999999' });
  required(path.passportData.issueDate, { message: 'Введите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Введите название органа' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });
  pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, { message: 'Формат: 999-999' });

  required(path.inn, { message: 'Введите ИНН' });
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
  required(path.snils, { message: 'Введите СНИЛС' });
  pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'Формат: 999-999-999 99' });

  // Cross-field: age 18..70 (computed)
  validate(path.age, (value) => {
    if (value == null) return null;
    if (value < 18) return { code: 'age-min', message: 'Заемщик должен быть старше 18 лет' };
    if (value > 70) return { code: 'age-max', message: 'Возраст не должен превышать 70 лет' };
    return null;
  });
};

export const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите телефон' });
  pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Формат: +7 (999) 999-99-99',
  });

  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Неверный формат email' });

  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите дом' });
  required(path.registrationAddress.postalCode, { message: 'Введите индекс' });
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, { message: 'Индекс — 6 цифр' });

  applyWhenValidator(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region, { message: 'Введите регион' });
      required(p.residenceAddress.city, { message: 'Введите город' });
      required(p.residenceAddress.street, { message: 'Введите улицу' });
      required(p.residenceAddress.house, { message: 'Введите дом' });
      required(p.residenceAddress.postalCode, { message: 'Введите индекс' });
      pattern(p.residenceAddress.postalCode, /^\d{6}$/, { message: 'Индекс — 6 цифр' });
    },
  );
};

export const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value as number | null;
    if (total != null && value != null && value > total) {
      return {
        code: 'experience-mismatch',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      };
    }
    return null;
  });

  required(path.monthlyIncome, { message: 'Введите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });

  // Conditional required: additionalIncomeSource when additionalIncome > 0
  validate(path.additionalIncomeSource, (value, ctx) => {
    const inc = ctx.form.additionalIncome.value.value as number | null;
    if (inc != null && inc > 0 && (!value || value === '')) {
      return {
        code: 'source-required',
        message: 'Укажите источник дополнительного дохода',
      };
    }
    return null;
  });

  applyWhenValidator(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН — 10 цифр' });
      required(p.position, { message: 'Введите должность' });
    },
  );

  applyWhenValidator(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Введите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН ИП' });
      pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН ИП — 12 цифр' });
    },
  );

  // paymentToIncomeRatio <= 50%
  validate(path.paymentToIncomeRatio, (value) => {
    if (value != null && value > 50) {
      return {
        code: 'ratio-too-high',
        message: 'Платеж не должен превышать 50% от дохода',
      };
    }
    return null;
  });
};

export const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Выберите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education, { message: 'Выберите образование' });

  applyWhenValidator(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (itemPath) => {
        required(itemPath.type);
        required(itemPath.description);
        required(itemPath.estimatedValue);
        min(itemPath.estimatedValue, 0);
      });
    },
  );

  applyWhenValidator(
    path.hasExistingLoans,
    (v) => v === true,
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

        // Cross-field: remainingAmount <= amount
        validate(itemPath.remainingAmount, (value, ctx) => {
          const amount = ctx.form.amount.value.value as number;
          if (amount != null && value != null && value > amount) {
            return {
              code: 'remaining-too-large',
              message: 'Остаток не может превышать сумму кредита',
            };
          }
          return null;
        });
      });
    },
  );

  applyWhenValidator(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, (itemPath) => {
        required(itemPath.personalData.lastName);
        required(itemPath.personalData.firstName);
        required(itemPath.personalData.middleName);
        required(itemPath.personalData.birthDate);
        required(itemPath.phone);
        pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
          message: 'Формат телефона некорректен',
        });
        required(itemPath.email);
        emailValidator(itemPath.email);
        required(itemPath.relationship);
        required(itemPath.monthlyIncome);
        min(itemPath.monthlyIncome, 0);
      });
    },
  );
};

export const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие' });
  required(path.agreeCreditHistory, { message: 'Необходимо согласие' });
  required(path.agreeTerms, { message: 'Необходимо согласие' });
  required(path.confirmAccuracy, { message: 'Подтвердите точность данных' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код — 6 цифр' });
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

// ---------------------------------------------------------------------------
// Behavior
// ---------------------------------------------------------------------------

export const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // -- Conditional enable/disable -- ---------------------------------------
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', { resetOnDisable: true });
  // initialPayment is computed-only (kept enabled for compute write but UI disabled)

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

  // -- Copy registrationAddress → residenceAddress -- -----------------------
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // -- Computed fields -- ---------------------------------------------------

  // C.4 fullName ← personalData
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' '),
  );

  // C.5 age ← personalData.birthDate (group-node subscription per common-mistakes recipe)
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => calcAge(personalData.birthDate),
  );

  // C.3 initialPayment ← propertyValue × 0.20
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue != null ? Math.round(propertyValue * 0.2) : null,
    { condition: (form) => form.loanType === 'mortgage' },
  );

  // C.1 interestRate ← loanType, registrationAddress, hasProperty, properties
  // cross-level + array source → watchField multiple triggers
  function recomputeInterestRate(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const loanType = ctx.form.loanType.value.value;
    const region = ctx.form.registrationAddress.region.value.value;
    const hasProperty = ctx.form.hasProperty.value.value;
    const properties = ctx.form.properties.value.value;
    const propsCount = Array.isArray(properties) ? properties.length : 0;
    const newRate = calcInterestRate(loanType, region, hasProperty, propsCount);
    if (Math.abs(ctx.form.interestRate.value.value - newRate) > 0.001) {
      ctx.form.interestRate.setValue(newRate);
    }
  }
  watchField(path.loanType, (_v, ctx) => recomputeInterestRate(ctx), { immediate: false });
  watchField(path.registrationAddress.region, (_v, ctx) => recomputeInterestRate(ctx), {
    immediate: false,
  });
  watchField(path.hasProperty, (_v, ctx) => recomputeInterestRate(ctx), { immediate: false });

  // C.2 monthlyPayment ← loanAmount, loanTerm, interestRate
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuity(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0),
  );

  // C.6 totalIncome ← monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0),
  );

  // C.7 paymentToIncomeRatio ← monthlyPayment / totalIncome × 100
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome || totalIncome === 0) return 0;
      return Math.round(((monthlyPayment ?? 0) / totalIncome) * 10000) / 100;
    },
  );

  // C.8 coBorrowersIncome ← sum of coBorrowers[].monthlyIncome (cross-level / array)
  function recomputeCoBorrowersIncome(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const items = ctx.form.coBorrowers.value.value;
    const sum = Array.isArray(items)
      ? items.reduce((s, item) => s + (Number(item?.monthlyIncome) || 0), 0)
      : 0;
    if (ctx.form.coBorrowersIncome.value.value !== sum) {
      ctx.form.coBorrowersIncome.setValue(sum);
    }
  }
  watchField(path.coBorrowers, (_v, ctx) => recomputeCoBorrowersIncome(ctx), {
    immediate: false,
  });

  // -- Async options loading -- ---------------------------------------------
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      ctx.form.registrationAddress.city.updateComponentProps({ options: [], loading: true });
      ctx.form.registrationAddress.city.setValue('');
      const opts = region ? await fetchCitiesByRegion(region) : [];
      ctx.form.registrationAddress.city.updateComponentProps({ options: opts, loading: false });
    },
    { immediate: false, debounce: 300 },
  );

  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      ctx.form.residenceAddress.city.updateComponentProps({ options: [], loading: true });
      ctx.form.residenceAddress.city.setValue('');
      const opts = region ? await fetchCitiesByRegion(region) : [];
      ctx.form.residenceAddress.city.updateComponentProps({ options: opts, loading: false });
    },
    { immediate: false, debounce: 300 },
  );

  // carBrand → carModel options (only when loanType === 'car')
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      ctx.form.carModel.updateComponentProps({ options: [], loading: true });
      ctx.form.carModel.setValue(null);
      if (!brand) {
        ctx.form.carModel.updateComponentProps({ options: [], loading: false });
        return;
      }
      const opts = await fetchCarModelsByBrand(brand);
      ctx.form.carModel.updateComponentProps({ options: opts, loading: false });
    },
    { immediate: false, debounce: 300 },
  );
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCreditApplicationFormV16(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: schema,
    validation: fullValidation,
    behavior,
  });
}
