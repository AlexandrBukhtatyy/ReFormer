import {
  createForm,
  type FormProxy,
  type FormSchema,
  type FieldConfig,
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
  email as emailValidator,
  applyWhen,
  validate,
  validateItems,
} from '@reformer/core/validators';
import {
  computeFrom,
  watchField,
  copyFrom,
} from '@reformer/core/behaviors';
import {
  Input,
  InputMask,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
} from '@reformer/ui-kit';

import type {
  CreditApplicationForm,
  LoanType,
  Gender,
  EmploymentStatus,
  MaritalStatus,
  Education,
  PropertyType,
} from './types';

// Static option lists
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

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / Самозанятый' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
  { value: 'divorced', label: 'Разведён / разведена' },
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

const CURRENT_YEAR = new Date().getFullYear();

// Mock async validators
const checkEmailUnique: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((resolve) => setTimeout(resolve, 400));
  // Simulate "taken" for a specific email
  if (value === 'taken@example.com') {
    return { code: 'email-taken', message: 'Email уже зарегистрирован' };
  }
  return null;
};

const checkInnValid: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((resolve) => setTimeout(resolve, 400));
  // Mock validation: any 12 digits passes; '000000000000' fails
  if (value === '000000000000') {
    return { code: 'inn-invalid', message: 'ИНН не найден в базе' };
  }
  return null;
};

// Mock async option loaders
async function fetchCitiesByRegion(region: string): Promise<{ value: string; label: string }[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!region) return [];
  return [
    { value: `${region}-city-1`, label: `${region} - Город 1` },
    { value: `${region}-city-2`, label: `${region} - Город 2` },
    { value: `${region}-city-3`, label: `${region} - Город 3` },
  ];
}

async function fetchCarModelsByBrand(brand: string): Promise<{ value: string; label: string }[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!brand) return [];
  const map: Record<string, string[]> = {
    Toyota: ['Camry', 'Corolla', 'RAV4'],
    Lada: ['Granta', 'Vesta', 'Niva'],
    BMW: ['X5', 'X3', '3 Series'],
  };
  const models = map[brand] ?? [`${brand} Model 1`, `${brand} Model 2`];
  return models.map((m) => ({ value: m, label: m }));
}

// Annuity formula
function annuity(amount: number, term: number, rate: number): number {
  if (!amount || !term || !rate) return 0;
  const r = rate / 100 / 12;
  return Math.round((amount * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1));
}

// Form schema
const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1
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
      placeholder: 'Введите сумму',
      type: 'number',
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
      testId: 'loanTerm',
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
      testId: 'propertyValue',
    },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Автоматически 20% от стоимости',
      type: 'number',
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
      options: [],
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
      testId: 'carPrice',
    },
  },

  // Step 2 — Personal data (nested)
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
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date', testId: 'birthDate' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: {
        label: 'Пол',
        options: GENDER_OPTIONS,
        testId: 'gender',
      },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения', testId: 'birthPlace' },
    },
  },
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Серия паспорта',
        mask: '99 99',
        placeholder: '12 34',
        testId: 'series',
      },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Номер паспорта',
        mask: '999999',
        placeholder: '123456',
        testId: 'number',
      },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата выдачи', type: 'date', testId: 'issueDate' },
    },
    issuedBy: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Кем выдан',
        placeholder: 'Введите название органа',
        testId: 'issuedBy',
      },
    },
    departmentCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Код подразделения',
        mask: '999-999',
        placeholder: '123-456',
        testId: 'departmentCode',
      },
    },
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
      testId: 'snils',
    },
  },

  // Step 3 — Contacts
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
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'example@mail.com',
      testId: 'email',
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
      testId: 'emailAdditional',
    },
  },
  registrationAddress: {
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
        options: [],
        testId: 'city',
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
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: 'postalCode',
      },
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
      componentProps: { label: 'Регион', placeholder: 'Введите регион', testId: 'region' },
    },
    city: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        options: [],
        testId: 'city',
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
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: 'postalCode',
      },
    },
  },

  // Step 4 — Employment
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
      placeholder: '0',
      type: 'number',
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
    componentProps: {
      label: 'Тип бизнеса',
      placeholder: 'ИП, ООО и т.д.',
      testId: 'businessType',
    },
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
      rows: 3,
      testId: 'businessActivity',
    },
  },

  // Step 5 — Additional
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
    componentProps: {
      label: 'Количество иждивенцев',
      placeholder: '0',
      type: 'number',
      testId: 'dependents',
    },
  },
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
    componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
  },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
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
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Оценочная стоимость',
          placeholder: '0',
          type: 'number',
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
        componentProps: {
          label: 'Сумма кредита',
          placeholder: '0',
          type: 'number',
          testId: 'amount',
        },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности',
          placeholder: '0',
          type: 'number',
          testId: 'remainingAmount',
        },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платеж',
          placeholder: '0',
          type: 'number',
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
        componentProps: {
          label: 'Ежемесячный доход',
          placeholder: '0',
          type: 'number',
          testId: 'monthlyIncome',
        },
      },
    },
  ],

  // Step 6 — Confirmation
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

  // Computed (top-level readonly)
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
  interestRate: {
    value: 12,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true, testId: 'interestRate' },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number', readOnly: true, testId: 'monthlyPayment' },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true, testId: 'totalIncome' },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процент платежа от дохода (%)', type: 'number', readOnly: true, testId: 'paymentToIncomeRatio' },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаемщиков (₽)', type: 'number', readOnly: true, testId: 'coBorrowersIncome' },
  },
};

