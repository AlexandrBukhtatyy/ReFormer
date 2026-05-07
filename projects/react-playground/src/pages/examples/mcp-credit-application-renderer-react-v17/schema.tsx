// iter-17 / target=renderer-react
// Credit application form — full implementation per spec.
// Stack: createRenderSchema + <FormRenderer fieldWrapper=FormField> + FormWizard as root.
//
// Recipes used:
// - quick-start (schema-driven UI, type alias)
// - form-field-integration (FormField as fieldWrapper, testId convention)
// - type-safety-recipes (Recipes 1-8, especially 8 satisfies FieldConfig<UnionType>)
// - form-wizard (STEP_VALIDATIONS Record<number, ...>, RenderNode body)
// - form-array (tuple [itemSchema])
// - compute-from / compute-vs-watch (annotated args)
// - async-validator-debounce (asyncValidators + debounce)
// - async-options-loading (watchField + updateComponentProps({ options }))
// - input-mask (InputMask + componentProps.mask)
// - copy-from (copyFrom for sameAsRegistration)
// - validation (required/min/max/minLength/maxLength/pattern/email/applyWhen/validateItems)
// - renderer-react overview (closure pattern; FormWizard as root render-node)

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
  applyWhen,
  apply,
  validate,
  validateItems,
} from '@reformer/core/validators';
import {
  computeFrom,
  copyFrom,
  watchField,
} from '@reformer/core/behaviors';
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
  FormWizard,
  FormArraySection,
  type FormWizardStep,
} from '@reformer/ui-kit';
import {
  createRenderSchema,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';

import type {
  Address,
  CoBorrowerItem,
  CreditApplicationForm,
  EmploymentStatus,
  ExistingLoanItem,
  Gender,
  LoanType,
  MaritalStatus,
  Education,
  PassportData,
  PersonalData,
  PropertyItem,
  PropertyType,
} from './types';

// =====================================================================
// Mock data — async options
// =====================================================================

const REGION_TO_CITIES: Record<string, { value: string; label: string }[]> = {
  Москва: [
    { value: 'moscow', label: 'Москва' },
    { value: 'zelenograd', label: 'Зеленоград' },
  ],
  'Санкт-Петербург': [
    { value: 'spb', label: 'Санкт-Петербург' },
    { value: 'pushkin', label: 'Пушкин' },
  ],
  'Краснодарский край': [
    { value: 'krasnodar', label: 'Краснодар' },
    { value: 'sochi', label: 'Сочи' },
  ],
};

const BRAND_TO_MODELS: Record<string, { value: string; label: string }[]> = {
  Toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  BMW: [
    { value: 'x5', label: 'X5' },
    { value: 'x3', label: 'X3' },
    { value: '5-series', label: '5 Series' },
  ],
  Lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
  ],
};

async function fetchCarModels(brand: string): Promise<{ value: string; label: string }[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return BRAND_TO_MODELS[brand] ?? [];
}

async function fetchCitiesByRegion(region: string): Promise<{ value: string; label: string }[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return REGION_TO_CITIES[region] ?? [];
}

// =====================================================================
// Async validators — per spec: email uniqueness + INN check
// =====================================================================

const TAKEN_EMAILS = new Set(['taken@mail.com', 'admin@mail.com']);

const checkEmailUnique: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return TAKEN_EMAILS.has(value)
    ? { code: 'email-taken', message: 'Email уже зарегистрирован' }
    : null;
};

const checkInnValid: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  // basic length + digit-only check (mock async API call)
  await new Promise((resolve) => setTimeout(resolve, 300));
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length !== 12) {
    return { code: 'inn-length', message: 'ИНН должен содержать 12 цифр' };
  }
  return null;
};

// =====================================================================
// Computation helpers
// =====================================================================

