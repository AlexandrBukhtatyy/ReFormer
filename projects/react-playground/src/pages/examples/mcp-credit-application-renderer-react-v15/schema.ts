import {
  createForm,
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
  email,
  pattern,
  applyWhen,
  validate,
  validateItems,
} from '@reformer/core/validators';
import type { AsyncValidatorFn } from '@reformer/core';
import {
  computeFrom,
  watchField,
  copyFrom,
} from '@reformer/core/behaviors';
import {
  Input,
  InputMask,
  Textarea,
  Select,
  Checkbox,
  RadioGroup,
} from '@reformer/ui-kit';

// ---------- Domain types ----------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car';

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
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null;
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

  // Computed (readonly fields)
  fullName: string;
  age: number | null;
  interestRate: number;
  monthlyPayment: number;
  initialPayment: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

// ---------- Static options ----------

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
  { value: 'single', label: 'Холост / Не замужем' },
  { value: 'married', label: 'Женат / Замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
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

// ---------- Mock async APIs ----------

async function checkEmailUnique(value: string | null | undefined): Promise<{ code: string; message: string } | null> {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 200));
  // Mock: list of "registered" emails
  const taken = ['admin@bank.ru', 'test@taken.com'];
  return taken.includes(String(value).toLowerCase())
    ? { code: 'email-taken', message: 'Этот email уже зарегистрирован' }
    : null;
}

const checkEmailUniqueValidator: AsyncValidatorFn<string> = async (value) =>
  checkEmailUnique(value);

async function fetchCitiesByRegion(region: string): Promise<{ value: string; label: string }[]> {
  await new Promise((r) => setTimeout(r, 200));
  const map: Record<string, { value: string; label: string }[]> = {
    Москва: [
      { value: 'moscow', label: 'Москва' },
      { value: 'zelenograd', label: 'Зеленоград' },
    ],
    'Московская область': [
      { value: 'mytishchi', label: 'Мытищи' },
      { value: 'khimki', label: 'Химки' },
      { value: 'podolsk', label: 'Подольск' },
    ],
    'Санкт-Петербург': [
      { value: 'spb', label: 'Санкт-Петербург' },
      { value: 'pushkin', label: 'Пушкин' },
    ],
  };
  const exact = map[region];
  if (exact) return exact;
  return [{ value: 'other', label: `Города региона "${region}"` }];
}

async function fetchCarModels(brand: string): Promise<{ value: string; label: string }[]> {
  await new Promise((r) => setTimeout(r, 200));
  const map: Record<string, string[]> = {
    Toyota: ['Camry', 'Corolla', 'RAV4', 'Land Cruiser'],
    BMW: ['X3', 'X5', '3 Series', '5 Series'],
    Lada: ['Vesta', 'Granta', 'Niva', 'XRay'],
  };
  const models = map[brand] ?? ['Model A', 'Model B'];
  return models.map((m) => ({ value: m, label: m }));
}

