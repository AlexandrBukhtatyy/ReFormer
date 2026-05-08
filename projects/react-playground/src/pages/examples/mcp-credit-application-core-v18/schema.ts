/**
 * iter-18 / target=core — Credit application form schema.
 * Generated MCP-only. See ../discovery.md / dev-plan.md / dev-report.md
 * in .tmp/iter-artifacts/iter-18/core/.
 */
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
  pattern,
  email,
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
  Checkbox,
  Textarea,
  RadioGroup,
} from '@reformer/ui-kit';

// ============================================================================
// Types
// ============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
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
  birthDate: string;
};

export type CoBorrower = {
  personalData: CoBorrowerPersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

export type CreditApplicationForm = {
  // Step 1 — loan
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

  // Step 2 — personal
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3 — contacts
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Step 4 — employment
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

  // Step 6 — confirmation
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed
  fullName: string;
  age: number | null;
  totalIncome: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  paymentToIncomeRatio: number | null;
  coBorrowersIncome: number | null;
};

// ============================================================================
// Schema (component + componentProps in fields; FormField in JSX without props)
// ============================================================================

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
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_OPTIONS = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'В браке' },
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
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Другое' },
];

const formSchema: FormSchema<CreditApplicationForm> = {
  // ---- Step 1: Loan ----
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
      maxLength: 500,
      testId: 'loanPurpose',
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
      placeholder: 'Вычисляется автоматически',
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
      type: 'number',
      placeholder: '2020',
      testId: 'carYear',
    },
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

  // ---- Step 2: Personal ----
  personalData: {
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
        testId: 'passportData-series',
      },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Номер паспорта',
        mask: '999999',
        placeholder: '123456',
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
        mask: '999-999',
        placeholder: '123-456',
        testId: 'passportData-departmentCode',
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

  // ---- Step 3: Contacts ----
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
      componentProps: {
        label: 'Регион',
        placeholder: 'Введите регион',
        testId: 'registrationAddress-region',
      },
    },
    city: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'registrationAddress-city',
      },
    },
    street: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Улица',
        placeholder: 'Введите улицу',
        testId: 'registrationAddress-street',
      },
    },
    house: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дом',
        placeholder: '№',
        testId: 'registrationAddress-house',
      },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Квартира',
        placeholder: '№',
        testId: 'registrationAddress-apartment',
      },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: 'registrationAddress-postalCode',
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
      componentProps: {
        label: 'Регион',
        placeholder: 'Введите регион',
        testId: 'residenceAddress-region',
      },
    },
    city: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Город',
        placeholder: 'Введите город',
        testId: 'residenceAddress-city',
      },
    },
    street: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Улица',
        placeholder: 'Введите улицу',
        testId: 'residenceAddress-street',
      },
    },
    house: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Дом',
        placeholder: '№',
        testId: 'residenceAddress-house',
      },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: {
        label: 'Квартира',
        placeholder: '№',
        testId: 'residenceAddress-apartment',
      },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: {
        label: 'Индекс',
        mask: '999999',
        placeholder: '000000',
        testId: 'residenceAddress-postalCode',
      },
    },
  },

  // ---- Step 4: Employment ----
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
    componentProps: {
      label: 'Адрес компании',
      placeholder: 'Полный адрес',
      testId: 'companyAddress',
    },
  },
  position: {
    value: null,
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
      testId: 'businessActivity',
    },
  },

  // ---- Step 5: Additional ----
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
    componentProps: {
      label: 'У меня есть имущество',
      testId: 'hasProperty',
    },
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
          testId: 'type',
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Описание',
          placeholder: 'Опишите имущество',
          testId: 'description',
        },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Оценочная стоимость (₽)',
          type: 'number',
          placeholder: '0',
          testId: 'estimatedValue',
        },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: {
          label: 'Имеется обременение (залог)',
          testId: 'hasEncumbrance',
        },
      },
    },
  ],
  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'У меня есть другие кредиты',
      testId: 'hasExistingLoans',
    },
  },
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
      },
      type: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Тип кредита',
          placeholder: 'Тип кредита',
          testId: 'type',
        },
      },
      amount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Сумма кредита (₽)',
          type: 'number',
          placeholder: '0',
          testId: 'amount',
        },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности (₽)',
          type: 'number',
          placeholder: '0',
          testId: 'remainingAmount',
        },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платёж (₽)',
          type: 'number',
          placeholder: '0',
          testId: 'monthlyPayment',
        },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Дата погашения',
          type: 'date',
          testId: 'maturityDate',
        },
      },
    },
  ],
  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Добавить созаемщика',
      testId: 'hasCoBorrower',
    },
  },
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Фамилия созаемщика',
            placeholder: 'Введите фамилию',
            testId: 'personalData-lastName',
          },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Имя созаемщика',
            placeholder: 'Введите имя',
            testId: 'personalData-firstName',
          },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Отчество созаемщика',
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
        componentProps: {
          label: 'Email',
          type: 'email',
          placeholder: 'example@mail.com',
          testId: 'email',
        },
      },
      relationship: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Родство',
          placeholder: 'Укажите родство',
          testId: 'relationship',
        },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: {
          label: 'Ежемесячный доход (₽)',
          type: 'number',
          placeholder: '0',
          testId: 'monthlyIncome',
        },
      },
    },
  ],

  // ---- Step 6: Confirmation ----
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
      mask: '999999',
      placeholder: '123456',
      testId: 'electronicSignature',
    },
  },

  // ---- Computed (readonly Inputs) ----
  fullName: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Полное имя',
      readOnly: true,
      testId: 'fullName',
    },
  },
  age: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Возраст (лет)',
      type: 'number',
      readOnly: true,
      testId: 'age',
    },
  },
  totalIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Общий доход (₽)',
      type: 'number',
      readOnly: true,
      testId: 'totalIncome',
    },
  },
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
      label: 'Ежемесячный платёж (₽)',
      type: 'number',
      readOnly: true,
      testId: 'monthlyPayment',
    },
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
      label: 'Доход созаёмщиков (₽)',
      type: 'number',
      readOnly: true,
      testId: 'coBorrowersIncome',
    },
  },
};