function annuityMonthlyPayment(amount: number, term: number, ratePct: number): number {
  if (!amount || !term || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = term;
  const factor = Math.pow(1 + r, n);
  return Math.round((amount * r * factor) / (factor - 1));
}

function calcAge(birthDateIso: string): number {
  if (!birthDateIso) return 0;
  const bd = new Date(birthDateIso);
  if (Number.isNaN(bd.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
}

function calcInterestRate(
  loanType: LoanType,
  region: string,
  hasProperty: boolean,
  propertiesCount: number,
): number {
  // Base rate per loan type
  const base: Record<LoanType, number> = {
    consumer: 12,
    mortgage: 8,
    car: 10,
    business: 14,
    refinancing: 11,
  };
  let rate = base[loanType] ?? 12;
  // Region adjustment (Moscow / SPB get -0.5%)
  if (region === 'Москва' || region === 'Санкт-Петербург') rate -= 0.5;
  // Property collateral -1%
  if (hasProperty && propertiesCount > 0) rate -= 1;
  return Math.max(rate, 5); // floor 5%
}

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

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / Самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Холост / Не замужем' },
  { value: 'married', label: 'Женат / Замужем' },
  { value: 'divorced', label: 'Разведен(а)' },
  { value: 'widowed', label: 'Вдовец / Вдова' },
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
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
];

// =====================================================================
// Sub-schemas (nested groups + array items)
// =====================================================================

const personalDataSchema: FormSchema<PersonalData> = {
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию', testId: 'lastName' },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Введите имя', testId: 'firstName' },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: { label: 'Отчество', placeholder: 'Введите отчество', testId: 'middleName' },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата рождения', type: 'date', testId: 'birthDate' },
  },
  gender: {
    value: 'male',
    component: RadioGroup,
    componentProps: { label: 'Пол', options: GENDER_OPTIONS, testId: 'gender' },
  } satisfies FieldConfig<Gender>,
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения', testId: 'birthPlace' },
  },
};

const passportDataSchema: FormSchema<PassportData> = {
  series: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Серия паспорта', mask: '99 99', placeholder: '12 34', testId: 'series' },
  },
  number: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Номер паспорта', mask: '999999', placeholder: '123456', testId: 'number' },
  },
  issueDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата выдачи', type: 'date', testId: 'issueDate' },
  },
  issuedBy: {
    value: '',
    component: Input,
    componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа', testId: 'issuedBy' },
  },
  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подразделения', mask: '999-999', placeholder: '123-456', testId: 'departmentCode' },
  },
};

function makeAddressSchema(): FormSchema<Address> {
  return {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', placeholder: 'Введите регион', testId: 'region' },
    },
    city: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'city',
        options: [] as { value: string; label: string }[],
      },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', placeholder: 'Введите улицу', testId: 'street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', placeholder: '№', testId: 'house' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', placeholder: '№', testId: 'apartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000', testId: 'postalCode' },
    },
  };
}

// =====================================================================
// FORM SCHEMA (root)
// =====================================================================

