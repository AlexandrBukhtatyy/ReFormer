// Credit application form schema (renderer-react v16)
// MCP-only sandbox iter-16, target=renderer-react.

import {
  createForm,
  type FieldConfig,
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
  email as emailValidator,
  pattern,
  applyWhen,
  validate,
} from '@reformer/core/validators';
import {
  computeFrom,
  copyFrom,
  resetWhen,
  watchField,
} from '@reformer/core/behaviors';
import {
  Input,
  InputMask,
  Textarea,
  Select,
  RadioGroup,
  Checkbox,
} from '@reformer/ui-kit';

import type {
  CreditApplicationForm,
  Education,
  EmploymentStatus,
  Gender,
  LoanType,
  MaritalStatus,
  PersonalData,
  PassportData,
  PropertyItem,
  PropertyType,
  ExistingLoan,
  CoBorrower,
  CoBorrowerPersonalData,
  Address,
} from './types';

// ----------------------------------------------------------------------------
// Options
// ----------------------------------------------------------------------------

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
  { value: 'postgraduate', label: 'Ученая степень' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Иное' },
];

// ----------------------------------------------------------------------------
// Async options (mock fetches)
// ----------------------------------------------------------------------------

type Option = { value: string; label: string };

const REGION_TO_CITIES: Record<string, Option[]> = {
  Москва: [{ value: 'moscow', label: 'Москва' }],
  'Санкт-Петербург': [{ value: 'spb', label: 'Санкт-Петербург' }],
  'Московская область': [
    { value: 'mytishchi', label: 'Мытищи' },
    { value: 'khimki', label: 'Химки' },
    { value: 'podolsk', label: 'Подольск' },
  ],
  'Ленинградская область': [
    { value: 'gatchina', label: 'Гатчина' },
    { value: 'vyborg', label: 'Выборг' },
  ],
};

const BRAND_TO_MODELS: Record<string, Option[]> = {
  Toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
  ],
  BMW: [
    { value: '3-series', label: '3 Series' },
    { value: '5-series', label: '5 Series' },
    { value: 'x5', label: 'X5' },
  ],
  Lada: [
    { value: 'vesta', label: 'Vesta' },
    { value: 'granta', label: 'Granta' },
  ],
};

async function fetchCitiesByRegion(region: string): Promise<Option[]> {
  await new Promise((r) => setTimeout(r, 250));
  return REGION_TO_CITIES[region] ?? [];
}

async function fetchModelsByBrand(brand: string): Promise<Option[]> {
  await new Promise((r) => setTimeout(r, 250));
  return BRAND_TO_MODELS[brand] ?? [];
}

// ----------------------------------------------------------------------------
// Async validator (email uniqueness)
// ----------------------------------------------------------------------------

const TAKEN_EMAILS = new Set(['taken@example.com', 'busy@mail.ru']);

const checkEmailUnique: AsyncValidatorFn<string> = async (value: string | null | undefined) => {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 350));
  return TAKEN_EMAILS.has(value.toLowerCase())
    ? { code: 'email-taken', message: 'Email уже используется' }
    : null;
};

const checkInnValid: AsyncValidatorFn<string> = async (value: string | null | undefined) => {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 250));
  if (!/^\d{12}$/.test(value)) {
    return { code: 'inn-format', message: 'Неверный формат ИНН' };
  }
  return null;
};

// ----------------------------------------------------------------------------
// Item factories (initialValue for FormArraySection — plain leaves only!)
// ----------------------------------------------------------------------------

export function createPropertyItem(): PropertyItem {
  return {
    type: 'apartment',
    description: '',
    estimatedValue: 0,
    hasEncumbrance: false,
  };
}

export function createExistingLoan(): ExistingLoan {
  return {
    bank: '',
    type: '',
    amount: 0,
    remainingAmount: 0,
    monthlyPayment: 0,
    maturityDate: '',
  };
}

export function createCoBorrower(): CoBorrower {
  return {
    personalData: { lastName: '', firstName: '', middleName: '' },
    phone: '',
    email: '',
    relationship: '',
    monthlyIncome: 0,
  };
}

// ----------------------------------------------------------------------------
// Item schemas (tuple form: [itemSchema])
// ----------------------------------------------------------------------------

