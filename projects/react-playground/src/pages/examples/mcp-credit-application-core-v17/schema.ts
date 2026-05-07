// Form schema, validation, and behavior for the credit application form (iter-17 / core).
// Schema-driven UI: component + componentProps declared here; JSX renders <FormField control={...} />.

import {
  createForm,
  type FieldConfig,
  type FormSchema,
  type FormProxy,
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
  apply,
  validate,
  validateItems,
} from '@reformer/core/validators';
import {
  computeFrom,
  enableWhen,
  watchField,
  copyFrom,
} from '@reformer/core/behaviors';
import { Input, InputMask, Select, Checkbox, Textarea, RadioGroup } from '@reformer/ui-kit';

import type {
  Address,
  CoBorrower,
  CreditApplicationForm,
  Education,
  EmploymentStatus,
  ExistingLoan,
  Gender,
  LoanType,
  MaritalStatus,
  PassportData,
  PersonalData,
  PropertyItem,
  PropertyType,
} from './types';
import { checkEmailAvailable, checkInnValid, fetchCarModelsByBrand, fetchCitiesByRegion } from './api';

// ─── Option lists ────────────────────────────────────────────────────────────

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
  { value: 'employed', label: 'По найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работает' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Не в браке' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдов(а)' },
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
  { value: 'car', label: 'Автомобиль' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
];

const CURRENT_YEAR = new Date().getFullYear();

// ─── Async validators ────────────────────────────────────────────────────────

const emailUniqueValidator: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  try {
    const ok = await checkEmailAvailable(value);
    return ok ? null : { code: 'email-taken', message: 'Email уже зарегистрирован' };
  } catch {
    return { code: 'check-failed', message: 'Не удалось проверить email' };
  }
};

const innValidator: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  try {
    const ok = await checkInnValid(value);
    return ok ? null : { code: 'inn-invalid', message: 'ИНН недействителен (ошибка контрольных цифр)' };
  } catch {
    return { code: 'check-failed', message: 'Не удалось проверить ИНН' };
  }
};

// ─── Personal data sub-schema ────────────────────────────────────────────────

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
    componentProps: { label: 'Место рождения', placeholder: 'г. Москва', testId: 'birthPlace' },
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
    componentProps: { label: 'Кем выдан', placeholder: 'Отделом УФМС...', testId: 'issuedBy' },
  },
  departmentCode: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подразделения', mask: '999-999', placeholder: '123-456', testId: 'departmentCode' },
  },
};