export const formSchema: FormSchema<CreditApplicationForm> = {
  // ---------- Step 1: Loan ----------
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      testId: 'loanType',
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
      testId: 'loanAmount',
    },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Срок кредита (месяцев)',
      type: 'number',
      placeholder: 'Введите срок',
      testId: 'loanTerm',
    },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      testId: 'loanPurpose',
      maxLength: 500,
    },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
      testId: 'propertyValue',
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
      testId: 'initialPayment',
    },
  },
  carBrand: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Например: Toyota',
      testId: 'carBrand',
    },
  },
  carModel: {
    value: null,
    component: Select,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Например: Camry',
      testId: 'carModel',
      options: [] as { value: string; label: string }[],
    },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020', testId: 'carYear' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      type: 'number',
      placeholder: 'Введите стоимость',
      testId: 'carPrice',
    },
  },

  // ---------- Step 2: Personal ----------
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', mask: '999999999999', placeholder: '123456789012', testId: 'inn' },
    asyncValidators: [checkInnValid],
    debounce: 500,
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: { label: 'СНИЛС', mask: '999-999-999 99', placeholder: '123-456-789 00', testId: 'snils' },
  },

  // ---------- Step 3: Contacts ----------
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
      testId: 'phoneMain',
    },
  },
  phoneAdditional: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
      testId: 'phoneAdditional',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com', testId: 'email' },
    asyncValidators: [checkEmailUnique],
    debounce: 500,
  },
  emailAdditional: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный email',
      type: 'email',
      placeholder: 'example@mail.com',
      testId: 'emailAdditional',
    },
  },
  registrationAddress: makeAddressSchema(),
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: {
      label: 'Адрес проживания совпадает с адресом регистрации',
      testId: 'sameAsRegistration',
    },
  },
  residenceAddress: makeAddressSchema(),

  // ---------- Step 4: Employment ----------
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_STATUS_OPTIONS,
      testId: 'employmentStatus',
    },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: null,
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название', testId: 'companyName' },
  },
  companyInn: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'ИНН компании',
      mask: '9999999999',
      placeholder: '1234567890',
      testId: 'companyInn',
    },
  },
  companyPhone: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
      testId: 'companyPhone',
    },
  },
  companyAddress: {
    value: null,
    component: Input,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес', testId: 'companyAddress' },
  },
  position: {
    value: null,
    component: Input,
    componentProps: { label: 'Должность', placeholder: 'Ваша должность', testId: 'position' },
  },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      type: 'number',
      placeholder: '0',
      testId: 'workExperienceTotal',
    },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      type: 'number',
      placeholder: '0',
      testId: 'workExperienceCurrent',
    },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      type: 'number',
      placeholder: '0',
      testId: 'monthlyIncome',
    },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный доход (₽)',
      type: 'number',
      placeholder: '0',
      testId: 'additionalIncome',
    },
  },
  additionalIncomeSource: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Источник дополнительного дохода',
      placeholder: 'Опишите источник',
      testId: 'additionalIncomeSource',
    },
  },
  businessType: {
    value: null,
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.', testId: 'businessType' },
  },
  businessInn: {
    value: null,
    component: InputMask,
    componentProps: {
      label: 'ИНН ИП',
      mask: '999999999999',
      placeholder: '123456789012',
      testId: 'businessInn',
    },
  },
  businessActivity: {
    value: null,
    component: Textarea,
    componentProps: {
      label: 'Вид деятельности',
      placeholder: 'Опишите вид деятельности',
      testId: 'businessActivity',
    },
  },

  // ---------- Step 5: Additional ----------
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: MARITAL_STATUS_OPTIONS,
      testId: 'maritalStatus',
    },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', placeholder: '0', testId: 'dependents' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      testId: 'education',
      options: EDUCATION_OPTIONS,
    },
  } satisfies FieldConfig<Education>,
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
          placeholder: 'Выберите тип',
          testId: 'type',
          options: PROPERTY_TYPE_OPTIONS,
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', placeholder: 'Опишите имущество', testId: 'description' },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Оценочная стоимость',
          type: 'number',
          placeholder: '0',
          testId: 'estimatedValue',
        },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' },
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
      bank: {
        value: '',
        component: Input,
        componentProps: { label: 'Банк', placeholder: 'Название банка', testId: 'bank' },
      },
      type: {
        value: '',
        component: Input,
        componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита', testId: 'type' },
      },
      amount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Сумма кредита', type: 'number', placeholder: '0', testId: 'amount' },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности',
          type: 'number',
          placeholder: '0',
          testId: 'remainingAmount',
        },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платеж',
          type: 'number',
          placeholder: '0',
          testId: 'monthlyPayment',
        },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата погашения', type: 'date', testId: 'maturityDate' },
      },
    },
  ],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаемщика', testId: 'hasCoBorrower' },
  },
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию', testId: 'lastName' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя', placeholder: 'Введите имя', testId: 'firstName' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество', placeholder: 'Введите отчество', testId: 'middleName' },
        },
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
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com', testId: 'email' },
      },
      relationship: {
        value: '',
        component: Input,
        componentProps: { label: 'Родство', placeholder: 'Укажите родство', testId: 'relationship' },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход', type: 'number', placeholder: '0', testId: 'monthlyIncome' },
      },
    },
  ],

  // ---------- Step 6: Confirmation ----------
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных', testId: 'agreePersonalData' },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на проверку кредитной истории', testId: 'agreeCreditHistory' },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на получение маркетинговых материалов', testId: 'agreeMarketing' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных', testId: 'confirmAccuracy' },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Код подтверждения из СМС',
      mask: '999999',
      placeholder: '123456',
      testId: 'electronicSignature',
    },
  },

  // ---------- Computed (readonly) ----------
  interestRate: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readOnly: true,
      testId: 'interestRate',
    },
  },
  monthlyPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      type: 'number',
      readOnly: true,
      testId: 'monthlyPayment',
    },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, testId: 'fullName' },
  },
  age: {
    value: null,
    component: Input,
    componentProps: { label: 'Возраст (лет)', type: 'number', readOnly: true, testId: 'age' },
  },
  totalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true, testId: 'totalIncome' },
  },
  paymentToIncomeRatio: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Процент платежа от дохода (%)',
      type: 'number',
      readOnly: true,
      testId: 'paymentToIncomeRatio',
    },
  },
  coBorrowersIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Доход созаемщиков (₽)',
      type: 'number',
      readOnly: true,
      testId: 'coBorrowersIncome',
    },
  },
};

// =====================================================================
// Validation
// =====================================================================

const personalDataValidation: ValidationSchemaFn<PersonalData> = (path) => {
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.middleName, { message: 'Отчество обязательно' });
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  required(path.gender);
  required(path.birthPlace, { message: 'Место рождения обязательно' });
};

const passportDataValidation: ValidationSchemaFn<PassportData> = (path) => {
  required(path.series, { message: 'Серия паспорта обязательна' });
  pattern(path.series, /^\d{2} \d{2}$/, { message: 'Формат серии: 12 34' });
  required(path.number, { message: 'Номер паспорта обязателен' });
  pattern(path.number, /^\d{6}$/, { message: 'Номер паспорта — 6 цифр' });
  required(path.issueDate, { message: 'Дата выдачи обязательна' });
  required(path.issuedBy, { message: 'Поле "Кем выдан" обязательно' });
  required(path.departmentCode, { message: 'Код подразделения обязателен' });
  pattern(path.departmentCode, /^\d{3}-\d{3}$/, { message: 'Формат: 123-456' });
};

