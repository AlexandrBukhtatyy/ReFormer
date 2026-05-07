// MCP-only sandbox — iter-15, target=core
// Generated from spec docs/specs/credit-application-form.md via @reformer/mcp.
// Schema-driven: components and componentProps live here; index.tsx renders
// thin <FormField control={form.x} /> only.

import {
  createForm,
  type FieldConfig,
  type FieldPath,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
  type AsyncValidatorFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  email,
  validate,
  validateItems,
  applyWhen,
} from '@reformer/core/validators';
import {
  computeFrom,
  watchField,
  copyFrom,
  enableWhen,
} from '@reformer/core/behaviors';
import {
  Input,
  Select,
  RadioGroup,
  Checkbox,
  Textarea,
  InputMask,
} from '@reformer/ui-kit';

// =============================================================================
// Types — `type` aliases (Recipe 2: avoids interface index-signature issues)
// =============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'car' | 'other';

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

export type ExistingLoan = {
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
};

export type CoBorrower = {
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
  sameEmail: boolean;
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

  // Computed (readonly UI)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

// =============================================================================
// Options
// =============================================================================

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
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Иное' },
];

// =============================================================================
// Mocks (async APIs)
// =============================================================================

const REGION_CITIES: Record<string, Array<{ value: string; label: string }>> = {
  Москва: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
  ],
  'Санкт-Петербург': [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'kolpino', label: 'Колпино' },
  ],
  'Московская область': [
    { value: 'mytishchi', label: 'Мытищи' },
    { value: 'khimki', label: 'Химки' },
  ],
};

async function fetchCitiesByRegion(
  region: string
): Promise<Array<{ value: string; label: string }>> {
  await new Promise((r) => setTimeout(r, 200));
  return REGION_CITIES[region] ?? [{ value: 'other', label: 'Другой' }];
}

const CAR_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  Toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  Lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
    { value: 'niva', label: 'Niva' },
  ],
  Kia: [
    { value: 'rio', label: 'Rio' },
    { value: 'sportage', label: 'Sportage' },
  ],
};

async function fetchCarModels(brand: string): Promise<Array<{ value: string; label: string }>> {
  await new Promise((r) => setTimeout(r, 200));
  return CAR_MODELS[brand] ?? [];
}

const checkEmailUnique: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 250));
  // Simulate: only 'taken@example.com' is taken
  if (value.trim().toLowerCase() === 'taken@example.com') {
    return { code: 'email-taken', message: 'Email уже зарегистрирован' };
  }
  return null;
};

// =============================================================================
// Helpers
// =============================================================================

function annuityMonthly(amount: number, months: number, ratePct: number): number {
  if (!amount || !months || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = months;
  return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

function baseInterestRate(loanType: LoanType): number {
  switch (loanType) {
    case 'mortgage':
      return 8.5;
    case 'car':
      return 12;
    case 'business':
      return 14;
    case 'refinancing':
      return 13;
    case 'consumer':
    default:
      return 15;
  }
}

function calcAge(birthDate: string): number {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

const CURRENT_YEAR = new Date().getFullYear();

// =============================================================================
// Schema (Step 1..6)
// =============================================================================

const formSchema: FormSchema<CreditApplicationForm> = {
  // ---------- Step 1 ----------
  loanType: {
    value: 'consumer',
    component: RadioGroup,
    componentProps: { label: 'Тип кредита', options: LOAN_TYPE_OPTIONS },
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
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', placeholder: 'Введите срок' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 3,
      maxLength: 500,
    },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости (₽)', type: 'number', placeholder: 'Введите стоимость' },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос (₽)', type: 'number', readOnly: true },
  },
  carBrand: {
    value: null,
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  carModel: {
    value: null,
    component: Select,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Сначала выберите марку', options: [] },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость автомобиля (₽)', type: 'number', placeholder: 'Введите стоимость' },
  },

  // ---------- Step 2 ----------
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
      componentProps: { label: 'Пол', options: GENDER_OPTIONS, className: '!flex-row gap-6' },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
    },
  },
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

  // ---------- Step 3 ----------
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
  sameEmail: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Использовать тот же email для уведомлений' },
  },
  registrationAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', placeholder: 'Введите регион' },
    },
    city: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Город',
        placeholder: 'Сначала выберите регион',
        options: [],
      },
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
      component: Input,
      componentProps: { label: 'Регион', placeholder: 'Введите регион' },
    },
    city: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Город',
        placeholder: 'Сначала выберите регион',
        options: [],
      },
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

  // ---------- Step 4 ----------
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

  // ---------- Step 5 ----------
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
    componentProps: { label: 'Образование', placeholder: 'Выберите уровень образования', options: EDUCATION_OPTIONS },
  } satisfies FieldConfig<Education>,
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  // Array sections — tuple format [itemSchema] (Recipe: form-array)
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: { label: 'Тип имущества', placeholder: 'Выберите тип', options: PROPERTY_TYPE_OPTIONS },
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
          componentProps: { label: 'Фамилия', placeholder: 'Фамилия созаемщика' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя', placeholder: 'Имя созаемщика' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество', placeholder: 'Отчество созаемщика' },
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

  // ---------- Step 6 ----------
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
    componentProps: { label: 'Код подтверждения из СМС', mask: '999999', placeholder: '123456' },
  },

  // ---------- Computed (readonly UI) ----------
  interestRate: {
    value: 15,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number', readOnly: true },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true },
  },
  age: {
    value: 0,
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
    componentProps: { label: 'Платёж / доход (%)', type: 'number', readOnly: true },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаемщиков (₽)', type: 'number', readOnly: true },
  },
};

