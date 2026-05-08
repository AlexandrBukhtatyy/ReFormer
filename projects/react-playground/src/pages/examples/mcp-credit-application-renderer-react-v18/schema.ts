// Credit-application schema (iter-18 / renderer-react).
// Stack: createForm with FormSchema literal extracted as typed local (avoid TS2769),
// validation (ValidationSchemaFn), behavior (BehaviorSchemaFn).

import {
  createForm,
  type BehaviorSchemaFn,
  type FieldConfig,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
} from '@reformer/core';
import {
  apply,
  applyWhen,
  email as emailValidator,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
  validate,
  validateItems,
} from '@reformer/core/validators';
import { computeFrom, copyFrom, watchField } from '@reformer/core/behaviors';
import {
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Select,
  Textarea,
} from '@reformer/ui-kit';

import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  REGION_OPTIONS,
  type CoBorrower,
  type CreditApplicationForm,
  type Education,
  type EmploymentStatus,
  type Gender,
  type LoanType,
  type MaritalStatus,
  type PropertyItem,
  type PropertyType,
} from './types';

// ---------------------------------------------------------------------------
// Mock async helpers
// ---------------------------------------------------------------------------

type SelectOption = { value: string; label: string };

const CITIES_BY_REGION: Record<string, SelectOption[]> = {
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
  tatarstan: [
    { value: 'kazan', label: 'Казань' },
    { value: 'naberezhnye-chelny', label: 'Набережные Челны' },
  ],
};

const CAR_MODELS_BY_BRAND: Record<string, SelectOption[]> = {
  Toyota: [
    { value: 'Camry', label: 'Camry' },
    { value: 'Corolla', label: 'Corolla' },
    { value: 'RAV4', label: 'RAV4' },
  ],
  BMW: [
    { value: '3 Series', label: '3 Series' },
    { value: '5 Series', label: '5 Series' },
    { value: 'X5', label: 'X5' },
  ],
  Lada: [
    { value: 'Vesta', label: 'Vesta' },
    { value: 'Granta', label: 'Granta' },
    { value: 'Niva', label: 'Niva' },
  ],
};

async function fetchCitiesByRegion(region: string): Promise<SelectOption[]> {
  await new Promise((r) => setTimeout(r, 200));
  return CITIES_BY_REGION[region] ?? [];
}

async function fetchCarModelsByBrand(brand: string): Promise<SelectOption[]> {
  await new Promise((r) => setTimeout(r, 200));
  return CAR_MODELS_BY_BRAND[brand] ?? [];
}