const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.region, { message: 'Регион обязателен' });
  required(path.city, { message: 'Город обязателен' });
  required(path.street, { message: 'Улица обязательна' });
  required(path.house, { message: 'Дом обязателен' });
  required(path.postalCode, { message: 'Индекс обязателен' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Индекс — 6 цифр' });
};

const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  // Step 1: Loan
  1: (path) => {
    required(path.loanType, { message: 'Тип кредита обязателен' });
    required(path.loanAmount, { message: 'Сумма кредита обязательна' });
    min(path.loanAmount, 50000, { message: 'Минимум 50 000 ₽' });
    max(path.loanAmount, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
    required(path.loanTerm, { message: 'Срок кредита обязателен' });
    min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
    max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
    required(path.loanPurpose, { message: 'Цель кредита обязательна' });
    minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
    maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

    applyWhen(
      path.loanType,
      (value) => value === 'mortgage',
      (p) => {
        required(p.propertyValue, { message: 'Стоимость недвижимости обязательна' });
        min(p.propertyValue, 1_000_000, { message: 'Минимум 1 000 000 ₽' });
        // Cross-field: loanAmount ≤ propertyValue - initialPayment
        validate(p.loanAmount, (value, ctx) => {
          const propertyValue = ctx.form.propertyValue.value.value as number | null;
          const initialPayment = ctx.form.initialPayment.value.value as number | null;
          if (value != null && propertyValue != null && initialPayment != null) {
            const max = propertyValue - initialPayment;
            if (value > max) {
              return {
                code: 'loan-too-big',
                message: `Сумма кредита не должна превышать ${max} ₽`,
              };
            }
          }
          return null;
        });
      },
    );

    applyWhen(
      path.loanType,
      (value) => value === 'car',
      (p) => {
        required(p.carBrand, { message: 'Марка обязательна' });
        minLength(p.carBrand, 2, { message: 'Минимум 2 символа' });
        maxLength(p.carBrand, 50, { message: 'Максимум 50 символов' });
        required(p.carModel, { message: 'Модель обязательна' });
        minLength(p.carModel, 1, { message: 'Минимум 1 символ' });
        maxLength(p.carModel, 50, { message: 'Максимум 50 символов' });
        required(p.carYear, { message: 'Год выпуска обязателен' });
        min(p.carYear, 2000, { message: 'Минимум 2000' });
        max(p.carYear, new Date().getFullYear() + 1, {
          message: 'Год не может быть будущим',
        });
        required(p.carPrice, { message: 'Стоимость автомобиля обязательна' });
        min(p.carPrice, 300_000, { message: 'Минимум 300 000 ₽' });
        max(p.carPrice, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
      },
    );
  },

  // Step 2: Personal
  2: (path) => {
    apply(path.personalData, personalDataValidation);
    apply(path.passportData, passportDataValidation);
    required(path.inn, { message: 'ИНН обязателен' });
    pattern(path.inn, /^\d{12}$/, { message: 'ИНН — 12 цифр' });
    required(path.snils, { message: 'СНИЛС обязателен' });
    pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'Формат: 123-456-789 00' });
    // age validation 18-70
    validate(path.personalData, (_value, ctx) => {
      const age = ctx.form.age.value.value as number | null;
      if (age != null && age > 0 && (age < 18 || age > 70)) {
        return { code: 'age-out-of-range', message: 'Возраст должен быть от 18 до 70 лет' };
      }
      return null;
    });
  },

  // Step 3: Contacts
  3: (path) => {
    required(path.phoneMain, { message: 'Основной телефон обязателен' });
    pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (999) 999-99-99',
    });
    required(path.email, { message: 'Email обязателен' });
    emailValidator(path.email, { message: 'Некорректный email' });
    apply(path.registrationAddress, addressValidation);
    applyWhen(
      path.sameAsRegistration,
      (value) => value === false,
      (p) => {
        apply(p.residenceAddress, addressValidation);
      },
    );
  },

  // Step 4: Employment
  4: (path) => {
    required(path.employmentStatus, { message: 'Статус занятости обязателен' });
    required(path.workExperienceTotal, { message: 'Общий стаж обязателен' });
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent, { message: 'Стаж на текущем месте обязателен' });
    min(path.workExperienceCurrent, 0);
    // workExperienceCurrent ≤ workExperienceTotal
    validate(path.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.workExperienceTotal.value.value as number | null;
      if (value != null && total != null && value > total) {
        return {
          code: 'experience-mismatch',
          message: 'Текущий стаж не может превышать общий',
        };
      }
      return null;
    });
    required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
    min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });

    applyWhen(
      path.employmentStatus,
      (value) => value === 'employed',
      (p) => {
        required(p.companyName, { message: 'Название компании обязательно' });
        required(p.companyInn, { message: 'ИНН компании обязателен' });
        pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН компании — 10 цифр' });
        required(p.companyPhone, { message: 'Телефон компании обязателен' });
        required(p.companyAddress, { message: 'Адрес компании обязателен' });
        required(p.position, { message: 'Должность обязательна' });
      },
    );
    applyWhen(
      path.employmentStatus,
      (value) => value === 'selfEmployed',
      (p) => {
        required(p.businessType, { message: 'Тип бизнеса обязателен' });
        required(p.businessInn, { message: 'ИНН ИП обязателен' });
        pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН ИП — 12 цифр' });
        required(p.businessActivity, { message: 'Вид деятельности обязателен' });
      },
    );
    // additionalIncomeSource required when additionalIncome > 0
    validate(path.additionalIncomeSource, (value, ctx) => {
      const ai = ctx.form.additionalIncome.value.value as number | null;
      if (ai != null && ai > 0 && (!value || (typeof value === 'string' && !value.trim()))) {
        return {
          code: 'source-required',
          message: 'Укажите источник дополнительного дохода',
        };
      }
      return null;
    });
  },

  // Step 5: Additional
  5: (path) => {
    required(path.maritalStatus);
    required(path.dependents);
    min(path.dependents, 0, { message: 'Минимум 0' });
    max(path.dependents, 10, { message: 'Максимум 10' });
    required(path.education);

    applyWhen(
      path.hasProperty,
      (value) => value === true,
      (p) => {
        validateItems(p.properties, (itemPath) => {
          required(itemPath.type, { message: 'Тип имущества обязателен' });
          required(itemPath.description, { message: 'Описание обязательно' });
          required(itemPath.estimatedValue, { message: 'Стоимость обязательна' });
          min(itemPath.estimatedValue, 0);
        });
      },
    );

    applyWhen(
      path.hasExistingLoans,
      (value) => value === true,
      (p) => {
        validateItems(p.existingLoans, (itemPath) => {
          required(itemPath.bank, { message: 'Банк обязателен' });
          required(itemPath.type, { message: 'Тип кредита обязателен' });
          required(itemPath.amount, { message: 'Сумма обязательна' });
          min(itemPath.amount, 0);
          required(itemPath.remainingAmount, { message: 'Остаток обязателен' });
          min(itemPath.remainingAmount, 0);
          required(itemPath.monthlyPayment, { message: 'Платеж обязателен' });
          min(itemPath.monthlyPayment, 0);
          required(itemPath.maturityDate, { message: 'Дата погашения обязательна' });
          // remainingAmount ≤ amount
          validate(itemPath.remainingAmount, (value, ctx) => {
            const item = (ctx as { item?: ExistingLoanItem }).item;
            const amount = item?.amount;
            if (value != null && amount != null && value > amount) {
              return {
                code: 'remaining-too-big',
                message: 'Остаток не может превышать сумму кредита',
              };
            }
            return null;
          });
        });
      },
    );

    applyWhen(
      path.hasCoBorrower,
      (value) => value === true,
      (p) => {
        validateItems(p.coBorrowers, (itemPath) => {
          required(itemPath.personalData.lastName, { message: 'Фамилия обязательна' });
          required(itemPath.personalData.firstName, { message: 'Имя обязательно' });
          required(itemPath.personalData.middleName, { message: 'Отчество обязательно' });
          required(itemPath.phone, { message: 'Телефон обязателен' });
          pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
            message: 'Формат: +7 (999) 999-99-99',
          });
          required(itemPath.email, { message: 'Email обязателен' });
          emailValidator(itemPath.email);
          required(itemPath.relationship, { message: 'Родство обязательно' });
          required(itemPath.monthlyIncome, { message: 'Доход обязателен' });
          min(itemPath.monthlyIncome, 0);
        });
      },
    );
  },

  // Step 6: Confirmation
  6: (path) => {
    validate(path.agreePersonalData, (value) =>
      value === true ? null : { code: 'must-agree', message: 'Необходимо согласие' },
    );
    validate(path.agreeCreditHistory, (value) =>
      value === true ? null : { code: 'must-agree', message: 'Необходимо согласие' },
    );
    validate(path.agreeTerms, (value) =>
      value === true ? null : { code: 'must-agree', message: 'Необходимо согласие' },
    );
    validate(path.confirmAccuracy, (value) =>
      value === true ? null : { code: 'must-confirm', message: 'Необходимо подтвердить' },
    );
    required(path.electronicSignature, { message: 'Код подтверждения обязателен' });
    pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код — 6 цифр' });

    // paymentToIncomeRatio ≤ 50%
    validate(path.electronicSignature, (_value, ctx) => {
      const ratio = ctx.form.paymentToIncomeRatio.value.value as number | null;
      if (ratio != null && ratio > 50) {
        return {
          code: 'ratio-too-high',
          message: 'Платеж превышает 50% от дохода',
        };
      }
      return null;
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

// =====================================================================
// Behaviors (computed + async options + copy + chains)
// =====================================================================

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C4 fullName from personalData group
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' '),
  );

  // C5 age from birthDate
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => calcAge(personalData.birthDate),
  );

  // C3 initialPayment = 20% of propertyValue (only mortgage)
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue != null ? Math.round(propertyValue * 0.2) : null,
    { condition: (form) => form.loanType === 'mortgage' },
  );

  // C6 totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0),
  );

  // C1 interestRate (chain) — depends on loanType, region, hasProperty, properties
  // Use multiple watchField triggers calling shared compute fn (per recipe pattern).
  const recomputeInterestRate = (ctx: { form: FormProxy<CreditApplicationForm> }) => {
    const loanType = ctx.form.loanType.value.value as LoanType;
    const region = ctx.form.registrationAddress.region.value.value as string;
    const hasProperty = ctx.form.hasProperty.value.value as boolean;
    const propertiesCount = (ctx.form.properties.value.value as PropertyItem[] | undefined)?.length ?? 0;
    const next = calcInterestRate(loanType, region, hasProperty, propertiesCount);
    const cur = ctx.form.interestRate.value.value as number | null;
    if (cur == null || Math.abs(cur - next) > 0.001) {
      ctx.form.interestRate.setValue(next);
    }
  };
  watchField(
    path.loanType,
    (_value, ctx) => recomputeInterestRate(ctx),
    { immediate: true },
  );
  watchField(
    path.registrationAddress.region,
    (_value, ctx) => recomputeInterestRate(ctx),
    { immediate: false },
  );
  watchField(
    path.hasProperty,
    (_value, ctx) => recomputeInterestRate(ctx),
    { immediate: false },
  );

  // C2 monthlyPayment = annuity(loanAmount, loanTerm, interestRate)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthlyPayment(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0),
  );

  // C7 paymentToIncomeRatio = monthlyPayment / totalIncome * 100
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!monthlyPayment || !totalIncome) return 0;
      return Math.round((monthlyPayment / totalIncome) * 100);
    },
  );

  // C8 coBorrowersIncome = sum coBorrowers[].monthlyIncome
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, cb) => sum + (cb.monthlyIncome ?? 0), 0),
  );

  // copyFrom: sameAsRegistration => copy registrationAddress to residenceAddress
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // Async options: registrationAddress.region -> city options
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      const value = (typeof region === 'string' ? region : '') as string;
      if (!value) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        ctx.form.registrationAddress.city.setValue('');
        return;
      }
      const options = await fetchCitiesByRegion(value);
      ctx.form.registrationAddress.city.updateComponentProps({ options });
    },
    { debounce: 300 },
  );

  // residenceAddress.region -> city options
  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      const value = (typeof region === 'string' ? region : '') as string;
      if (!value) {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        ctx.form.residenceAddress.city.setValue('');
        return;
      }
      const options = await fetchCitiesByRegion(value);
      ctx.form.residenceAddress.city.updateComponentProps({ options });
    },
    { debounce: 300 },
  );

  // carBrand -> carModel options + clear carModel
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      const value = (typeof brand === 'string' ? brand : '') as string;
      ctx.form.carModel.setValue(null);
      if (!value) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        return;
      }
      const options = await fetchCarModels(value);
      ctx.form.carModel.updateComponentProps({ options });
    },
    { debounce: 300 },
  );

  // hasProperty=false -> clear properties[]
  watchField(
    path.hasProperty,
    (value, ctx) => {
      if (value === false) ctx.form.properties.setValue([]);
    },
    { immediate: false },
  );

  // hasExistingLoans=false -> clear existingLoans[]
  watchField(
    path.hasExistingLoans,
    (value, ctx) => {
      if (value === false) ctx.form.existingLoans.setValue([]);
    },
    { immediate: false },
  );

  // hasCoBorrower=false -> clear coBorrowers[]
  watchField(
    path.hasCoBorrower,
    (value, ctx) => {
      if (value === false) ctx.form.coBorrowers.setValue([]);
    },
    { immediate: false },
  );

  // loanType change -> reset specific fields
  watchField(
    path.loanType,
    (loanType, ctx) => {
      if (loanType !== 'mortgage') {
        ctx.form.propertyValue.setValue(null);
        ctx.form.initialPayment.setValue(null);
      }
      if (loanType !== 'car') {
        ctx.form.carBrand.setValue(null);
        ctx.form.carModel.setValue(null);
        ctx.form.carYear.setValue(null);
        ctx.form.carPrice.setValue(null);
      }
    },
    { immediate: false },
  );

  // employmentStatus change -> reset specific fields
  watchField(
    path.employmentStatus,
    (status, ctx) => {
      if (status !== 'employed') {
        ctx.form.companyName.setValue(null);
        ctx.form.companyInn.setValue(null);
        ctx.form.companyPhone.setValue(null);
        ctx.form.companyAddress.setValue(null);
        ctx.form.position.setValue(null);
      }
      if (status !== 'selfEmployed') {
        ctx.form.businessType.setValue(null);
        ctx.form.businessInn.setValue(null);
        ctx.form.businessActivity.setValue(null);
      }
    },
    { immediate: false },
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
// Render schema (closure pattern, FormWizard as root)
// =====================================================================

// Item components for FormArraySection
function PropertyItemForm({ control }: { control: FormProxy<PropertyItem> }) {
  return (
    <Box className="space-y-3">
      <FormField control={control.type} />
      <FormField control={control.description} />
      <FormField control={control.estimatedValue} />
      <FormField control={control.hasEncumbrance} />
    </Box>
  );
}

function ExistingLoanItemForm({ control }: { control: FormProxy<ExistingLoanItem> }) {
  return (
    <Box className="space-y-3">
      <FormField control={control.bank} />
      <FormField control={control.type} />
      <FormField control={control.amount} />
      <FormField control={control.remainingAmount} />
      <FormField control={control.monthlyPayment} />
      <FormField control={control.maturityDate} />
    </Box>
  );
}

function CoBorrowerItemForm({ control }: { control: FormProxy<CoBorrowerItem> }) {
  return (
    <Box className="space-y-3">
      <Section title="Личные данные созаемщика">
        <FormField control={control.personalData.lastName} />
        <FormField control={control.personalData.firstName} />
        <FormField control={control.personalData.middleName} />
      </Section>
      <FormField control={control.phone} />
      <FormField control={control.email} />
      <FormField control={control.relationship} />
      <FormField control={control.monthlyIncome} />
    </Box>
  );
}

// Step body components — all fields per spec, simplified to FC over FormProxy<root>
const Step1Body: React.FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <Box className="space-y-4">
    <Section title="Основное">
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />
      <FormField control={control.interestRate} />
      <FormField control={control.monthlyPayment} />
    </Section>
    <Section title="Ипотека (если выбрана)">
      <FormField control={control.propertyValue} />
      <FormField control={control.initialPayment} />
    </Section>
    <Section title="Автокредит (если выбран)">
      <FormField control={control.carBrand} />
      <FormField control={control.carModel} />
      <FormField control={control.carYear} />
      <FormField control={control.carPrice} />
    </Section>
  </Box>
);