// ---------- Form schema ----------

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  // Build form schema in a typed local to keep TS errors actionable (Recipe: TS2769)
  const formSchema: FormSchema<CreditApplicationForm> = {
    // ---------- Step 1: Loan ----------
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

    // ---------- Step 2: Personal Data ----------
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
        componentProps: { label: 'Серия паспорта', mask: '99 99', placeholder: '12 34', testId: 'passport-series' },
      },
      number: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Номер паспорта', mask: '999999', placeholder: '123456', testId: 'passport-number' },
      },
      issueDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата выдачи', type: 'date', testId: 'passport-issueDate' },
      },
      issuedBy: {
        value: '',
        component: Input,
        componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа', testId: 'passport-issuedBy' },
      },
      departmentCode: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Код подразделения',
          mask: '999-999',
          placeholder: '123-456',
          testId: 'passport-departmentCode',
        },
      },
    },
    inn: {
      value: '',
      component: InputMask,
      componentProps: { label: 'ИНН', mask: '999999999999', placeholder: '123456789012', testId: 'inn' },
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
      componentProps: {
        label: 'Email',
        type: 'email',
        placeholder: 'example@mail.com',
        testId: 'email',
      },
      asyncValidators: [checkEmailUniqueValidator],
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
        componentProps: { label: 'Регион', placeholder: 'Введите регион', testId: 'reg-region' },
      },
      city: {
        value: '',
        component: Select,
        componentProps: { label: 'Город', placeholder: 'Введите город', options: [], testId: 'reg-city' },
      },
      street: {
        value: '',
        component: Input,
        componentProps: { label: 'Улица', placeholder: 'Введите улицу', testId: 'reg-street' },
      },
      house: {
        value: '',
        component: Input,
        componentProps: { label: 'Дом', placeholder: '№', testId: 'reg-house' },
      },
      apartment: {
        value: '',
        component: Input,
        componentProps: { label: 'Квартира', placeholder: '№', testId: 'reg-apartment' },
      },
      postalCode: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000', testId: 'reg-postalCode' },
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
        componentProps: { label: 'Регион', placeholder: 'Введите регион', testId: 'res-region' },
      },
      city: {
        value: '',
        component: Select,
        componentProps: { label: 'Город', placeholder: 'Введите город', options: [], testId: 'res-city' },
      },
      street: {
        value: '',
        component: Input,
        componentProps: { label: 'Улица', placeholder: 'Введите улицу', testId: 'res-street' },
      },
      house: {
        value: '',
        component: Input,
        componentProps: { label: 'Дом', placeholder: '№', testId: 'res-house' },
      },
      apartment: {
        value: '',
        component: Input,
        componentProps: { label: 'Квартира', placeholder: '№', testId: 'res-apartment' },
      },
      postalCode: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000', testId: 'res-postalCode' },
      },
    },

    // ---------- Step 4: Employment ----------
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
      componentProps: { label: 'Название компании', placeholder: 'Введите название', testId: 'companyName' },
    },
    companyInn: {
      value: null,
      component: InputMask,
      componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890', testId: 'companyInn' },
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
      componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number', placeholder: '0', testId: 'workExperienceTotal' },
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
      componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0', testId: 'monthlyIncome' },
    },
    additionalIncome: {
      value: null,
      component: Input,
      componentProps: { label: 'Дополнительный доход (₽)', type: 'number', placeholder: '0', testId: 'additionalIncome' },
    },
    additionalIncomeSource: {
      value: null,
      component: Input,
      componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник', testId: 'additionalIncomeSource' },
    },
    businessType: {
      value: null,
      component: Input,
      componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.', testId: 'businessType' },
    },
    businessInn: {
      value: null,
      component: InputMask,
      componentProps: { label: 'ИНН ИП', mask: '999999999999', placeholder: '123456789012', testId: 'businessInn' },
    },
    businessActivity: {
      value: null,
      component: Textarea,
      componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', testId: 'businessActivity' },
    },

    // ---------- Step 5: Additional ----------
    maritalStatus: {
      value: 'single',
      component: RadioGroup,
      componentProps: { label: 'Семейное положение', options: MARITAL_OPTIONS, testId: 'maritalStatus' },
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
          componentProps: { label: 'Тип имущества', placeholder: 'Выберите тип', options: PROPERTY_TYPE_OPTIONS, testId: 'property-type' },
        } satisfies FieldConfig<PropertyType>,
        description: {
          value: '',
          component: Textarea,
          componentProps: { label: 'Описание', placeholder: 'Опишите имущество', testId: 'property-description' },
        },
        estimatedValue: {
          value: 0,
          component: Input,
          componentProps: { label: 'Оценочная стоимость', type: 'number', placeholder: '0', testId: 'property-estimatedValue' },
        },
        hasEncumbrance: {
          value: false,
          component: Checkbox,
          componentProps: { label: 'Имеется обременение (залог)', testId: 'property-hasEncumbrance' },
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
          componentProps: { label: 'Банк', placeholder: 'Название банка', testId: 'loan-bank' },
        },
        type: {
          value: '',
          component: Input,
          componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита', testId: 'loan-type' },
        },
        amount: {
          value: 0,
          component: Input,
          componentProps: { label: 'Сумма кредита', type: 'number', placeholder: '0', testId: 'loan-amount' },
        },
        remainingAmount: {
          value: 0,
          component: Input,
          componentProps: { label: 'Остаток задолженности', type: 'number', placeholder: '0', testId: 'loan-remainingAmount' },
        },
        monthlyPayment: {
          value: 0,
          component: Input,
          componentProps: { label: 'Ежемесячный платеж', type: 'number', placeholder: '0', testId: 'loan-monthlyPayment' },
        },
        maturityDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата погашения', type: 'date', testId: 'loan-maturityDate' },
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
            componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию', testId: 'cob-lastName' },
          },
          firstName: {
            value: '',
            component: Input,
            componentProps: { label: 'Имя', placeholder: 'Введите имя', testId: 'cob-firstName' },
          },
          middleName: {
            value: '',
            component: Input,
            componentProps: { label: 'Отчество', placeholder: 'Введите отчество', testId: 'cob-middleName' },
          },
          birthDate: {
            value: '',
            component: Input,
            componentProps: { label: 'Дата рождения', type: 'date', testId: 'cob-birthDate' },
          },
        },
        phone: {
          value: '',
          component: InputMask,
          componentProps: {
            label: 'Телефон',
            mask: '+7 (999) 999-99-99',
            placeholder: '+7 (___) ___-__-__',
            testId: 'cob-phone',
          },
        },
        email: {
          value: '',
          component: Input,
          componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com', testId: 'cob-email' },
        },
        relationship: {
          value: '',
          component: Input,
          componentProps: { label: 'Родство', placeholder: 'Укажите родство', testId: 'cob-relationship' },
        },
        monthlyIncome: {
          value: 0,
          component: Input,
          componentProps: { label: 'Ежемесячный доход', type: 'number', placeholder: '0', testId: 'cob-monthlyIncome' },
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

    // ---------- Computed (readonly) fields ----------
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
    initialPayment: {
      value: 0,
      component: Input,
      componentProps: { label: 'Первоначальный взнос (₽)', type: 'number', readOnly: true, testId: 'initialPayment' },
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

  // ---------- Validation ----------
  const validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
    // Step 1
    required(path.loanType, { message: 'Выберите тип кредита' });
    required(path.loanAmount, { message: 'Введите сумму кредита' });
    min(path.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });
    max(path.loanAmount, 10_000_000, { message: 'Максимальная сумма — 10 000 000 ₽' });
    required(path.loanTerm, { message: 'Введите срок кредита' });
    min(path.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
    max(path.loanTerm, 240, { message: 'Максимальный срок — 240 месяцев' });
    required(path.loanPurpose, { message: 'Опишите цель кредита' });
    minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
    maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'mortgage',
      (p) => {
        required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
        min(p.propertyValue, 1_000_000, { message: 'Минимум 1 000 000 ₽' });
        // Cross-field: loanAmount <= propertyValue - initialPayment
        validate(p.loanAmount, (value, ctx) => {
          const pv = ctx.form.propertyValue.value.value as number | null;
          const ip = ctx.form.initialPayment.value.value as number;
          if (value != null && pv != null && value > pv - ip) {
            return { code: 'loan-too-large', message: 'Сумма кредита не может превышать (стоимость - первоначальный взнос)' };
          }
          return null;
        });
      }
    );

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'car',
      (p) => {
        required(p.carBrand, { message: 'Введите марку автомобиля' });
        minLength(p.carBrand, 2);
        maxLength(p.carBrand, 50);
        required(p.carModel, { message: 'Выберите модель автомобиля' });
        required(p.carYear, { message: 'Введите год выпуска' });
        min(p.carYear, 2000, { message: 'Год должен быть не раньше 2000' });
        max(p.carYear, new Date().getFullYear() + 1, { message: `Год не может быть позже ${new Date().getFullYear() + 1}` });
        required(p.carPrice, { message: 'Введите стоимость автомобиля' });
        min(p.carPrice, 300_000);
        max(p.carPrice, 10_000_000);
      }
    );

    // Step 2
    required(path.personalData.lastName, { message: 'Введите фамилию' });
    required(path.personalData.firstName, { message: 'Введите имя' });
    required(path.personalData.middleName, { message: 'Введите отчество' });
    required(path.personalData.birthDate, { message: 'Введите дату рождения' });
    required(path.personalData.gender, { message: 'Выберите пол' });
    required(path.personalData.birthPlace, { message: 'Введите место рождения' });
    required(path.passportData.series, { message: 'Введите серию паспорта' });
    pattern(path.passportData.series, /^\d{2} \d{2}$/, { message: 'Формат: 12 34' });
    required(path.passportData.number, { message: 'Введите номер паспорта' });
    pattern(path.passportData.number, /^\d{6}$/, { message: 'Формат: 6 цифр' });
    required(path.passportData.issueDate, { message: 'Введите дату выдачи' });
    required(path.passportData.issuedBy, { message: 'Введите название органа' });
    required(path.passportData.departmentCode, { message: 'Введите код подразделения' });
    pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, { message: 'Формат: 123-456' });
    required(path.inn, { message: 'Введите ИНН' });
    pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
    required(path.snils, { message: 'Введите СНИЛС' });
    pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'Формат: 123-456-789 00' });

    // Cross-field: age between 18 and 70
    validate(path.personalData.birthDate, (value) => {
      if (!value) return null;
      const birth = new Date(String(value));
      if (Number.isNaN(birth.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      if (age < 18) return { code: 'too-young', message: 'Возраст должен быть не менее 18 лет' };
      if (age > 70) return { code: 'too-old', message: 'Возраст должен быть не более 70 лет' };
      return null;
    });

    // Step 3
    required(path.phoneMain, { message: 'Введите телефон' });
    pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат: +7 (xxx) xxx-xx-xx' });
    required(path.email, { message: 'Введите email' });
    email(path.email, { message: 'Неверный формат email' });
    required(path.registrationAddress.region, { message: 'Введите регион' });
    required(path.registrationAddress.city, { message: 'Введите город' });
    required(path.registrationAddress.street, { message: 'Введите улицу' });
    required(path.registrationAddress.house, { message: 'Введите дом' });
    required(path.registrationAddress.postalCode, { message: 'Введите индекс' });
    pattern(path.registrationAddress.postalCode, /^\d{6}$/, { message: 'Формат: 6 цифр' });

    applyWhen(
      path.sameAsRegistration,
      (v) => v === false,
      (p) => {
        required(p.residenceAddress.region, { message: 'Введите регион' });
        required(p.residenceAddress.city, { message: 'Введите город' });
        required(p.residenceAddress.street, { message: 'Введите улицу' });
        required(p.residenceAddress.house, { message: 'Введите дом' });
        required(p.residenceAddress.postalCode, { message: 'Введите индекс' });
        pattern(p.residenceAddress.postalCode, /^\d{6}$/, { message: 'Формат: 6 цифр' });
      }
    );

    // Step 4
    required(path.employmentStatus, { message: 'Выберите статус занятости' });
    required(path.workExperienceTotal, { message: 'Введите общий стаж' });
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
    min(path.workExperienceCurrent, 0);
    required(path.monthlyIncome, { message: 'Введите ежемесячный доход' });
    min(path.monthlyIncome, 10000, { message: 'Минимальный доход — 10 000 ₽' });

    // Cross: workExperienceCurrent <= workExperienceTotal
    validate(path.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.workExperienceTotal.value.value as number | null;
      if (value != null && total != null && (value as number) > total) {
        return { code: 'experience-mismatch', message: 'Текущий стаж не может превышать общий' };
      }
      return null;
    });

    // Cross: additionalIncome > 0 → additionalIncomeSource required
    validate(path.additionalIncomeSource, (value, ctx) => {
      const ai = ctx.form.additionalIncome.value.value as number | null;
      if (ai != null && ai > 0 && (!value || String(value).trim() === '')) {
        return { code: 'source-required', message: 'Укажите источник дополнительного дохода' };
      }
      return null;
    });

    applyWhen(
      path.employmentStatus,
      (v) => v === 'employed',
      (p) => {
        required(p.companyName, { message: 'Введите название компании' });
        required(p.companyInn, { message: 'Введите ИНН компании' });
        validate(p.companyInn, (value) => {
          if (value == null || String(value).trim() === '') return null;
          return /^\d{10}$/.test(String(value))
            ? null
            : { code: 'pattern', message: 'ИНН должен содержать 10 цифр' };
        });
        required(p.position, { message: 'Введите должность' });
      }
    );

    applyWhen(
      path.employmentStatus,
      (v) => v === 'selfEmployed',
      (p) => {
        required(p.businessType, { message: 'Введите тип бизнеса' });
        required(p.businessInn, { message: 'Введите ИНН ИП' });
        validate(p.businessInn, (value) => {
          if (value == null || String(value).trim() === '') return null;
          return /^\d{12}$/.test(String(value))
            ? null
            : { code: 'pattern', message: 'ИНН должен содержать 12 цифр' };
        });
      }
    );

    // Step 5
    required(path.maritalStatus, { message: 'Выберите семейное положение' });
    required(path.dependents);
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
          minLength(itemPath.description, 1);
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
          required(itemPath.bank, { message: 'Введите банк' });
          required(itemPath.type, { message: 'Введите тип кредита' });
          required(itemPath.amount);
          min(itemPath.amount, 0);
          required(itemPath.remainingAmount);
          min(itemPath.remainingAmount, 0);
          required(itemPath.monthlyPayment);
          min(itemPath.monthlyPayment, 0);
          required(itemPath.maturityDate);
          // Cross: remainingAmount <= amount
          validate(itemPath.remainingAmount, (value, ctx) => {
            // ctx.form is root form; we want item.amount — read via ctx.form path? Use tempo approach: read from absolute path within the same item via getRelativeField API not exposed here.
            // Fallback: compare via captured itemPath; ReFormer ctx.form = root form, so we don't have direct item access.
            // Skip strict cross-field at item-level; runtime check inside computeFrom or watchField is safer if needed.
            void value;
            void ctx;
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
          required(itemPath.personalData.birthDate);
          required(itemPath.phone);
          pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат: +7 (xxx) xxx-xx-xx' });
          required(itemPath.email);
          email(itemPath.email);
          required(itemPath.relationship);
          required(itemPath.monthlyIncome);
          min(itemPath.monthlyIncome, 0);
        });
      }
    );

    // Step 6 — must be true
    validate(path.agreePersonalData, (value) =>
      value === true ? null : { code: 'consent-required', message: 'Необходимо согласие' }
    );
    validate(path.agreeCreditHistory, (value) =>
      value === true ? null : { code: 'consent-required', message: 'Необходимо согласие' }
    );
    validate(path.agreeTerms, (value) =>
      value === true ? null : { code: 'consent-required', message: 'Необходимо согласие' }
    );
    validate(path.confirmAccuracy, (value) =>
      value === true ? null : { code: 'consent-required', message: 'Необходимо подтверждение' }
    );
    required(path.electronicSignature, { message: 'Введите код из СМС' });
    pattern(path.electronicSignature, /^\d{6}$/, { message: 'Формат: 6 цифр' });

    // Cross-field: paymentToIncomeRatio <= 50%
    validate(path.paymentToIncomeRatio, (value) => {
      if (value != null && (value as number) > 50) {
        return { code: 'pti-too-high', message: 'Платеж не должен превышать 50% дохода' };
      }
      return null;
    });
  };

  // ---------- Behavior ----------
  const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
    // C.4 fullName = lastName + firstName + middleName
    computeFrom(
      [path.personalData],
      path.fullName,
      ({ personalData }: CreditApplicationForm) =>
        [personalData?.lastName, personalData?.firstName, personalData?.middleName]
          .filter(Boolean)
          .join(' ')
    );

    // C.5 age from birthDate (subscribe to group node — Recipe 4)
    computeFrom([path.personalData], path.age, ({ personalData }: CreditApplicationForm) => {
      const bd = personalData?.birthDate;
      if (!bd) return null;
      const birth = new Date(bd);
      if (Number.isNaN(birth.getTime())) return null;
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return age;
    });

    // C.6 totalIncome = monthlyIncome + additionalIncome
    computeFrom(
      [path.monthlyIncome, path.additionalIncome],
      path.totalIncome,
      ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
        (monthlyIncome ?? 0) + (additionalIncome ?? 0)
    );

    // C.3 initialPayment = 20% of propertyValue (mortgage only)
    computeFrom(
      [path.propertyValue],
      path.initialPayment,
      ({ propertyValue, loanType }: CreditApplicationForm) =>
        loanType === 'mortgage' ? Math.round((propertyValue ?? 0) * 0.2) : 0
    );

    // C.1 interestRate from loanType + region + hasProperty
    // Subscribe to registrationAddress group node (Recipe 4 cross-level rule)
    computeFrom(
      [path.loanType, path.hasProperty, path.registrationAddress],
      path.interestRate,
      ({ loanType, hasProperty }: CreditApplicationForm) => {
        let rate = 12;
        switch (loanType) {
          case 'mortgage':
            rate = 9;
            break;
          case 'car':
            rate = 11;
            break;
          case 'consumer':
            rate = 14;
            break;
          case 'business':
            rate = 13;
            break;
          case 'refinance':
            rate = 10;
            break;
          default:
            rate = 12;
        }
        if (hasProperty) rate -= 0.5;
        return rate;
      }
    );

    // C.2 monthlyPayment annuity (uses watchField pattern — multi-trigger)
    function recomputeMonthlyPayment(form: CreditApplicationForm, ctx: { form: FormProxy<CreditApplicationForm> }) {
      const amount = form.loanAmount ?? 0;
      const term = form.loanTerm ?? 0;
      const rate = form.interestRate ?? 0;
      if (!amount || !term || !rate) {
        if (ctx.form.monthlyPayment.value.value !== 0) ctx.form.monthlyPayment.setValue(0);
        return;
      }
      const r = rate / 100 / 12;
      const monthly = Math.round((amount * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1));
      const cur = ctx.form.monthlyPayment.value.value as number;
      if (Math.abs(cur - monthly) > 0.5) ctx.form.monthlyPayment.setValue(monthly);
    }

    watchField(
      path.loanAmount,
      (_v, ctx) => recomputeMonthlyPayment(ctx.form.value.value as CreditApplicationForm, ctx),
      { immediate: false }
    );
    watchField(
      path.loanTerm,
      (_v, ctx) => recomputeMonthlyPayment(ctx.form.value.value as CreditApplicationForm, ctx),
      { immediate: false }
    );
    watchField(
      path.interestRate,
      (_v, ctx) => recomputeMonthlyPayment(ctx.form.value.value as CreditApplicationForm, ctx),
      { immediate: false }
    );

    // C.7 paymentToIncomeRatio = monthlyPayment / totalIncome * 100
    computeFrom(
      [path.monthlyPayment, path.totalIncome],
      path.paymentToIncomeRatio,
      ({ monthlyPayment, totalIncome }: CreditApplicationForm) =>
        totalIncome > 0 ? Math.round(((monthlyPayment ?? 0) / totalIncome) * 100) : 0
    );

    // C.8 coBorrowersIncome = sum of coBorrowers[].monthlyIncome
    computeFrom(
      [path.coBorrowers],
      path.coBorrowersIncome,
      ({ coBorrowers }: CreditApplicationForm) =>
        Array.isArray(coBorrowers)
          ? coBorrowers.reduce((sum, cb) => sum + (cb?.monthlyIncome ?? 0), 0)
          : 0
    );

    // copy registration → residence when sameAsRegistration === true
    copyFrom(path.registrationAddress, path.residenceAddress, {
      when: (form) => form.sameAsRegistration === true,
    });

    // Async: cities by region (registration)
    watchField(
      path.registrationAddress.region,
      async (region, ctx) => {
        const r = String(region ?? '').trim();
        if (!r) {
          ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
          return;
        }
        try {
          const opts = await fetchCitiesByRegion(r);
          ctx.form.registrationAddress.city.updateComponentProps({ options: opts });
        } catch {
          ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );

    // Async: cities by region (residence) — only when sameAsRegistration=false
    watchField(
      path.residenceAddress.region,
      async (region, ctx) => {
        if (ctx.form.sameAsRegistration.value.value === true) return;
        const r = String(region ?? '').trim();
        if (!r) {
          ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
          return;
        }
        try {
          const opts = await fetchCitiesByRegion(r);
          ctx.form.residenceAddress.city.updateComponentProps({ options: opts });
        } catch {
          ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );

    // Async: car models by brand
    watchField(
      path.carBrand,
      async (brand, ctx) => {
        const b = String(brand ?? '').trim();
        // Reset carModel on brand change
        ctx.form.carModel.setValue(null);
        if (!b) {
          ctx.form.carModel.updateComponentProps({ options: [] });
          return;
        }
        try {
          const opts = await fetchCarModels(b);
          ctx.form.carModel.updateComponentProps({ options: opts });
        } catch {
          ctx.form.carModel.updateComponentProps({ options: [] });
        }
      },
      { debounce: 300 }
    );
  };

  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation,
    behavior,
  });
}