// ============================================================================
// Helpers
// ============================================================================

function calcAgeFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    years--;
  }
  return years;
}

function annuityMonthly(P: number, n: number, ratePct: number): number {
  if (!P || !n || !ratePct) return 0;
  const i = ratePct / 100 / 12;
  if (i <= 0) return Math.round(P / n);
  const factor = Math.pow(1 + i, n);
  return Math.round((P * i * factor) / (factor - 1));
}

function baseRateFor(loanType: LoanType): number {
  switch (loanType) {
    case 'mortgage':
      return 8.5;
    case 'car':
      return 11;
    case 'consumer':
      return 16;
    case 'business':
      return 14;
    case 'refinancing':
      return 12;
    default:
      return 14;
  }
}

// ============================================================================
// Async validators (stubs — emulate API per spec)
// ============================================================================

const asyncEmailUnique: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 200));
  // Simulated server reservation
  if (value.toLowerCase() === 'taken@mail.com') {
    return { code: 'email-taken', message: 'Email уже зарегистрирован' };
  }
  return null;
};

// Hook async validator into email field via mutation (post-schema)
formSchema.email = {
  ...formSchema.email,
  asyncValidators: [asyncEmailUnique],
} as typeof formSchema.email;

// ============================================================================
// Validation
// ============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма — 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhen(
    path.loanType,
    (v) => v === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1_000_000, { message: 'Минимум 1 000 000 ₽' });
    }
  );

  applyWhen(
    path.loanType,
    (v) => v === 'car',
    (p) => {
      required(p.carBrand, { message: 'Введите марку' });
      minLength(p.carBrand, 2);
      maxLength(p.carBrand, 50);
      required(p.carModel, { message: 'Введите модель' });
      minLength(p.carModel, 1);
      maxLength(p.carModel, 50);
      required(p.carYear, { message: 'Введите год выпуска' });
      min(p.carYear, 2000, { message: 'Минимум 2000' });
      max(p.carYear, new Date().getFullYear() + 1, {
        message: 'Год не может быть в будущем',
      });
      required(p.carPrice, { message: 'Введите стоимость' });
      min(p.carPrice, 300000);
      max(p.carPrice, 10000000);
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Введите дату рождения' });
  required(path.personalData.gender, { message: 'Укажите пол' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });

  required(path.passportData.series, { message: 'Введите серию паспорта' });
  pattern(path.passportData.series, /^\d{2} \d{2}$/, {
    message: 'Формат: 12 34',
  });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  pattern(path.passportData.number, /^\d{6}$/, { message: '6 цифр' });
  required(path.passportData.issueDate, { message: 'Введите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Введите код' });
  pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, {
    message: 'Формат: 123-456',
  });

  required(path.inn, { message: 'Введите ИНН' });
  pattern(path.inn, /^\d{12}$/, { message: '12 цифр' });
  required(path.snils, { message: 'Введите СНИЛС' });
  pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'Формат: 123-456-789 00' });

  // Cross-field — age 18-70 from birthDate
  validate(path.personalData.birthDate, (value) => {
    const age = calcAgeFromIso(value as string);
    if (age == null) return null;
    if (age < 18) return { code: 'age-min', message: 'Минимальный возраст — 18 лет' };
    if (age > 70) return { code: 'age-max', message: 'Максимальный возраст — 70 лет' };
    return null;
  });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите телефон' });
  pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
    message: 'Формат: +7 (___) ___-__-__',
  });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Некорректный email' });

  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите дом' });
  required(path.registrationAddress.postalCode, { message: 'Введите индекс' });
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, { message: '6 цифр' });

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region, { message: 'Введите регион' });
      required(p.residenceAddress.city, { message: 'Введите город' });
      required(p.residenceAddress.street, { message: 'Введите улицу' });
      required(p.residenceAddress.house, { message: 'Введите дом' });
      required(p.residenceAddress.postalCode, { message: 'Введите индекс' });
      pattern(p.residenceAddress.postalCode, /^\d{6}$/, { message: '6 цифр' });
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });

  applyWhen(
    path.employmentStatus,
    (v) => v === 'employed',
    (p) => {
      required(p.companyName, { message: 'Укажите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      pattern(p.companyInn, /^\d{10}$/, { message: '10 цифр' });
      required(p.companyPhone, { message: 'Введите телефон компании' });
      required(p.companyAddress, { message: 'Введите адрес компании' });
      required(p.position, { message: 'Введите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (v) => v === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Введите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН' });
      pattern(p.businessInn, /^\d{12}$/, { message: '12 цифр' });
      required(p.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );

  required(path.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Введите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });
  min(path.additionalIncome, 0);

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validate(path.workExperienceCurrent, (value, ctx) => {
    const current = value as number | null;
    const total = ctx.form.workExperienceTotal.value.value as number | null;
    if (current == null || total == null) return null;
    if (current > total) {
      return {
        code: 'experience-mismatch',
        message: 'Текущий стаж не может быть больше общего',
      };
    }
    return null;
  });

  // Conditional: additionalIncomeSource required if additionalIncome > 0
  applyWhen(
    path.additionalIncome,
    (v) => v != null && (v as number) > 0,
    (p) => {
      required(p.additionalIncomeSource, {
        message: 'Укажите источник дополнительного дохода',
      });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Введите количество иждивенцев' });
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education, { message: 'Выберите уровень образования' });

  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, (itemPath) => {
        required(itemPath.type, { message: 'Выберите тип' });
        required(itemPath.description, { message: 'Опишите имущество' });
        required(itemPath.estimatedValue, { message: 'Укажите стоимость' });
        min(itemPath.estimatedValue, 0);
      });
    }
  );

  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (itemPath) => {
        required(itemPath.bank, { message: 'Введите название банка' });
        required(itemPath.type, { message: 'Введите тип кредита' });
        required(itemPath.amount, { message: 'Введите сумму' });
        min(itemPath.amount, 0);
        required(itemPath.remainingAmount, { message: 'Введите остаток' });
        min(itemPath.remainingAmount, 0);
        required(itemPath.monthlyPayment, { message: 'Введите платёж' });
        min(itemPath.monthlyPayment, 0);
        required(itemPath.maturityDate, { message: 'Введите дату погашения' });

        // Cross-field — remaining <= amount
        validate(itemPath.remainingAmount, (value, ctx) => {
          // Inside an array item — ctx.form is whole form; we cannot easily read sibling
          // for a particular index here without a path reference. Use the value-level guard.
          const remaining = value as number | null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const amount = (ctx as any).item?.amount?.value?.value as number | undefined;
          if (remaining == null || amount == null) return null;
          if (remaining > amount) {
            return {
              code: 'remaining-too-large',
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
        required(itemPath.personalData.lastName, { message: 'Введите фамилию' });
        required(itemPath.personalData.firstName, { message: 'Введите имя' });
        required(itemPath.personalData.middleName, { message: 'Введите отчество' });
        required(itemPath.personalData.birthDate, { message: 'Введите дату рождения' });
        required(itemPath.phone, { message: 'Введите телефон' });
        pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
          message: 'Формат: +7 (___) ___-__-__',
        });
        required(itemPath.email, { message: 'Введите email' });
        email(itemPath.email, { message: 'Некорректный email' });
        required(itemPath.relationship, { message: 'Укажите родство' });
        required(itemPath.monthlyIncome, { message: 'Введите доход' });
        min(itemPath.monthlyIncome, 0);
      });
    }
  );
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.agreePersonalData, (v) =>
    v === true ? null : { code: 'agree-pd', message: 'Необходимо согласие' }
  );
  validate(path.agreeCreditHistory, (v) =>
    v === true ? null : { code: 'agree-ch', message: 'Необходимо согласие' }
  );
  validate(path.agreeTerms, (v) =>
    v === true ? null : { code: 'agree-terms', message: 'Необходимо согласие' }
  );
  validate(path.confirmAccuracy, (v) =>
    v === true ? null : { code: 'confirm-accuracy', message: 'Подтвердите точность' }
  );
  required(path.electronicSignature, { message: 'Введите код' });
  pattern(path.electronicSignature, /^\d{6}$/, { message: '6 цифр' });
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