// =============================================================================
// Per-step validations (Record<number, ValidationSchemaFn> — NOT array!)
// =============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhen(
    path.loanType,
    (lt) => lt === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимум 1 000 000 ₽' });
      // Cross-field: loanAmount <= propertyValue - initialPayment
      validate(p.loanAmount, (value, ctx) => {
        const pv = ctx.form.propertyValue.value.value;
        const ip = ctx.form.initialPayment.value.value;
        if (value != null && pv != null && ip != null && value > pv - ip) {
          return {
            code: 'mortgage-amount-exceeds',
            message: 'Сумма кредита не должна превышать стоимость минус первоначальный взнос',
          };
        }
        return null;
      });
    }
  );

  applyWhen(
    path.loanType,
    (lt) => lt === 'car',
    (p) => {
      required(p.carBrand, { message: 'Введите марку' });
      minLength(p.carBrand, 2);
      maxLength(p.carBrand, 50);
      required(p.carModel, { message: 'Выберите модель' });
      required(p.carYear, { message: 'Введите год выпуска' });
      min(p.carYear, 2000, { message: 'Минимум 2000' });
      max(p.carYear, CURRENT_YEAR + 1, { message: `Максимум ${CURRENT_YEAR + 1}` });
      required(p.carPrice, { message: 'Введите стоимость авто' });
      min(p.carPrice, 300000, { message: 'Минимум 300 000 ₽' });
      max(p.carPrice, 10000000, { message: 'Максимум 10 000 000 ₽' });
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.gender, { message: 'Выберите пол' });
  required(path.personalData.birthPlace, { message: 'Введите место рождения' });

  // Age 18–70
  validate(path.personalData.birthDate, (value) => {
    if (!value) return null;
    const age = calcAge(value);
    if (age < 18) return { code: 'too-young', message: 'Возраст должен быть не менее 18 лет' };
    if (age > 70) return { code: 'too-old', message: 'Возраст не должен превышать 70 лет' };
    return null;
  });

  required(path.passportData.series, { message: 'Введите серию' });
  required(path.passportData.number, { message: 'Введите номер' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Введите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });

  required(path.inn, { message: 'Введите ИНН' });
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Неверный формат телефона',
  });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Неверный формат email' });

  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите номер дома' });
  required(path.registrationAddress.postalCode, { message: 'Введите индекс' });

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region, { message: 'Введите регион' });
      required(p.residenceAddress.city, { message: 'Введите город' });
      required(p.residenceAddress.street, { message: 'Введите улицу' });
      required(p.residenceAddress.house, { message: 'Введите номер дома' });
      required(p.residenceAddress.postalCode, { message: 'Введите индекс' });
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Введите текущий стаж' });
  min(path.workExperienceCurrent, 0);
  // Cross-field: current <= total
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value;
    if (total != null && value != null && value > total) {
      return {
        code: 'experience-mismatch',
        message: 'Стаж на текущем месте не может превышать общий',
      };
    }
    return null;
  });
  required(path.monthlyIncome, { message: 'Введите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });
  // additionalIncomeSource обязателен если additionalIncome > 0
  validate(path.additionalIncomeSource, (value, ctx) => {
    const ai = ctx.form.additionalIncome.value.value;
    if (ai != null && ai > 0 && (value == null || value === '')) {
      return { code: 'source-required', message: 'Укажите источник дополнительного дохода' };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      validate(p.companyInn, (value) => {
        if (value && !/^\d{10}$/.test(value)) {
          return { code: 'companyInn-format', message: 'ИНН компании должен содержать 10 цифр' };
        }
        return null;
      });
      required(p.companyPhone, { message: 'Введите телефон компании' });
      required(p.position, { message: 'Введите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Введите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН ИП' });
      validate(p.businessInn, (value) => {
        if (value && !/^\d{12}$/.test(value)) {
          return { code: 'businessInn-format', message: 'ИНН ИП должен содержать 12 цифр' };
        }
        return null;
      });
      required(p.businessActivity, { message: 'Введите вид деятельности' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus);
  required(path.dependents);
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education);

  applyWhen(
    path.hasProperty,
    (v) => v === true,
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
        // Cross-field within item: remainingAmount <= amount
        validate(itemPath.remainingAmount, (value, ctx) => {
          const amount = ctx.form.amount?.value.value;
          if (amount != null && value != null && value > amount) {
            return {
              code: 'remaining-exceeds',
              message: 'Остаток не может быть больше суммы кредита',
            };
          }
          return null;
        });
      });
    }
  );

  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, (itemPath) => {
        required(itemPath.personalData.lastName);
        required(itemPath.personalData.firstName);
        required(itemPath.personalData.middleName);
        required(itemPath.phone);
        pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
          message: 'Неверный формат телефона',
        });
        required(itemPath.email);
        email(itemPath.email);
        required(itemPath.relationship);
        required(itemPath.monthlyIncome);
        min(itemPath.monthlyIncome, 0);
      });
    }
  );
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие' });
  required(path.agreeCreditHistory, { message: 'Необходимо согласие' });
  required(path.agreeTerms, { message: 'Необходимо согласие' });
  required(path.confirmAccuracy, { message: 'Необходимо подтверждение' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
  pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код состоит из 6 цифр' });

  // payment-to-income ratio <= 50%
  validate(path.paymentToIncomeRatio, (value) => {
    if (value != null && value > 50) {
      return {
        code: 'pti-exceeded',
        message: 'Платёж по кредиту превышает 50% от дохода',
      };
    }
    return null;
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

// =============================================================================
// Behavior — computed fields, async options, copy-from, conditional enable
// =============================================================================

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ---- Computed C.4 fullName ----
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  // ---- Computed C.5 age ----
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => calcAge(personalData.birthDate)
  );

  // ---- Computed C.3 initialPayment = 20% propertyValue ----
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue ? Math.round(propertyValue * 0.2) : 0
  );

  // ---- Computed C.1 interestRate (from loanType + hasProperty) ----
  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    ({ loanType, hasProperty }: CreditApplicationForm) => {
      const base = baseInterestRate(loanType);
      return hasProperty ? Math.max(0, base - 0.5) : base;
    }
  );

  // ---- Computed C.2 monthlyPayment ----
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
  );

  // ---- Computed C.6 totalIncome ----
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // ---- Computed C.7 paymentToIncomeRatio ----
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome || totalIncome <= 0) return 0;
      return Math.round(((monthlyPayment ?? 0) / totalIncome) * 100);
    }
  );

  // ---- Computed C.8 coBorrowersIncome ----
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, cb) => sum + (cb?.monthlyIncome ?? 0), 0)
  );

  // ---- Async options: registrationAddress.region -> city ----
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      ctx.form.registrationAddress.city.setValue('');
      if (!region) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        return;
      }
      const options = await fetchCitiesByRegion(region);
      ctx.form.registrationAddress.city.updateComponentProps({ options });
    },
    { debounce: 300 }
  );

  // ---- Async options: residenceAddress.region -> city ----
  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      ctx.form.residenceAddress.city.setValue('');
      if (!region) {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        return;
      }
      const options = await fetchCitiesByRegion(region);
      ctx.form.residenceAddress.city.updateComponentProps({ options });
    },
    { debounce: 300 }
  );

  // ---- Async options: carBrand -> carModel ----
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      ctx.form.carModel.setValue(null);
      if (!brand) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        return;
      }
      const options = await fetchCarModels(brand);
      ctx.form.carModel.updateComponentProps({ options });
    },
    { debounce: 300 }
  );

  // ---- copyFrom: registrationAddress -> residenceAddress when sameAsRegistration ----
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // ---- copyFrom: email -> emailAdditional when sameEmail ----
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // ---- enableWhen: mortgage fields ----
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // ---- enableWhen: car fields ----
  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

  // ---- enableWhen: residenceAddress when NOT sameAsRegistration ----
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: false,
  });

  // ---- enableWhen: employed fields ----
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

  // ---- enableWhen: selfEmployed fields ----
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
};

// =============================================================================
// Form factory
// =============================================================================

export function createCreditApplicationFormCoreV15(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}

export type { FieldPath };