const Step2Body: React.FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <Box className="space-y-4">
    <Section title="Личные данные">
      <FormField control={control.personalData.lastName} />
      <FormField control={control.personalData.firstName} />
      <FormField control={control.personalData.middleName} />
      <FormField control={control.personalData.birthDate} />
      <FormField control={control.personalData.gender} />
      <FormField control={control.personalData.birthPlace} />
      <FormField control={control.fullName} />
      <FormField control={control.age} />
    </Section>
    <Section title="Паспортные данные">
      <FormField control={control.passportData.series} />
      <FormField control={control.passportData.number} />
      <FormField control={control.passportData.issueDate} />
      <FormField control={control.passportData.issuedBy} />
      <FormField control={control.passportData.departmentCode} />
    </Section>
    <Section title="Документы">
      <FormField control={control.inn} />
      <FormField control={control.snils} />
    </Section>
  </Box>
);

const Step3Body: React.FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <Box className="space-y-4">
    <Section title="Контакты">
      <FormField control={control.phoneMain} />
      <FormField control={control.phoneAdditional} />
      <FormField control={control.email} />
      <FormField control={control.emailAdditional} />
    </Section>
    <Section title="Адрес регистрации">
      <FormField control={control.registrationAddress.region} />
      <FormField control={control.registrationAddress.city} />
      <FormField control={control.registrationAddress.street} />
      <FormField control={control.registrationAddress.house} />
      <FormField control={control.registrationAddress.apartment} />
      <FormField control={control.registrationAddress.postalCode} />
    </Section>
    <Section title="Адрес проживания">
      <FormField control={control.sameAsRegistration} />
      <FormField control={control.residenceAddress.region} />
      <FormField control={control.residenceAddress.city} />
      <FormField control={control.residenceAddress.street} />
      <FormField control={control.residenceAddress.house} />
      <FormField control={control.residenceAddress.apartment} />
      <FormField control={control.residenceAddress.postalCode} />
    </Section>
  </Box>
);