// ============================================================================
// Behavior — computed fields, async options, copy-from
// ============================================================================

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 — fullName from personalData (group subscription)
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  // C.5 — age from birthDate
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => calcAgeFromIso(personalData.birthDate)
  );

  // C.6 — totalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.3 — initialPayment = 20% propertyValue
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue == null ? null : Math.round(propertyValue * 0.2)
  );

  // C.1 — interestRate (depends on loanType, region, hasProperty, properties[])
  // Use watchField cascade because we want triggers from group + array.
  watchField(
    path.loanType,
    (loanType, ctx) => {
      const base = baseRateFor(loanType as LoanType);
      const hasProp = ctx.form.hasProperty.value.value as boolean;
      const region = ctx.form.registrationAddress.region.value.value as string;
      // Simple modifier: -0.5 if hasProperty, +0.25 if not Moscow region
      let rate = base;
      if (hasProp) rate -= 0.5;
      if (region && region.toLowerCase() !== 'москва') rate += 0.25;
      const cur = ctx.form.interestRate.value.value as number | null;
      if (cur === null || Math.abs((cur ?? 0) - rate) > 0.001) {
        ctx.form.interestRate.setValue(rate);
      }
    },
    { immediate: true }
  );
  watchField(
    path.hasProperty,
    (_v, ctx) => {
      const loanType = ctx.form.loanType.value.value as LoanType;
      const hasProp = ctx.form.hasProperty.value.value as boolean;
      const region = ctx.form.registrationAddress.region.value.value as string;
      let rate = baseRateFor(loanType);
      if (hasProp) rate -= 0.5;
      if (region && region.toLowerCase() !== 'москва') rate += 0.25;
      ctx.form.interestRate.setValue(rate);
    },
    { immediate: false }
  );
  watchField(
    path.registrationAddress.region,
    (_v, ctx) => {
      const loanType = ctx.form.loanType.value.value as LoanType;
      const hasProp = ctx.form.hasProperty.value.value as boolean;
      const region = ctx.form.registrationAddress.region.value.value as string;
      let rate = baseRateFor(loanType);
      if (hasProp) rate -= 0.5;
      if (region && region.toLowerCase() !== 'москва') rate += 0.25;
      ctx.form.interestRate.setValue(rate);
    },
    { immediate: false }
  );

  // C.2 — monthlyPayment = annuity(loanAmount, loanTerm, interestRate)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
  );

  // C.7 — paymentToIncomeRatio
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome || totalIncome === 0) return null;
      return Math.round(((monthlyPayment ?? 0) / totalIncome) * 100);
    }
  );

  // C.8 — coBorrowersIncome — sum of array — use watchField (computeFrom on array
  // requires re-subscription on item add/remove, which watchField on the parent
  // handles via deep-subscribe).
  watchField(
    path.coBorrowers,
    (_arr, ctx) => {
      const arr = (ctx.form.coBorrowers.value.value as CoBorrower[] | undefined) ?? [];
      const sum = arr.reduce(
        (acc, b) => acc + (Number.isFinite(b?.monthlyIncome) ? Number(b.monthlyIncome) : 0),
        0
      );
      const cur = ctx.form.coBorrowersIncome.value.value as number | null;
      if (cur !== sum) ctx.form.coBorrowersIncome.setValue(sum);
    },
    { immediate: true }
  );

  // sameAsRegistration → residenceAddress (copy)
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form: CreditApplicationForm) => form.sameAsRegistration === true,
  });

  // Reset carModel when carBrand changes + async load car models
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      const b = brand as string | null;
      // reset model and clear options
      ctx.form.carModel.setValue(null);
      ctx.form.carModel.updateComponentProps({ options: [], loading: !!b });
      if (!b) {
        ctx.form.carModel.updateComponentProps({ loading: false });
        return;
      }
      try {
        // Mock async — would be /api/v1/car-models?brand=
        await new Promise((r) => setTimeout(r, 300));
        const models = mockCarModels(b);
        ctx.form.carModel.updateComponentProps({
          loading: false,
          options: models.map((m) => ({ value: m, label: m })),
        });
      } catch {
        ctx.form.carModel.updateComponentProps({ loading: false, options: [] });
      }
    },
    { debounce: 300 }
  );

  // Reset registrationAddress.city when region changes + async load cities
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      const r = region as string;
      ctx.form.registrationAddress.city.setValue('');
      ctx.form.registrationAddress.city.updateComponentProps({
        options: [],
        loading: !!r,
      });
      if (!r) {
        ctx.form.registrationAddress.city.updateComponentProps({ loading: false });
        return;
      }
      try {
        await new Promise((res) => setTimeout(res, 300));
        const cities = mockCitiesByRegion(r);
        ctx.form.registrationAddress.city.updateComponentProps({
          loading: false,
          options: cities.map((c) => ({ value: c, label: c })),
        });
      } catch {
        ctx.form.registrationAddress.city.updateComponentProps({
          loading: false,
          options: [],
        });
      }
    },
    { debounce: 300 }
  );

  // residenceAddress.region async cities (only when sameAsRegistration=false)
  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      const same = ctx.form.sameAsRegistration.value.value as boolean;
      if (same) return;
      const r = region as string;
      ctx.form.residenceAddress.city.setValue('');
      ctx.form.residenceAddress.city.updateComponentProps({
        options: [],
        loading: !!r,
      });
      if (!r) {
        ctx.form.residenceAddress.city.updateComponentProps({ loading: false });
        return;
      }
      try {
        await new Promise((res) => setTimeout(res, 300));
        const cities = mockCitiesByRegion(r);
        ctx.form.residenceAddress.city.updateComponentProps({
          loading: false,
          options: cities.map((c) => ({ value: c, label: c })),
        });
      } catch {
        ctx.form.residenceAddress.city.updateComponentProps({
          loading: false,
          options: [],
        });
      }
    },
    { debounce: 300 }
  );

  // Cleanup arrays when toggle off — clear contents
  watchField(path.hasProperty, (v, ctx) => {
    if (v === false) {
      ctx.form.properties.setValue([]);
    }
  });
  watchField(path.hasExistingLoans, (v, ctx) => {
    if (v === false) {
      ctx.form.existingLoans.setValue([]);
    }
  });
  watchField(path.hasCoBorrower, (v, ctx) => {
    if (v === false) {
      ctx.form.coBorrowers.setValue([]);
    }
  });
};

// Mock APIs
function mockCitiesByRegion(region: string): string[] {
  const map: Record<string, string[]> = {
    Москва: ['Москва', 'Зеленоград', 'Троицк'],
    'Санкт-Петербург': ['Санкт-Петербург', 'Кронштадт', 'Пушкин'],
    'Московская область': ['Балашиха', 'Химки', 'Подольск', 'Мытищи'],
    'Ленинградская область': ['Гатчина', 'Выборг', 'Тосно'],
  };
  return map[region] ?? ['—'];
}
function mockCarModels(brand: string): string[] {
  const map: Record<string, string[]> = {
    Toyota: ['Camry', 'Corolla', 'RAV4', 'Land Cruiser'],
    Lada: ['Granta', 'Vesta', 'Niva', 'Largus'],
    BMW: ['X3', 'X5', '3 Series', '5 Series'],
    Hyundai: ['Solaris', 'Creta', 'Tucson', 'Sonata'],
  };
  return map[brand] ?? ['Стандартная комплектация'];
}

// ============================================================================
// Form factory
// ============================================================================

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}