const propertyItemSchema: FormSchema<PropertyItem> = {
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
    componentProps: {
      label: 'Описание',
      placeholder: 'Опишите имущество',
      rows: 2,
    },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: { label: 'Оценочная стоимость, ₽', type: 'number', min: 0 },
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
    componentProps: { label: 'Сумма кредита, ₽', type: 'number', min: 0 },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Остаток задолженности, ₽', type: 'number', min: 0 },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж, ₽', type: 'number', min: 0 },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};

const coBorrowerPersonalDataSchema: FormSchema<CoBorrowerPersonalData> = {
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Фамилия', placeholder: 'Фамилия' },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Имя' },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: { label: 'Отчество', placeholder: 'Отчество' },
  },
};

const coBorrowerItemSchema: FormSchema<CoBorrower> = {
  personalData: coBorrowerPersonalDataSchema,
  phone: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
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
    componentProps: { label: 'Ежемесячный доход, ₽', type: 'number', min: 0 },
  },
};

// ----------------------------------------------------------------------------
// Address sub-schemas
// ----------------------------------------------------------------------------

const REGION_OPTIONS = Object.keys(REGION_TO_CITIES).map((r) => ({ value: r, label: r }));

function makeAddressSchema(prefix: string): FormSchema<Address> {
  return {
    region: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Регион',
        placeholder: 'Выберите регион',
        options: REGION_OPTIONS,
        testId: `${prefix}-region`,
      },
    },
    city: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Город',
        placeholder: 'Сначала выберите регион',
        options: [] as Option[],
        testId: `${prefix}-city`,
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
  };
}

// ----------------------------------------------------------------------------
// Personal / Passport sub-schemas
// ----------------------------------------------------------------------------

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
  } satisfies FieldConfig<Gender>,
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
    componentProps: {
      label: 'Код подразделения',
      mask: '999-999',
      placeholder: '123-456',
    },
  },
};

// ----------------------------------------------------------------------------
// Form schema (root)
// ----------------------------------------------------------------------------
// Per common-mistakes recipe: extracting form into a typed local prevents
// TS2769 misleading errors with deep schemas.