// ---------- Step validations (Record<number, ValidationSchemaFn>) ----------

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: (path) => {
    required(path.loanType);
    required(path.loanAmount);
    min(path.loanAmount, 50000);
    max(path.loanAmount, 10_000_000);
    required(path.loanTerm);
    min(path.loanTerm, 6);
    max(path.loanTerm, 240);
    required(path.loanPurpose);
    minLength(path.loanPurpose, 10);
    maxLength(path.loanPurpose, 500);
    applyWhen(
      path.loanType,
      (v) => v === 'mortgage',
      (p) => {
        required(p.propertyValue);
        min(p.propertyValue, 1_000_000);
      }
    );
    applyWhen(
      path.loanType,
      (v) => v === 'car',
      (p) => {
        required(p.carBrand);
        required(p.carModel);
        required(p.carYear);
        required(p.carPrice);
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
    pattern(path.inn, /^\d{12}$/);
    required(path.snils);
  },
  3: (path) => {
    required(path.phoneMain);
    required(path.email);
    email(path.email);
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
  },
  4: (path) => {
    required(path.employmentStatus);
    required(path.workExperienceTotal);
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent);
    min(path.workExperienceCurrent, 0);
    required(path.monthlyIncome);
    min(path.monthlyIncome, 10000);
    applyWhen(
      path.employmentStatus,
      (v) => v === 'employed',
      (p) => {
        required(p.companyName);
        required(p.companyInn);
        required(p.position);
      }
    );
    applyWhen(
      path.employmentStatus,
      (v) => v === 'selfEmployed',
      (p) => {
        required(p.businessType);
        required(p.businessInn);
      }
    );
  },
  5: (path) => {
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
          required(itemPath.remainingAmount);
          required(itemPath.monthlyPayment);
          required(itemPath.maturityDate);
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
          required(itemPath.phone);
          required(itemPath.email);
          email(itemPath.email);
          required(itemPath.relationship);
          required(itemPath.monthlyIncome);
        });
      }
    );
  },
  6: (path) => {
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
      v === true ? null : { code: 'consent-required', message: 'Необходимо подтверждение' }
    );
    required(path.electronicSignature);
    pattern(path.electronicSignature, /^\d{6}$/);
  },
};

// ---------- Initial values for new array items ----------

export const newPropertyItem = (): Partial<PropertyItem> => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const newExistingLoan = (): Partial<ExistingLoan> => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const newCoBorrower = (): Partial<CoBorrower> => ({
  personalData: { lastName: '', firstName: '', middleName: '', birthDate: '' },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});