const Step4Body: React.FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <Box className="space-y-4">
    <Section title="Занятость">
      <FormField control={control.employmentStatus} />
    </Section>
    <Section title="Работа по найму">
      <FormField control={control.companyName} />
      <FormField control={control.companyInn} />
      <FormField control={control.companyPhone} />
      <FormField control={control.companyAddress} />
      <FormField control={control.position} />
    </Section>
    <Section title="ИП / Самозанятый">
      <FormField control={control.businessType} />
      <FormField control={control.businessInn} />
      <FormField control={control.businessActivity} />
    </Section>
    <Section title="Стаж и доход">
      <FormField control={control.workExperienceTotal} />
      <FormField control={control.workExperienceCurrent} />
      <FormField control={control.monthlyIncome} />
      <FormField control={control.additionalIncome} />
      <FormField control={control.additionalIncomeSource} />
      <FormField control={control.totalIncome} />
      <FormField control={control.paymentToIncomeRatio} />
    </Section>
  </Box>
);

const Step5Body: React.FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <Box className="space-y-4">
    <Section title="Личное">
      <FormField control={control.maritalStatus} />
      <FormField control={control.dependents} />
      <FormField control={control.education} />
    </Section>
    <Section title="Имущество">
      <FormField control={control.hasProperty} />
      <FormArraySection<PropertyItem>
        control={control.properties}
        itemComponent={PropertyItemForm}
        title="Имущество"
        addButtonLabel="+ Добавить имущество"
        emptyMessage="Имущество не добавлено"
        hasItems={control.hasProperty.value.value === true}
        initialValue={{
          type: 'apartment',
          description: '',
          estimatedValue: 0,
          hasEncumbrance: false,
        }}
      />
    </Section>
    <Section title="Существующие кредиты">
      <FormField control={control.hasExistingLoans} />
      <FormArraySection<ExistingLoanItem>
        control={control.existingLoans}
        itemComponent={ExistingLoanItemForm}
        title="Существующие кредиты"
        addButtonLabel="+ Добавить кредит"
        emptyMessage="Кредиты не добавлены"
        hasItems={control.hasExistingLoans.value.value === true}
        initialValue={{
          bank: '',
          type: '',
          amount: 0,
          remainingAmount: 0,
          monthlyPayment: 0,
          maturityDate: '',
        }}
      />
    </Section>
    <Section title="Созаемщики">
      <FormField control={control.hasCoBorrower} />
      <FormArraySection<CoBorrowerItem>
        control={control.coBorrowers}
        itemComponent={CoBorrowerItemForm}
        title="Созаемщики"
        addButtonLabel="+ Добавить созаемщика"
        emptyMessage="Созаемщики не добавлены"
        hasItems={control.hasCoBorrower.value.value === true}
        initialValue={{
          personalData: { lastName: '', firstName: '', middleName: '' },
          phone: '',
          email: '',
          relationship: '',
          monthlyIncome: 0,
        }}
      />
      <FormField control={control.coBorrowersIncome} />
    </Section>
  </Box>
);