const FORM_SCHEMA: FormSchema<CreditApplicationForm> = {
  // -------- Step 1: loan basics --------
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
      label: 'Сумма кредита, ₽',
      type: 'number',
      placeholder: 'Введите сумму',
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
      type: 'number',
      placeholder: 'Введите срок',
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
      rows: 3,
      maxLength: 500,
    },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости, ₽',
      type: 'number',
      placeholder: 'Введите стоимость',
      min: 1000000,
    },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос, ₽',
      type: 'number',
      placeholder: 'Введите сумму',
      readOnly: true,
    },
    disabled: true,
  },
  carBrand: {
    value: null,
    component: Select,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Выберите марку',
      options: Object.keys(BRAND_TO_MODELS).map((b) => ({ value: b, label: b })),
    },
  },
  carModel: {
    value: null,
    component: Select,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Сначала выберите марку',
      options: [] as Option[],
    },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      type: 'number',
      placeholder: '2020',
      min: 2000,
      max: new Date().getFullYear() + 1,
    },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля, ₽',
      type: 'number',
      placeholder: 'Введите стоимость',
      min: 300000,
      max: 10000000,
    },
  },

  // -------- Step 2: personal --------
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН',
      mask: '999999999999',
      placeholder: '123456789012',
    },
    asyncValidators: [checkInnValid],
    debounce: 500,
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'СНИЛС',
      mask: '999-999-999 99',
      placeholder: '123-456-789 00',
    },
  },

  // -------- Step 3: contacts --------
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
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'example@mail.com',
    },
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
    },
  },
  sameEmail: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Дополнительный email совпадает с основным' },
  },
  registrationAddress: makeAddressSchema('regAddr'),
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: makeAddressSchema('resAddr'),

  // -------- Step 4: employment --------
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
    componentProps: {
      label: 'ИНН компании',
      mask: '9999999999',
      placeholder: '1234567890',
    },
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
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход, ₽',
      type: 'number',
      placeholder: '0',
      min: 10000,
    },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный доход, ₽',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
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
    componentProps: {
      label: 'ИНН ИП',
      mask: '999999999999',
      placeholder: '123456789012',
    },
  },
  businessActivity: {
    value: null,
    component: Textarea,
    componentProps: {
      label: 'Вид деятельности',
      placeholder: 'Опишите вид деятельности',
      rows: 3,
    },
  },

  // -------- Step 5: extras --------
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_OPTIONS },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Количество иждивенцев',
      type: 'number',
      placeholder: '0',
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
  } satisfies FieldConfig<Education>,
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

  // -------- Step 6: confirmation --------
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
      mask: '999999',
      placeholder: '123456',
    },
  },

  // -------- Computed (read-only) --------
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя (computed)', readOnly: true },
    disabled: true,
  },
  age: {
    value: null,
    component: Input,
    componentProps: { label: 'Возраст, лет (computed)', type: 'number', readOnly: true },
    disabled: true,
  },
  interestRate: {
    value: 14,
    component: Input,
    componentProps: { label: 'Процентная ставка, % (computed)', type: 'number', readOnly: true },
    disabled: true,
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж, ₽ (computed)', type: 'number', readOnly: true },
    disabled: true,
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход, ₽ (computed)', type: 'number', readOnly: true },
    disabled: true,
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Платеж к доходу, % (computed)',
      type: 'number',
      readOnly: true,
    },
    disabled: true,
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Доход созаемщиков, ₽ (computed)',
      type: 'number',
      readOnly: true,
    },
    disabled: true,
  },
};

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму' });
  min(path.loanAmount, 50000);
  max(path.loanAmount, 10000000);
  required(path.loanTerm, { message: 'Введите срок' });
  min(path.loanTerm, 6);
  max(path.loanTerm, 240);
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10);
  maxLength(path.loanPurpose, 500);

  applyWhen(
    path.loanType,
    (v) => v === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1000000);
      // Cross-field: loanAmount <= propertyValue - initialPayment
      validate(p.loanAmount, (value, ctx) => {
        const pv = ctx.form.propertyValue.value.value;
        const ip = ctx.form.initialPayment.value.value;
        if (value != null && pv != null && ip != null && value > pv - ip) {
          return {
            code: 'loan-too-large',
            message: 'Сумма кредита не может превышать стоимость минус первоначальный взнос',
          };
        }
        return null;
      });
    }
  );

  applyWhen(
    path.loanType,
    (v) => v === 'car',
    (p) => {
      required(p.carBrand, { message: 'Выберите марку' });
      // G1-iter15: pattern accepts string | null | undefined directly
      minLength(p.carBrand, 2);
      maxLength(p.carBrand, 50);
      required(p.carModel, { message: 'Выберите модель' });
      minLength(p.carModel, 1);
      maxLength(p.carModel, 50);
      required(p.carYear, { message: 'Введите год выпуска' });
      min(p.carYear, 2000);
      max(p.carYear, new Date().getFullYear() + 1);
      required(p.carPrice, { message: 'Введите стоимость автомобиля' });
      min(p.carPrice, 300000);
      max(p.carPrice, 10000000);
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
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
  // G1-iter15: pattern accepts string|null directly — no validate() workaround needed.
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });

  required(path.snils);
  pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, {
    message: 'Неверный формат СНИЛС',
  });

  // Age 18..70 cross-field via age computed
  validate(path.personalData.birthDate, (value) => {
    if (!value) return null;
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
    if (years < 18) return { code: 'age-min', message: 'Возраст не менее 18 лет' };
    if (years > 70) return { code: 'age-max', message: 'Возраст не более 70 лет' };
    return null;
  });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain);
  pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Неверный формат телефона',
  });

  // G1-iter15: phone validator must accept string|null. Use pattern directly.
  pattern(path.phoneAdditional, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Неверный формат телефона',
  });

  required(path.email);
  emailValidator(path.email, { message: 'Неверный формат email' });

  // emailAdditional optional but if present, must be valid email
  emailValidator(path.emailAdditional, { message: 'Неверный формат email' });

  required(path.registrationAddress.region);
  required(path.registrationAddress.city);
  required(path.registrationAddress.street);
  required(path.registrationAddress.house);
  required(path.registrationAddress.postalCode);
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Индекс должен содержать 6 цифр',
  });

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region);
      required(p.residenceAddress.city);
      required(p.residenceAddress.street);
      required(p.residenceAddress.house);
      required(p.residenceAddress.postalCode);
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus);
  required(path.workExperienceTotal);
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent);
  min(path.workExperienceCurrent, 0);

  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value;
    if (value != null && total != null && value > total) {
      return {
        code: 'experience-mismatch',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      };
    }
    return null;
  });

  required(path.monthlyIncome);
  min(path.monthlyIncome, 10000);
  min(path.additionalIncome, 0);

  // additionalIncomeSource required when additionalIncome > 0
  validate(path.additionalIncomeSource, (value, ctx) => {
    const inc = ctx.form.additionalIncome.value.value;
    if (inc != null && inc > 0 && (!value || String(value).trim() === '')) {
      return {
        code: 'source-required',
        message: 'Укажите источник дополнительного дохода',
      };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (v) => v === 'employed',
    (p) => {
      required(p.companyName);
      required(p.companyInn, { message: 'Введите ИНН компании' });
      pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН компании — 10 цифр' });
      required(p.position);
    }
  );

  applyWhen(
    path.employmentStatus,
    (v) => v === 'selfEmployed',
    (p) => {
      required(p.businessType);
      required(p.businessInn, { message: 'Введите ИНН ИП' });
      pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН ИП — 12 цифр' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus);
  required(path.dependents);
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education);

  // Array items validations are applied via item schema during validation pass.
  // For simplicity we validate items via plain validate() blocks if needed.
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Required-true checkboxes
  validate(path.agreePersonalData, (v) =>
    v === true ? null : { code: 'consent-required', message: 'Необходимо согласие' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v === true ? null : { code: 'consent-required', message: 'Необходимо согласие' }
  );
  validate(path.agreeTerms, (v) =>
    v === true ? null : { code: 'consent-required', message: 'Необходимо согласие' }
  );
  validate(path.confirmAccuracy, (v) =>
    v === true ? null : { code: 'consent-required', message: 'Подтвердите точность данных' }
  );
  required(path.electronicSignature);
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

// ----------------------------------------------------------------------------
// Behavior (computed + copy + reset + async-options)
// ----------------------------------------------------------------------------

function annuity(amount: number, term: number, ratePct: number): number {
  if (!amount || !term || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = term;
  return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 fullName = lastName + firstName + middleName
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName].filter(Boolean).join(' ')
  );

  // C.5 age from birthDate
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => {
      if (!personalData.birthDate) return null;
      const dob = new Date(personalData.birthDate);
      if (Number.isNaN(dob.getTime())) return null;
      const now = new Date();
      let years = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
      return years;
    }
  );

  // C.3 initialPayment = 20% of propertyValue (only for mortgage — no condition arg
  // because the field is hidden when not mortgage)
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue != null ? Math.round(propertyValue * 0.2) : null
  );

  // C.1 interestRate by loanType (and optionally region/property — simplified here)
  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    ({ loanType, hasProperty }: CreditApplicationForm) => {
      const base: Record<string, number> = {
        consumer: 18,
        mortgage: 9,
        car: 12,
        business: 15,
        refinance: 11,
      };
      let rate = base[loanType] ?? 14;
      if (hasProperty) rate -= 0.5; // collateral discount
      return rate;
    }
  );

  // C.2 monthlyPayment via 3 watchers (one watcher per trigger pattern)
  function recomputeMonthlyPayment(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const amount = ctx.form.loanAmount.value.value as number | null;
    const term = ctx.form.loanTerm.value.value as number | null;
    const rate = ctx.form.interestRate.value.value as number;
    if (!amount || !term || !rate) return;
    const monthly = annuity(amount, term, rate);
    const cur = ctx.form.monthlyPayment.value.value as number;
    if (Math.abs(cur - monthly) > 0.01) {
      ctx.form.monthlyPayment.setValue(monthly);
    }
  }
  watchField(path.loanAmount, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
  watchField(path.loanTerm, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
  watchField(path.interestRate, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });

  // C.6 totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.7 paymentToIncomeRatio = (monthlyPayment / totalIncome) * 100
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome) return 0;
      return Math.round((monthlyPayment / totalIncome) * 1000) / 10;
    }
  );

  // C.8 coBorrowersIncome = sum of coBorrowers[].monthlyIncome
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, cb) => sum + (cb.monthlyIncome ?? 0), 0)
  );

  // ---- copyFrom: emailAdditional <- email when sameEmail
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // copyFrom: residenceAddress <- registrationAddress when sameAsRegistration
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // ---- resetWhen: reset loanType-specific fields
  resetWhen(path.propertyValue, (form) => form.loanType !== 'mortgage', { resetValue: null });
  resetWhen(path.carBrand, (form) => form.loanType !== 'car', { resetValue: null });
  resetWhen(path.carModel, (form) => form.loanType !== 'car', { resetValue: null });
  resetWhen(path.carYear, (form) => form.loanType !== 'car', { resetValue: null });
  resetWhen(path.carPrice, (form) => form.loanType !== 'car', { resetValue: null });

  // employed-only fields
  resetWhen(path.companyName, (form) => form.employmentStatus !== 'employed', { resetValue: null });
  resetWhen(path.companyInn, (form) => form.employmentStatus !== 'employed', { resetValue: null });
  resetWhen(path.companyPhone, (form) => form.employmentStatus !== 'employed', { resetValue: null });
  resetWhen(path.companyAddress, (form) => form.employmentStatus !== 'employed', { resetValue: null });
  resetWhen(path.position, (form) => form.employmentStatus !== 'employed', { resetValue: null });

  // selfEmployed-only fields
  resetWhen(path.businessType, (form) => form.employmentStatus !== 'selfEmployed', { resetValue: null });
  resetWhen(path.businessInn, (form) => form.employmentStatus !== 'selfEmployed', { resetValue: null });
  resetWhen(path.businessActivity, (form) => form.employmentStatus !== 'selfEmployed', { resetValue: null });

  // carBrand change → clear carModel (separate watchField)
  watchField(
    path.carBrand,
    (brand, ctx) => {
      if (!brand) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        ctx.form.carModel.setValue(null);
        return;
      }
      void (async () => {
        const opts = await fetchModelsByBrand(brand);
        ctx.form.carModel.updateComponentProps({ options: opts });
        ctx.form.carModel.setValue(null);
      })();
    },
    { debounce: 300 }
  );

  // ---- Async options: city by region
  watchField(
    path.registrationAddress.region,
    (region, ctx) => {
      if (!region) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        ctx.form.registrationAddress.city.setValue('');
        return;
      }
      void (async () => {
        const opts = await fetchCitiesByRegion(region);
        ctx.form.registrationAddress.city.updateComponentProps({ options: opts });
        ctx.form.registrationAddress.city.setValue('');
      })();
    },
    { debounce: 300 }
  );

  watchField(
    path.residenceAddress.region,
    (region, ctx) => {
      if (!region) {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        ctx.form.residenceAddress.city.setValue('');
        return;
      }
      void (async () => {
        const opts = await fetchCitiesByRegion(region);
        ctx.form.residenceAddress.city.updateComponentProps({ options: opts });
        ctx.form.residenceAddress.city.setValue('');
      })();
    },
    { debounce: 300 }
  );

  // ---- Array clear on toggle off
  watchField(
    path.hasProperty,
    (v, ctx) => {
      if (!v) ctx.form.properties.clear();
    },
    { immediate: false }
  );
  watchField(
    path.hasExistingLoans,
    (v, ctx) => {
      if (!v) ctx.form.existingLoans.clear();
    },
    { immediate: false }
  );
  watchField(
    path.hasCoBorrower,
    (v, ctx) => {
      if (!v) ctx.form.coBorrowers.clear();
    },
    { immediate: false }
  );
};

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export type CreditApplicationFormProxy = FormProxy<CreditApplicationForm>;

export function createCreditApplicationForm(): CreditApplicationFormProxy {
  return createForm<CreditApplicationForm>({
    form: FORM_SCHEMA,
    validation: fullValidation,
    behavior,
  });
}