// Validation
const validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Step 1
  required(path.loanType);
  required(path.loanAmount, { message: 'Введите сумму' });
  min(path.loanAmount, 50000);
  max(path.loanAmount, 10000000);
  required(path.loanTerm);
  min(path.loanTerm, 6);
  max(path.loanTerm, 240);
  required(path.loanPurpose);
  minLength(path.loanPurpose, 10);
  maxLength(path.loanPurpose, 500);

  applyWhen(
    path.loanType,
    (lt) => lt === 'mortgage',
    (p) => {
      required(p.propertyValue);
      min(p.propertyValue, 1000000);
    }
  );

  applyWhen(
    path.loanType,
    (lt) => lt === 'car',
    (p) => {
      required(p.carBrand);
      minLength(p.carBrand, 2);
      maxLength(p.carBrand, 50);
      required(p.carModel);
      minLength(p.carModel, 1);
      maxLength(p.carModel, 50);
      required(p.carYear);
      min(p.carYear, 2000);
      max(p.carYear, CURRENT_YEAR + 1);
      required(p.carPrice);
      min(p.carPrice, 300000);
      max(p.carPrice, 10000000);
    }
  );

  // Step 2
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

  // Cross-field — age (computed) must be 18-70
  validate(path.age, (value) => {
    if (value == null) return null;
    if (value < 18) return { code: 'age-too-young', message: 'Возраст не может быть менее 18 лет' };
    if (value > 70) return { code: 'age-too-old', message: 'Возраст не может превышать 70 лет' };
    return null;
  });

  // Step 3
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
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region);
      required(p.residenceAddress.city);
      required(p.residenceAddress.street);
      required(p.residenceAddress.house);
      required(p.residenceAddress.postalCode);
    }
  );

  // Step 4
  required(path.employmentStatus);
  required(path.workExperienceTotal);
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent);
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome);
  min(path.monthlyIncome, 10000);
  min(path.additionalIncome, 0);

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value;
    if (total != null && value != null && value > total) {
      return {
        code: 'experience-mismatch',
        message: 'Стаж на текущем месте не может превышать общий стаж',
      };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
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
    (s) => s === 'selfEmployed',
    (p) => {
      required(p.businessType);
      required(p.businessInn);
      required(p.businessActivity);
    }
  );

  // additionalIncomeSource required when additionalIncome > 0
  validate(path.additionalIncomeSource, (value, ctx) => {
    const inc = ctx.form.additionalIncome.value.value;
    if (inc != null && inc > 0 && (!value || value.length === 0)) {
      return {
        code: 'income-source-required',
        message: 'Укажите источник дополнительного дохода',
      };
    }
    return null;
  });

  // Step 5
  required(path.maritalStatus);
  required(path.dependents);
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education);

  // Properties array (when hasProperty)
  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (item) => {
        required(item.type);
        required(item.description);
        required(item.estimatedValue);
        min(item.estimatedValue, 0);
      });
    }
  );

  // Existing loans array (when hasExistingLoans)
  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (item) => {
        required(item.bank);
        required(item.type);
        required(item.amount);
        min(item.amount, 0);
        required(item.remainingAmount);
        min(item.remainingAmount, 0);
        required(item.monthlyPayment);
        min(item.monthlyPayment, 0);
        required(item.maturityDate);
        // Cross-field: remainingAmount <= amount
        validate(item.remainingAmount, (value, ctx) => {
          const amt = (ctx.form as unknown as { amount: { value: { value: number } } }).amount.value.value;
          if (amt != null && value != null && value > amt) {
            return {
              code: 'remaining-exceeds-amount',
              message: 'Остаток не может превышать сумму кредита',
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
      validateItems(p.coBorrowers, (item) => {
        required(item.personalData.lastName);
        required(item.personalData.firstName);
        required(item.personalData.middleName);
        required(item.personalData.birthDate);
        required(item.personalData.gender);
        required(item.phone);
        required(item.email);
        emailValidator(item.email);
        required(item.relationship);
        required(item.monthlyIncome);
        min(item.monthlyIncome, 0);
      });
    }
  );

  // Step 6
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
    v === true ? null : { code: 'must-confirm', message: 'Подтвердите точность данных' }
  );
  required(path.electronicSignature);
  pattern(path.electronicSignature, /^\d{6}$/, { message: '6-значный код' });

  // paymentToIncomeRatio < 50%
  validate(path.paymentToIncomeRatio, (v) => {
    if (v == null) return null;
    if (v > 50) {
      return {
        code: 'pti-too-high',
        message: 'Платёж превышает 50% дохода',
      };
    }
    return null;
  });
};

// Behavior
const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 — fullName
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  // C.5 — age
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => {
      if (!personalData.birthDate) return null;
      const today = new Date();
      const birth = new Date(personalData.birthDate);
      if (Number.isNaN(birth.getTime())) return null;
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age;
    }
  );

  // C.3 — initialPayment (20% of propertyValue, when mortgage)
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue ? Math.round(propertyValue * 0.2) : null,
    {
      condition: (form) => form.loanType === 'mortgage',
    }
  );

  // C.6 — totalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.8 — coBorrowersIncome (sum of array items)
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, b) => sum + (b.monthlyIncome ?? 0), 0)
  );

  // C.1 — interestRate (depends on loanType, region, hasProperty, properties).
  // Use watchField on each trigger; common compute fn.
  // Note: watchField on nested paths infers TForm from the leaf's parent group;
  // we cast ctx.form to FormProxy<CreditApplicationForm> for cross-group reads.
  const recomputeInterestRate = (ctx: { form: unknown }) => {
    const f = ctx.form as FormProxy<CreditApplicationForm>;
    const lt = f.loanType.value.value;
    const region = f.registrationAddress.region.value.value;
    const hasProperty = f.hasProperty.value.value;
    let rate = 12;
    if (lt === 'mortgage') rate = 9;
    else if (lt === 'car') rate = 11;
    else if (lt === 'business') rate = 13;
    else if (lt === 'refinance') rate = 10;
    if (region && region.toLowerCase().includes('москва')) rate -= 0.5;
    if (hasProperty === true) rate -= 1;
    if (Math.abs(f.interestRate.value.value - rate) > 0.001) {
      f.interestRate.setValue(rate);
    }
  };
  watchField(path.loanType, (_v, ctx) => recomputeInterestRate(ctx), { immediate: true });
  watchField(
    path.registrationAddress.region,
    (_v, ctx) => recomputeInterestRate(ctx),
    { immediate: false }
  );
  watchField(path.hasProperty, (_v, ctx) => recomputeInterestRate(ctx), {
    immediate: false,
  });

  // C.2 — monthlyPayment (annuity)
  const recomputeMonthlyPayment = (ctx: { form: unknown }) => {
    const f = ctx.form as FormProxy<CreditApplicationForm>;
    const amount = f.loanAmount.value.value;
    const term = f.loanTerm.value.value;
    const rate = f.interestRate.value.value;
    if (!amount || !term || !rate) return;
    const monthly = annuity(amount, term, rate);
    if (Math.abs(f.monthlyPayment.value.value - monthly) > 0.01) {
      f.monthlyPayment.setValue(monthly);
    }
  };
  watchField(path.loanAmount, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
  watchField(path.loanTerm, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
  watchField(path.interestRate, (_v, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });

  // C.7 — paymentToIncomeRatio
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) =>
      totalIncome > 0 ? Math.round((monthlyPayment / totalIncome) * 100) : 0
  );

  // sameAsRegistration → copy registrationAddress to residenceAddress
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // Async option loading: cities by region
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      ctx.form.registrationAddress.city.setValue('');
      const opts = await fetchCitiesByRegion(region);
      ctx.form.registrationAddress.city.updateComponentProps({ options: opts });
    },
    { debounce: 300 }
  );

  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      ctx.form.residenceAddress.city.setValue('');
      const opts = await fetchCitiesByRegion(region);
      ctx.form.residenceAddress.city.updateComponentProps({ options: opts });
    },
    { debounce: 300 }
  );

  // Async option loading: car models by brand
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      ctx.form.carModel.setValue(null);
      if (!brand) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        return;
      }
      const opts = await fetchCarModelsByBrand(brand);
      ctx.form.carModel.updateComponentProps({ options: opts });
    },
    { debounce: 300 }
  );
};

export function createCreditForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation,
    behavior,
  });
}