async function checkEmailUnique(value: string) {
  if (!value) return null;
  await new Promise((r) => setTimeout(r, 250));
  if (value.toLowerCase() === 'taken@example.com') {
    return { code: 'email-taken', message: 'Email уже зарегистрирован' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

function baseInterestRate(loanType: LoanType): number {
  switch (loanType) {
    case 'mortgage':
      return 9;
    case 'car':
      return 12;
    case 'business':
      return 13;
    case 'refinance':
      return 11;
    case 'consumer':
    default:
      return 15;
  }
}

function annuityMonthly(amount: number, term: number, ratePct: number): number {
  if (!amount || !term || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = term;
  return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

function ageFromBirthDate(iso: string): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Schema literal — extracted as typed local (avoid TS2769)
// ---------------------------------------------------------------------------

const formSchema: FormSchema<CreditApplicationForm> = {
  // -------------------------- Step 1 --------------------------
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
      placeholder: 'Авто-расчёт 20%',
      readOnly: true,
      disabled: true,
      testId: 'initialPayment',
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
    component: Select,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Сначала выберите марку',
      options: [] as SelectOption[],
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
  interestRate: {
    value: 15,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readOnly: true,
      disabled: true,
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
      disabled: true,
      testId: 'monthlyPayment',
    },
  },

  // -------------------------- Step 2 --------------------------
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию', testId: 'personalData-lastName' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'Имя', placeholder: 'Введите имя', testId: 'personalData-firstName' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Отчество', placeholder: 'Введите отчество', testId: 'personalData-middleName' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'text', placeholder: 'YYYY-MM-DD', testId: 'personalData-birthDate' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: { label: 'Пол', options: GENDER_OPTIONS, testId: 'personalData-gender' },
    } satisfies FieldConfig<Gender>,
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения', testId: 'personalData-birthPlace' },
    },
  },
  passportData: {
    series: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Серия паспорта', mask: '99 99', placeholder: '12 34', testId: 'passportData-series' },
    },
    number: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Номер паспорта', mask: '999999', placeholder: '123456', testId: 'passportData-number' },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата выдачи', placeholder: 'YYYY-MM-DD', testId: 'passportData-issueDate' },
    },
    issuedBy: {
      value: '',
      component: Input,
      componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа', testId: 'passportData-issuedBy' },
    },
    departmentCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Код подразделения', mask: '999-999', placeholder: '123-456', testId: 'passportData-departmentCode' },
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
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, disabled: true, testId: 'fullName' },
  },
  age: {
    value: 0,
    component: Input,
    componentProps: { label: 'Возраст (лет)', type: 'number', readOnly: true, disabled: true, testId: 'age' },
  },

  // -------------------------- Step 3 --------------------------
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Основной телефон', mask: '+7 (999) 999-99-99', testId: 'phoneMain' },
  },
  phoneAdditional: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Дополнительный телефон', mask: '+7 (999) 999-99-99', testId: 'phoneAdditional' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com', testId: 'email' },
    asyncValidators: [checkEmailUnique],
    debounce: 500,
  },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email', placeholder: 'example@mail.com', testId: 'emailAdditional' },
  },
  sameEmail: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Дополнительный email совпадает с основным', testId: 'sameEmail' },
  },
  registrationAddress: {
    region: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Регион',
        placeholder: 'Выберите регион',
        options: REGION_OPTIONS,
        testId: 'registrationAddress-region',
      },
    },
    city: {
      value: '',
      component: Select,
      componentProps: {
        label: 'Город',
        placeholder: 'Сначала выберите регион',
        options: [] as SelectOption[],
        testId: 'registrationAddress-city',
      },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', placeholder: 'Введите улицу', testId: 'registrationAddress-street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', placeholder: '№', testId: 'registrationAddress-house' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', placeholder: '№', testId: 'registrationAddress-apartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000', testId: 'registrationAddress-postalCode' },
    },
  },
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации', testId: 'sameAsRegistration' },
  },
  residenceAddress: {
    region: {
      value: '',
      component: Select,
      componentProps: { label: 'Регион', options: REGION_OPTIONS, testId: 'residenceAddress-region' },
    },
    city: {
      value: '',
      component: Select,
      componentProps: { label: 'Город', options: [] as SelectOption[], testId: 'residenceAddress-city' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', testId: 'residenceAddress-street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', testId: 'residenceAddress-house' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', testId: 'residenceAddress-apartment' },
    },
    postalCode: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Индекс', mask: '999999', testId: 'residenceAddress-postalCode' },
    },
  },

  // -------------------------- Step 4 --------------------------
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
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название', testId: 'companyName' },
  },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890', testId: 'companyInn' },
  },
  companyPhone: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Телефон компании', mask: '+7 (999) 999-99-99', testId: 'companyPhone' },
  },
  companyAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес', testId: 'companyAddress' },
  },
  position: {
    value: '',
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
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number', placeholder: '0', testId: 'workExperienceCurrent' },
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
    value: '',
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник', testId: 'additionalIncomeSource' },
  },
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.', testId: 'businessType' },
  },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН ИП', mask: '999999999999', placeholder: '123456789012', testId: 'businessInn' },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3, testId: 'businessActivity' },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true, disabled: true, testId: 'totalIncome' },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Платёж от дохода (%)', type: 'number', readOnly: true, disabled: true, testId: 'paymentToIncomeRatio' },
  },

  // -------------------------- Step 5 --------------------------
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUS_OPTIONS, testId: 'maritalStatus' },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', placeholder: '0', testId: 'dependents' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: { label: 'Образование', placeholder: 'Выберите уровень', options: EDUCATION_OPTIONS, testId: 'education' },
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
        componentProps: { label: 'Тип имущества', options: PROPERTY_TYPE_OPTIONS, placeholder: 'Выберите тип', testId: 'type' },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2, testId: 'description' },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Оценочная стоимость', type: 'number', placeholder: '0', testId: 'estimatedValue' },
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
        componentProps: { label: 'Остаток задолженности', type: 'number', placeholder: '0', testId: 'remainingAmount' },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платёж', type: 'number', placeholder: '0', testId: 'monthlyPayment' },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Дата погашения', placeholder: 'YYYY-MM-DD', testId: 'maturityDate' },
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
          componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя', testId: 'personalData-firstName' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
        },
        birthDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата рождения', placeholder: 'YYYY-MM-DD', testId: 'personalData-birthDate' },
        },
        gender: {
          value: 'male',
          component: RadioGroup,
          componentProps: { label: 'Пол', options: GENDER_OPTIONS, testId: 'personalData-gender' },
        } satisfies FieldConfig<Gender>,
        birthPlace: {
          value: '',
          component: Input,
          componentProps: { label: 'Место рождения', testId: 'personalData-birthPlace' },
        },
      },
      phone: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99', testId: 'phone' },
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
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаёмщиков (₽)', type: 'number', readOnly: true, disabled: true, testId: 'coBorrowersIncome' },
  },

  // -------------------------- Step 6 --------------------------
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
    componentProps: { label: 'Подтверждаю точность введённых данных', testId: 'confirmAccuracy' },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подтверждения из СМС', mask: '999999', placeholder: '123456', testId: 'electronicSignature' },
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: (path) => {
    required(path.loanType, { message: 'Выберите тип кредита' });
    required(path.loanAmount, { message: 'Введите сумму' });
    min(path.loanAmount, 50000, { message: 'Минимум 50 000 ₽' });
    max(path.loanAmount, 10000000, { message: 'Максимум 10 000 000 ₽' });
    required(path.loanTerm, { message: 'Введите срок' });
    min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
    max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
    required(path.loanPurpose, { message: 'Опишите цель кредита' });
    minLength(path.loanPurpose, 10, { message: 'Не менее 10 символов' });
    maxLength(path.loanPurpose, 500, { message: 'Не более 500 символов' });

    applyWhen(
      path.loanType,
      (loanType) => loanType === 'mortgage',
      (p) => {
        required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
        min(p.propertyValue, 1000000, { message: 'Минимум 1 000 000 ₽' });
        validate(p.loanAmount, (value, ctx) => {
          const propValue = ctx.form.propertyValue.value.value as number | null;
          const init = ctx.form.initialPayment.value.value as number | null;
          if (
            value != null &&
            propValue != null &&
            init != null &&
            value > propValue - init
          ) {
            return {
              code: 'loan-amount-exceeds',
              message: 'Сумма кредита не может превышать стоимость минус первоначальный взнос',
            };
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
        minLength(p.carBrand, 2, { message: 'Минимум 2 символа' });
        maxLength(p.carBrand, 50);
        required(p.carModel, { message: 'Выберите модель' });
        required(p.carYear, { message: 'Введите год' });
        min(p.carYear, 2000, { message: 'Не ранее 2000 года' });
        max(p.carYear, new Date().getFullYear() + 1);
        required(p.carPrice, { message: 'Введите стоимость' });
        min(p.carPrice, 300000);
        max(p.carPrice, 10000000);
      }
    );
  },
  2: (path) => {
    apply(path.personalData, (p) => {
      required(p.lastName, { message: 'Введите фамилию' });
      required(p.firstName, { message: 'Введите имя' });
      required(p.middleName, { message: 'Введите отчество' });
      required(p.birthDate, { message: 'Введите дату рождения' });
      required(p.gender);
      required(p.birthPlace, { message: 'Введите место рождения' });
    });
    apply(path.passportData, (p) => {
      required(p.series, { message: 'Введите серию' });
      pattern(p.series, /^\d{2} \d{2}$/, { message: 'Серия в формате 12 34' });
      required(p.number, { message: 'Введите номер' });
      pattern(p.number, /^\d{6}$/, { message: 'Номер из 6 цифр' });
      required(p.issueDate, { message: 'Введите дату выдачи' });
      required(p.issuedBy, { message: 'Введите название органа' });
      required(p.departmentCode, { message: 'Введите код' });
      pattern(p.departmentCode, /^\d{3}-\d{3}$/, { message: 'Формат 123-456' });
    });
    required(path.inn, { message: 'Введите ИНН' });
    pattern(path.inn, /^\d{12}$/, { message: 'ИНН из 12 цифр' });
    required(path.snils, { message: 'Введите СНИЛС' });
    pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'Формат 123-456-789 00' });

    validate(path.age, (value) => {
      if (value != null && (value < 18 || value > 70)) {
        return { code: 'age-range', message: 'Возраст должен быть от 18 до 70 лет' };
      }
      return null;
    });
  },
  3: (path) => {
    required(path.phoneMain, { message: 'Введите основной телефон' });
    pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Неверный формат телефона' });
    required(path.email, { message: 'Введите email' });
    emailValidator(path.email, { message: 'Неверный формат email' });

    apply(path.registrationAddress, (p) => {
      required(p.region, { message: 'Выберите регион' });
      required(p.city, { message: 'Выберите город' });
      required(p.street, { message: 'Введите улицу' });
      required(p.house, { message: 'Введите дом' });
      required(p.postalCode, { message: 'Введите индекс' });
      pattern(p.postalCode, /^\d{6}$/, { message: 'Индекс из 6 цифр' });
    });

    applyWhen(
      path.sameAsRegistration,
      (same) => same === false,
      (p) => {
        apply(p.residenceAddress, (a) => {
          required(a.region);
          required(a.city);
          required(a.street);
          required(a.house);
          required(a.postalCode);
          pattern(a.postalCode, /^\d{6}$/);
        });
      }
    );
  },
  4: (path) => {
    required(path.employmentStatus);
    required(path.workExperienceTotal, { message: 'Введите стаж' });
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent, { message: 'Введите стаж' });
    min(path.workExperienceCurrent, 0);
    required(path.monthlyIncome, { message: 'Введите доход' });
    min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });

    validate(path.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.workExperienceTotal.value.value as number | null;
      if (value != null && total != null && value > total) {
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
        required(p.companyName, { message: 'Введите название компании' });
        required(p.companyInn, { message: 'Введите ИНН компании' });
        pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН из 10 цифр' });
        required(p.position, { message: 'Введите должность' });
      }
    );

    applyWhen(
      path.employmentStatus,
      (s) => s === 'selfEmployed',
      (p) => {
        required(p.businessType, { message: 'Введите тип бизнеса' });
        required(p.businessInn, { message: 'Введите ИНН ИП' });
        pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН из 12 цифр' });
      }
    );

    validate(path.additionalIncomeSource, (value, ctx) => {
      const inc = ctx.form.additionalIncome.value.value as number | null;
      if (inc != null && inc > 0 && (!value || value.length === 0)) {
        return { code: 'source-required', message: 'Укажите источник дополнительного дохода' };
      }
      return null;
    });

    validate(path.paymentToIncomeRatio, (value) => {
      if (value != null && value > 50) {
        return { code: 'pti-too-high', message: 'Платёж не должен превышать 50% дохода' };
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

    validateItems(path.properties, (itemPath) => {
      required(itemPath.type);
      required(itemPath.description, { message: 'Опишите имущество' });
      min(itemPath.estimatedValue, 0);
    });

    validateItems(path.existingLoans, (itemPath) => {
      required(itemPath.bank, { message: 'Введите банк' });
      required(itemPath.type, { message: 'Введите тип кредита' });
      min(itemPath.amount, 0);
      min(itemPath.remainingAmount, 0);
      min(itemPath.monthlyPayment, 0);
      required(itemPath.maturityDate, { message: 'Введите дату погашения' });
      validate(itemPath.remainingAmount, (value) => {
        const v = value as number | null;
        if (v != null && v < 0) {
          return { code: 'remaining-negative', message: 'Остаток не может быть отрицательным' };
        }
        return null;
      });
    });

    validateItems(path.coBorrowers, (itemPath) => {
      apply(itemPath.personalData, (p) => {
        required(p.lastName);
        required(p.firstName);
        required(p.middleName);
        required(p.birthDate);
        required(p.gender);
        required(p.birthPlace);
      });
      required(itemPath.phone, { message: 'Введите телефон' });
      pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/);
      required(itemPath.email, { message: 'Введите email' });
      emailValidator(itemPath.email);
      required(itemPath.relationship, { message: 'Укажите родство' });
      min(itemPath.monthlyIncome, 0);
    });
  },
  6: (path) => {
    validate(path.agreePersonalData, (value) =>
      value === true ? null : { code: 'agree-required', message: 'Согласие обязательно' }
    );
    validate(path.agreeCreditHistory, (value) =>
      value === true ? null : { code: 'agree-required', message: 'Согласие обязательно' }
    );
    validate(path.agreeTerms, (value) =>
      value === true ? null : { code: 'agree-required', message: 'Согласие обязательно' }
    );
    validate(path.confirmAccuracy, (value) =>
      value === true ? null : { code: 'agree-required', message: 'Подтверждение обязательно' }
    );
    required(path.electronicSignature, { message: 'Введите код' });
    pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код из 6 цифр' });
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

// ---------------------------------------------------------------------------
// Behavior
// ---------------------------------------------------------------------------

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.1 interestRate — depends on loanType, region, hasProperty, properties
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty, path.properties],
    path.interestRate,
    ({ loanType, registrationAddress, hasProperty, properties }: CreditApplicationForm) => {
      let base = baseInterestRate(loanType);
      if (registrationAddress?.region === 'moscow' || registrationAddress?.region === 'spb') {
        base -= 0.5;
      }
      if (hasProperty && properties && properties.length > 0) {
        base -= 1;
      }
      return Math.max(base, 5);
    }
  );

  // C.2 monthlyPayment — annuity
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
  );

  // C.3 initialPayment — 20% from propertyValue
  computeFrom(
    [path.propertyValue],
    path.initialPayment,
    ({ propertyValue }: CreditApplicationForm) =>
      propertyValue != null ? Math.round(propertyValue * 0.2) : null
  );

  // C.4 fullName — concat from personalData group
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName].filter(Boolean).join(' ')
  );

  // C.5 age — from personalData.birthDate
  computeFrom([path.personalData], path.age, ({ personalData }: CreditApplicationForm) =>
    ageFromBirthDate(personalData.birthDate)
  );

  // C.6 totalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.7 paymentToIncomeRatio
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) =>
      totalIncome > 0 ? Math.round(((monthlyPayment ?? 0) / totalIncome) * 1000) / 10 : 0
  );

  // C.8 coBorrowersIncome — sum
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((s: number, c: CoBorrower) => s + (c.monthlyIncome ?? 0), 0)
  );

  // copyFrom registrationAddress -> residenceAddress when sameAsRegistration=true
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // copyFrom email -> emailAdditional when sameEmail=true
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // Async options — cities by region
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      const r = (region as string) ?? '';
      if (!r) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        ctx.form.registrationAddress.city.setValue('');
        return;
      }
      ctx.form.registrationAddress.city.setValue('');
      const options = await fetchCitiesByRegion(r);
      ctx.form.registrationAddress.city.updateComponentProps({ options });
    },
    { debounce: 300 }
  );

  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      const r = (region as string) ?? '';
      if (!r) {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        ctx.form.residenceAddress.city.setValue('');
        return;
      }
      ctx.form.residenceAddress.city.setValue('');
      const options = await fetchCitiesByRegion(r);
      ctx.form.residenceAddress.city.updateComponentProps({ options });
    },
    { debounce: 300 }
  );

  // Async options — car models by brand
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      const b = (brand as string) ?? '';
      ctx.form.carModel.setValue('');
      if (!b) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        return;
      }
      const options = await fetchCarModelsByBrand(b);
      ctx.form.carModel.updateComponentProps({ options });
    },
    { debounce: 300 }
  );

  // Reset specific fields on loanType change
  watchField(
    path.loanType,
    (loanType, ctx) => {
      if (loanType !== 'mortgage') {
        ctx.form.propertyValue.setValue(null);
        ctx.form.initialPayment.setValue(null);
      }
      if (loanType !== 'car') {
        ctx.form.carBrand.setValue('');
        ctx.form.carModel.setValue('');
        ctx.form.carYear.setValue(null);
        ctx.form.carPrice.setValue(null);
      }
    },
    { immediate: false }
  );

  // Clear arrays on flag toggle
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) ctx.form.properties.clear();
    },
    { immediate: false }
  );

  watchField(
    path.hasExistingLoans,
    (hasExistingLoans, ctx) => {
      if (!hasExistingLoans) ctx.form.existingLoans.clear();
    },
    { immediate: false }
  );

  watchField(
    path.hasCoBorrower,
    (hasCoBorrower, ctx) => {
      if (!hasCoBorrower) ctx.form.coBorrowers.clear();
    },
    { immediate: false }
  );
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}

// Helpers exposed for FormArraySection initialValue (plain primitives)
export const createPropertyItem = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const createExistingLoan = () => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const createCoBorrower = () => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male' as const,
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});