const addressSchema = (): FormSchema<Address> => ({
  region: {
    value: '',
    component: Input,
    componentProps: { label: 'Регион', placeholder: 'Москва, Татарстан, …', testId: 'region' },
  },
  city: {
    value: '',
    component: Select,
    componentProps: {
      label: 'Город',
      placeholder: 'Сначала выберите регион',
      options: [] as { value: string; label: string }[],
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
    componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000', testId: 'postalCode' },
  },
});

// ─── Root schema ─────────────────────────────────────────────────────────────

const schema: FormSchema<CreditApplicationForm> = {
  // ── Step 1 — Loan ──
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: { label: 'Тип кредита', options: LOAN_TYPE_OPTIONS, placeholder: 'Выберите тип кредита', testId: 'loanType' },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: 'Введите сумму', step: 10000, testId: 'loanAmount' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', placeholder: 'Введите срок', testId: 'loanTerm' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', placeholder: 'Опишите, на что планируете потратить средства', maxLength: 500, rows: 3, testId: 'loanPurpose' },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости (₽)', type: 'number', placeholder: 'Введите стоимость', testId: 'propertyValue' },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос (₽)', type: 'number', placeholder: 'Автоматически', readOnly: true, testId: 'initialPayment' },
  },
  carBrand: {
    value: null,
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota', testId: 'carBrand' },
  },
  carModel: {
    value: null,
    component: Select,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Сначала выберите марку', options: [] as { value: string; label: string }[], testId: 'carModel' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020', testId: 'carYear' },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость автомобиля (₽)', type: 'number', placeholder: 'Введите стоимость', testId: 'carPrice' },
  },

  // ── Step 2 — Personal data ──
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', mask: '999999999999', placeholder: '123456789012', testId: 'inn' },
    asyncValidators: [innValidator],
    debounce: 500,
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: { label: 'СНИЛС', mask: '999-999-999 99', placeholder: '123-456-789 00', testId: 'snils' },
  },

  // ── Step 3 — Contacts ──
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Основной телефон', mask: '+7 (999) 999-99-99', placeholder: '+7 (___) ___-__-__', testId: 'phoneMain' },
  },
  phoneAdditional: {
    value: null,
    component: InputMask,
    componentProps: { label: 'Дополнительный телефон', mask: '+7 (999) 999-99-99', placeholder: '+7 (___) ___-__-__', testId: 'phoneAdditional' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com', testId: 'email' },
    asyncValidators: [emailUniqueValidator],
    debounce: 500,
  },
  emailAdditional: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный email', type: 'email', placeholder: 'example@mail.com', testId: 'emailAdditional' },
  },
  sameEmail: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Использовать основной email как дополнительный', testId: 'sameEmail' },
  },
  registrationAddress: addressSchema(),
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации', testId: 'sameAsRegistration' },
  },
  residenceAddress: addressSchema(),

  // ── Step 4 — Employment ──
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUS_OPTIONS, testId: 'employmentStatus' },
  } satisfies FieldConfig<EmploymentStatus>,
  companyName: {
    value: null,
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'ООО "Ромашка"', testId: 'companyName' },
  },
  companyInn: {
    value: null,
    component: InputMask,
    componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890', testId: 'companyInn' },
  },
  companyPhone: {
    value: null,
    component: InputMask,
    componentProps: { label: 'Телефон компании', mask: '+7 (999) 999-99-99', placeholder: '+7 (___) ___-__-__', testId: 'companyPhone' },
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
    componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number', testId: 'workExperienceTotal' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number', testId: 'workExperienceCurrent' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', testId: 'monthlyIncome' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number', testId: 'additionalIncome' },
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
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3, testId: 'businessActivity' },
  },

  // ── Step 5 — Additional ──
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUS_OPTIONS, testId: 'maritalStatus' },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', testId: 'dependents' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: { label: 'Образование', options: EDUCATION_OPTIONS, placeholder: 'Выберите уровень образования', testId: 'education' },
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
        componentProps: { label: 'Оценочная стоимость (₽)', type: 'number', testId: 'estimatedValue' },
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
        componentProps: { label: 'Сумма кредита (₽)', type: 'number', testId: 'amount' },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Остаток задолженности (₽)', type: 'number', testId: 'remainingAmount' },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number', testId: 'monthlyPayment' },
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
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99', placeholder: '+7 (___) ___-__-__', testId: 'phone' },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com', testId: 'email' },
      },
      relationship: {
        value: '',
        component: Input,
        componentProps: { label: 'Родство', placeholder: 'Супруг, родитель, …', testId: 'relationship' },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', testId: 'monthlyIncome' },
      },
    },
  ],

  // ── Step 6 — Confirmation ──
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
    componentProps: { label: 'Код подтверждения из СМС', mask: '999999', placeholder: '123456', testId: 'electronicSignature' },
  },

  // ── Computed ──
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
    value: null,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true, testId: 'interestRate' },
  },
  monthlyPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number', readOnly: true, testId: 'monthlyPayment' },
  },
  totalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий доход (₽)', type: 'number', readOnly: true, testId: 'totalIncome' },
  },
  paymentToIncomeRatio: {
    value: null,
    component: Input,
    componentProps: { label: 'Процент платежа от дохода (%)', type: 'number', readOnly: true, testId: 'paymentToIncomeRatio' },
  },
  coBorrowersIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Доход созаемщиков (₽)', type: 'number', readOnly: true, testId: 'coBorrowersIncome' },
  },
};

// ─── Validation per step + full validation ───────────────────────────────────