const Step6Body: React.FC<{ control: FormProxy<CreditApplicationForm> }> = ({ control }) => (
  <Box className="space-y-4">
    <Section title="Согласия">
      <FormField control={control.agreePersonalData} />
      <FormField control={control.agreeCreditHistory} />
      <FormField control={control.agreeMarketing} />
      <FormField control={control.agreeTerms} />
    </Section>
    <Section title="Подтверждение">
      <FormField control={control.confirmAccuracy} />
      <FormField control={control.electronicSignature} />
    </Section>
  </Box>
);

// =====================================================================
// Render schema factory
// =====================================================================

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: () => void | Promise<void>,
): RenderSchemaProxy<CreditApplicationForm> {
  const steps: FormWizardStep<CreditApplicationForm>[] = [
    { number: 1, title: 'Кредит', icon: '💰', body: Step1Body },
    { number: 2, title: 'Личные', icon: '👤', body: Step2Body },
    { number: 3, title: 'Контакты', icon: '📞', body: Step3Body },
    { number: 4, title: 'Работа', icon: '💼', body: Step4Body },
    { number: 5, title: 'Доп. инфо', icon: '📋', body: Step5Body },
    { number: 6, title: 'Подтверждение', icon: '✅', body: Step6Body },
  ];

  return createRenderSchema<CreditApplicationForm>(() => ({
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      form,
      config: {
        stepValidations: STEP_VALIDATIONS,
        fullValidation,
      },
      steps,
      onSubmit,
    },
  }));
}

export { Button };