const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.region, { message: 'Введите регион' });
  required(path.city, { message: 'Введите город' });
  required(path.street, { message: 'Введите улицу' });
  required(path.house, { message: 'Введите номер дома' });
  required(path.postalCode, { message: 'Введите индекс' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' });
};

const personalDataValidation: ValidationSchemaFn<PersonalData> = (path) => {
  required(path.lastName, { message: 'Введите фамилию' });
  required(path.firstName, { message: 'Введите имя' });
  required(path.middleName, { message: 'Введите отчество' });
  required(path.birthDate, { message: 'Введите дату рождения' });
  required(path.gender, { message: 'Выберите пол' });
  required(path.birthPlace, { message: 'Введите место рождения' });
};

const passportValidation: ValidationSchemaFn<PassportData> = (path) => {
  required(path.series, { message: 'Введите серию паспорта' });
  pattern(path.series, /^\d{2}\s?\d{2}$/, { message: 'Серия — 4 цифры' });
  required(path.number, { message: 'Введите номер паспорта' });
  pattern(path.number, /^\d{6}$/, { message: 'Номер — 6 цифр' });
  required(path.issueDate, { message: 'Введите дату выдачи' });
  required(path.issuedBy, { message: 'Введите название органа' });
  required(path.departmentCode, { message: 'Введите код подразделения' });
  pattern(path.departmentCode, /^\d{3}-?\d{3}$/, { message: 'Код подразделения — 6 цифр' });
};

const propertyItemValidation: ValidationSchemaFn<PropertyItem> = (path) => {
  required(path.type, { message: 'Выберите тип имущества' });
  required(path.description, { message: 'Опишите имущество' });
  min(path.estimatedValue, 0, { message: 'Стоимость не может быть отрицательной' });
};

const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (path) => {
  required(path.bank, { message: 'Введите название банка' });
  required(path.type, { message: 'Введите тип кредита' });
  min(path.amount, 0, { message: 'Сумма не может быть отрицательной' });
  min(path.remainingAmount, 0, { message: 'Остаток не может быть отрицательным' });
  min(path.monthlyPayment, 0, { message: 'Платёж не может быть отрицательным' });
  required(path.maturityDate, { message: 'Введите дату погашения' });
  validate(path.remainingAmount, (value, ctx) => {
    const amount = ctx.form.amount.value.value as number;
    if (value != null && amount != null && value > amount) {
      return { code: 'remaining-exceeds-amount', message: 'Остаток не может быть больше суммы кредита' };
    }
    return null;
  });
};

const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.phone, { message: 'Введите телефон' });
  pattern(path.phone, /^\+7\s?\(\d{3}\)\s?\d{3}-?\d{2}-?\d{2}$/, {
    message: 'Неверный формат телефона',
  });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Неверный формат email' });
  required(path.relationship, { message: 'Укажите родство' });
  min(path.monthlyIncome, 0, { message: 'Доход не может быть отрицательным' });
};

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50_000, { message: 'Минимум 50 000 ₽' });
  max(path.loanAmount, 10_000_000, { message: 'Максимум 10 000 000 ₽' });

  required(path.loanTerm, { message: 'Введите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });

  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhen(
    path.loanType,
    (loanType) => loanType === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Введите стоимость недвижимости' });
      min(p.propertyValue, 1_000_000, { message: 'Минимум 1 000 000 ₽' });
      validate(p.loanAmount, (value, ctx) => {
        const propertyValue = ctx.form.propertyValue.value.value as number | null;
        const initialPayment = ctx.form.initialPayment.value.value as number | null;
        if (value != null && propertyValue != null && initialPayment != null) {
          if (value > propertyValue - initialPayment) {
            return {
              code: 'loan-exceeds-property',
              message: 'Сумма кредита не может превышать (стоимость − первоначальный взнос)',
            };
          }
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
      maxLength(p.carBrand, 50, { message: 'Максимум 50 символов' });
      required(p.carModel, { message: 'Введите модель автомобиля' });
      minLength(p.carModel, 1, { message: 'Минимум 1 символ' });
      maxLength(p.carModel, 50, { message: 'Максимум 50 символов' });
      required(p.carYear, { message: 'Введите год выпуска' });
      min(p.carYear, 2000, { message: 'Минимум 2000 год' });
      max(p.carYear, CURRENT_YEAR + 1, { message: `Максимум ${CURRENT_YEAR + 1} год` });
      required(p.carPrice, { message: 'Введите стоимость автомобиля' });
      min(p.carPrice, 300_000, { message: 'Минимум 300 000 ₽' });
      max(p.carPrice, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path.personalData, personalDataValidation);
  apply(path.passportData, passportValidation);
  required(path.inn, { message: 'Введите ИНН' });
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН — 12 цифр' });
  required(path.snils, { message: 'Введите СНИЛС' });
  pattern(path.snils, /^\d{3}-?\d{3}-?\d{3}\s?\d{2}$/, { message: 'СНИЛС — 11 цифр в формате 999-999-999 99' });

  // age range 18-70
  validate(path.personalData.birthDate, (value) => {
    if (!value) return null;
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    if (age < 18) return { code: 'age-min', message: 'Возраст должен быть от 18 лет' };
    if (age > 70) return { code: 'age-max', message: 'Возраст должен быть не более 70 лет' };
    return null;
  });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  pattern(path.phoneMain, /^\+7\s?\(\d{3}\)\s?\d{3}-?\d{2}-?\d{2}$/, {
    message: 'Неверный формат телефона',
  });

  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Неверный формат email' });

  apply(path.registrationAddress, addressValidation);

  applyWhen(
    path.sameAsRegistration,
    (same) => same === false,
    (p) => {
      apply(p.residenceAddress, addressValidation);
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус занятости' });
  required(path.workExperienceTotal, { message: 'Введите общий стаж' });
  min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
  required(path.workExperienceCurrent, { message: 'Введите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });

  // Cross-field: текущий стаж <= общий стаж
  validate(path.workExperienceCurrent, (value, ctx) => {
    const total = ctx.form.workExperienceTotal.value.value as number | null;
    if (total != null && value != null && (value as number) > total) {
      return { code: 'experience-mismatch', message: 'Текущий стаж не может превышать общий' };
    }
    return null;
  });

  required(path.monthlyIncome, { message: 'Введите ежемесячный доход' });
  min(path.monthlyIncome, 10_000, { message: 'Минимум 10 000 ₽' });
  min(path.additionalIncome, 0, { message: 'Дополнительный доход не может быть отрицательным' });

  // Условная обязательность: additionalIncomeSource при additionalIncome > 0
  validate(path.additionalIncomeSource, (value, ctx) => {
    const inc = ctx.form.additionalIncome.value.value as number | null;
    if (inc != null && inc > 0 && (!value || (value as string).trim() === '')) {
      return { code: 'income-source-required', message: 'Укажите источник дополнительного дохода' };
    }
    return null;
  });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      required(p.companyName, { message: 'Введите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН компании — 10 цифр' });
      required(p.companyPhone, { message: 'Введите телефон компании' });
      required(p.companyAddress, { message: 'Введите адрес компании' });
      required(p.position, { message: 'Введите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Введите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН ИП' });
      pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН ИП — 12 цифр' });
      required(p.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Выберите семейное положение' });
  required(path.dependents, { message: 'Введите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Минимум 0' });
  max(path.dependents, 10, { message: 'Максимум 10' });
  required(path.education, { message: 'Выберите образование' });

  applyWhen(
    path.hasProperty,
    (v) => v === true,
    (p) => {
      validateItems(p.properties, propertyItemValidation);
    }
  );

  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, existingLoanValidation);
    }
  );

  applyWhen(
    path.hasCoBorrower,
    (v) => v === true,
    (p) => {
      validateItems(p.coBorrowers, coBorrowerValidation);
    }
  );

  // Warning: paymentToIncomeRatio > 50% — hard fail; >40% — warning (soft).
  validate(path.paymentToIncomeRatio, (value) => {
    if (value != null && (value as number) > 50) {
      return { code: 'payment-too-high', message: 'Ежемесячный платёж не должен превышать 50% от дохода' };
    }
    return null;
  });
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.agreePersonalData, (value) =>
    value === true ? null : { code: 'must-be-checked', message: 'Необходимо согласие' }
  );
  validate(path.agreeCreditHistory, (value) =>
    value === true ? null : { code: 'must-be-checked', message: 'Необходимо согласие' }
  );
  validate(path.agreeTerms, (value) =>
    value === true ? null : { code: 'must-be-checked', message: 'Необходимо согласие' }
  );
  validate(path.confirmAccuracy, (value) =>
    value === true ? null : { code: 'must-be-checked', message: 'Необходимо подтверждение' }
  );
  required(path.electronicSignature, { message: 'Введите код подтверждения' });
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

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

// ─── Behavior: computeds, conditional enables, copy, async-options ──────────

function calcInterestRate(form: CreditApplicationForm): number {
  const baseByType: Record<LoanType, number> = {
    consumer: 14.5,
    mortgage: 8.5,
    car: 11,
    business: 13,
    refinancing: 10,
  };
  let rate = baseByType[form.loanType] ?? 14;
  if (form.hasProperty && form.properties.length > 0) rate -= 0.5;
  if (form.registrationAddress.region.toLowerCase().includes('москв')) rate -= 0.3;
  return Math.round(rate * 100) / 100;
}

function annuityMonthly(amount: number, term: number, ratePct: number): number {
  if (amount <= 0 || term <= 0 || ratePct <= 0) return 0;
  const r = ratePct / 100 / 12;
  const n = term;
  return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Computed: fullName
  computeFrom([path.personalData], path.fullName, ({ personalData }: CreditApplicationForm) =>
    [personalData.lastName, personalData.firstName, personalData.middleName].filter(Boolean).join(' ')
  );

  // Computed: age
  computeFrom([path.personalData], path.age, ({ personalData }: CreditApplicationForm) =>
    calcAge(personalData.birthDate)
  );

  // Computed: totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // Computed: initialPayment = 20% от propertyValue (только для ипотеки)
  computeFrom(
    [path.propertyValue, path.loanType],
    path.initialPayment,
    ({ propertyValue, loanType }: CreditApplicationForm) => {
      if (loanType !== 'mortgage' || propertyValue == null) return null;
      return Math.round(propertyValue * 0.2);
    }
  );

  // Computed: interestRate (multi-trigger via watchField pattern)
  function recomputeInterestRate(ctx: { form: FormProxy<CreditApplicationForm> }) {
    const form = ctx.form;
    const snapshot: CreditApplicationForm = form.getValue();
    const next = calcInterestRate(snapshot);
    const cur = form.interestRate.value.value as number | null;
    if (cur == null || Math.abs(cur - next) > 0.001) {
      form.interestRate.setValue(next);
    }
  }
  watchField(path.loanType, (_v, ctx) => recomputeInterestRate(ctx), { immediate: true });
  watchField(path.hasProperty, (_v, ctx) => recomputeInterestRate(ctx), { immediate: false });
  watchField(path.registrationAddress.region, (_v, ctx) => recomputeInterestRate(ctx), { immediate: false });

  // Computed: monthlyPayment = annuity(loanAmount, loanTerm, interestRate)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate ?? 0)
  );

  // Computed: paymentToIncomeRatio = monthlyPayment / totalIncome * 100
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!monthlyPayment || !totalIncome) return null;
      return Math.round((monthlyPayment / totalIncome) * 1000) / 10;
    }
  );

  // Computed: coBorrowersIncome — sum coBorrowers[].monthlyIncome
  computeFrom([path.coBorrowers], path.coBorrowersIncome, ({ coBorrowers }: CreditApplicationForm) =>
    coBorrowers.reduce((s, cb) => s + (cb.monthlyIncome ?? 0), 0)
  );

  // ── enableWhen: conditional fields ──
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', { resetOnDisable: true });
  // initialPayment — readonly + computed; not gated (auto becomes null when not mortgage via computeFrom).

  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

  enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', { resetOnDisable: true });
  enableWhen(path.companyInn, (form) => form.employmentStatus === 'employed', { resetOnDisable: true });
  enableWhen(path.companyPhone, (form) => form.employmentStatus === 'employed', { resetOnDisable: true });
  enableWhen(path.companyAddress, (form) => form.employmentStatus === 'employed', { resetOnDisable: true });
  enableWhen(path.position, (form) => form.employmentStatus === 'employed', { resetOnDisable: true });

  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', { resetOnDisable: true });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', { resetOnDisable: true });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', { resetOnDisable: true });

  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, { resetOnDisable: true });

  // ── copyFrom: registrationAddress → residenceAddress when same ──
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // ── copyFrom: email → emailAdditional when sameEmail ──
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // ── async-options: cities by region (registration + residence) ──
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      const r = (region as string) ?? '';
      ctx.form.registrationAddress.city.setValue('');
      if (!r) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        return;
      }
      ctx.form.registrationAddress.city.updateComponentProps({ loading: true, options: [] });
      try {
        const opts = await fetchCitiesByRegion(r);
        ctx.form.registrationAddress.city.updateComponentProps({ loading: false, options: opts });
      } catch {
        ctx.form.registrationAddress.city.updateComponentProps({ loading: false, options: [] });
      }
    },
    { debounce: 300 }
  );

  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      const r = (region as string) ?? '';
      ctx.form.residenceAddress.city.setValue('');
      if (!r) {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        return;
      }
      ctx.form.residenceAddress.city.updateComponentProps({ loading: true, options: [] });
      try {
        const opts = await fetchCitiesByRegion(r);
        ctx.form.residenceAddress.city.updateComponentProps({ loading: false, options: opts });
      } catch {
        ctx.form.residenceAddress.city.updateComponentProps({ loading: false, options: [] });
      }
    },
    { debounce: 300 }
  );

  // ── async-options: car models by brand ──
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      const b = (brand as string | null) ?? '';
      ctx.form.carModel.setValue(null);
      if (!b) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        return;
      }
      ctx.form.carModel.updateComponentProps({ loading: true, options: [] });
      try {
        const opts = await fetchCarModelsByBrand(b);
        ctx.form.carModel.updateComponentProps({ loading: false, options: opts });
      } catch {
        ctx.form.carModel.updateComponentProps({ loading: false, options: [] });
      }
    },
    { debounce: 300 }
  );
};

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return createForm<CreditApplicationForm>({
    form: schema,
    validation: fullValidation,
    behavior,
  });
}
