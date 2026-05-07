/**
 * iter-16 / renderer-json — TS form schema (FieldConfig + validation + behavior).
 *
 * Schema-driven UI rule: components + componentProps живут здесь.
 * JSON UI tree (json-schema.ts) только описывает layout/wiring.
 */
import {
  type FieldConfig,
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
  apply,
  validate,
  validateItems,
} from '@reformer/core/validators';
import { computeFrom, watchField, copyFrom } from '@reformer/core/behaviors';
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
  Gender,
  LoanType,
  EmploymentStatus,
  MaritalStatus,
  Education,
  PropertyItem,
  ExistingLoanItem,
  CoBorrowerItem,
  Address,
  PassportData,
  PersonalData,
  PropertyType,
} from './types';

// =================================================================
// Static option lists (used by Select / Radio components)
// =================================================================

export const LOAN_TYPES = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

export const GENDERS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Работающий по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUSES = [
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'Женат / замужем' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

export const EDUCATIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'other', label: 'Иное' },
];

export const REGIONS = [
  { value: 'msk', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'novosibirsk', label: 'Новосибирская область' },
  { value: 'sverdlovsk', label: 'Свердловская область' },
];

const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_YEAR_PLUS_ONE = CURRENT_YEAR + 1;

// =================================================================
// Plain-leaf factories for FormArray initialValue
// =================================================================

export const propertyTemplate = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const existingLoanTemplate = (): ExistingLoanItem => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const coBorrowerTemplate = (): CoBorrowerItem => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

// =================================================================
// Async validator — INN check (mock)
// =================================================================

const checkInnValid: AsyncValidatorFn<string> = async (value) => {
  if (!value) return null;
  await new Promise((res) => setTimeout(res, 200));
  // mock: ИНН должен начинаться не с 0
  if (value.length > 0 && value.startsWith('0')) {
    return { code: 'inn-invalid', message: 'ИНН не может начинаться с 0' };
  }
  return null;
};

// =================================================================
// Form schema — every field with component + componentProps
// =================================================================

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
    componentProps: { label: 'Пол', options: GENDERS },
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

const addressSchema = (titlePrefix: string): FormSchema<Address> => ({
  region: {
    value: '',
    component: Select,
    componentProps: {
      label: `${titlePrefix} — Регион`,
      placeholder: 'Выберите регион',
      options: REGIONS,
    },
  },
  city: {
    value: '',
    component: Select,
    componentProps: {
      label: `${titlePrefix} — Город`,
      placeholder: 'Выберите город',
      options: [],
    },
  },
  street: {
    value: '',
    component: Input,
    componentProps: { label: `${titlePrefix} — Улица`, placeholder: 'Введите улицу' },
  },
  house: {
    value: '',
    component: Input,
    componentProps: { label: `${titlePrefix} — Дом`, placeholder: '№' },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: { label: `${titlePrefix} — Квартира`, placeholder: '№' },
  },
  postalCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: `${titlePrefix} — Индекс`,
      mask: '999999',
      placeholder: '000000',
    },
  },
});

const propertyItemSchema: FormSchema<PropertyItem> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: { label: 'Тип имущества', options: PROPERTY_TYPES },
  } satisfies FieldConfig<PropertyType>,
  description: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Описание', rows: 2, placeholder: 'Опишите имущество' },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: { label: 'Оценочная стоимость (₽)', type: 'number' },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
};

const existingLoanItemSchema: FormSchema<ExistingLoanItem> = {
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
    componentProps: { label: 'Сумма кредита (₽)', type: 'number' },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Остаток задолженности (₽)', type: 'number' },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number' },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};

const coBorrowerItemSchema: FormSchema<CoBorrowerItem> = {
  personalData: personalDataSchema,
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон созаемщика',
      mask: '+7 (999) 999-99-99',
      placeholder: '+7 (___) ___-__-__',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email созаемщика',
      type: 'email',
      placeholder: 'example@mail.com',
    },
  },
  relationship: {
    value: '',
    component: Input,
    componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number' },
  },
};

// =================================================================
// Root form schema
// =================================================================

export const formSchema: FormSchema<CreditApplicationForm> = {
  // Step 1 — Loan
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      type: 'number',
      placeholder: 'Введите сумму',
      step: 10_000,
    },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
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
  carBrand: {
    value: null,
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  carModel: {
    value: null,
    component: Select,
    componentProps: { label: 'Модель автомобиля', options: [], placeholder: 'Выберите модель' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020' },
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

  // Step 2 — Personal
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

  // Step 3 — Contacts
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
    componentProps: { label: 'Дополнительный email = основной' },
  },
  registrationAddress: addressSchema('Регистрация'),
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressSchema('Проживание'),

  // Step 4 — Employment
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
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
    componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number' },
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
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 2 },
  },

  // Step 5 — Additional
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
  } satisfies FieldConfig<MaritalStatus>,
  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      placeholder: 'Выберите уровень образования',
      options: EDUCATIONS,
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

  // Step 6 — Confirmation
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
    value: 12,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', readOnly: true, disabled: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number', readOnly: true, disabled: true },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос (₽)', type: 'number', readOnly: true, disabled: true },
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

// =================================================================
// Validation — per-step + full
// =================================================================

const personalDataValidation: ValidationSchemaFn<PersonalData> = (path) => {
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.middleName, { message: 'Отчество обязательно' });
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  required(path.gender);
  required(path.birthPlace, { message: 'Место рождения обязательно' });
};

const passportValidation: ValidationSchemaFn<PassportData> = (path) => {
  required(path.series);
  pattern(path.series, /^\d{2} \d{2}$/, { message: 'Формат: 12 34' });
  required(path.number);
  pattern(path.number, /^\d{6}$/, { message: 'Формат: 6 цифр' });
  required(path.issueDate);
  required(path.issuedBy);
  required(path.departmentCode);
  pattern(path.departmentCode, /^\d{3}-\d{3}$/, { message: 'Формат: 123-456' });
};

const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.region, { message: 'Регион обязателен' });
  required(path.city, { message: 'Город обязателен' });
  required(path.street, { message: 'Улица обязательна' });
  required(path.house, { message: 'Дом обязателен' });
  required(path.postalCode);
  pattern(path.postalCode, /^\d{6}$/, { message: 'Формат: 6 цифр' });
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: (path) => {
    required(path.loanType);
    required(path.loanAmount, { message: 'Сумма обязательна' });
    min(path.loanAmount, 50_000, { message: 'Минимум 50 000 ₽' });
    max(path.loanAmount, 10_000_000, { message: 'Максимум 10 000 000 ₽' });
    required(path.loanTerm);
    min(path.loanTerm, 6);
    max(path.loanTerm, 240);
    required(path.loanPurpose, { message: 'Опишите цель кредита' });
    minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
    maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

    applyWhen(
      path.loanType,
      (v) => v === 'mortgage',
      (p) => {
        required(p.propertyValue, { message: 'Стоимость недвижимости обязательна' });
        min(p.propertyValue, 1_000_000);
        // initialPayment >= 20% от propertyValue (cross-field)
        validate(p.initialPayment, (value, ctx) => {
          const pv = ctx.form.propertyValue.value.value;
          if (typeof pv === 'number' && pv > 0 && typeof value === 'number') {
            const min20 = pv * 0.2;
            if (value < min20) {
              return { code: 'min-initial-payment', message: 'Не менее 20% от стоимости' };
            }
          }
          return null;
        });
        // loanAmount <= propertyValue - initialPayment
        validate(p.loanAmount, (value, ctx) => {
          const pv = ctx.form.propertyValue.value.value;
          const ip = ctx.form.initialPayment.value.value;
          if (
            typeof pv === 'number' &&
            typeof ip === 'number' &&
            typeof value === 'number' &&
            value > pv - ip
          ) {
            return {
              code: 'loan-exceeds-property',
              message: 'Сумма кредита не должна превышать (стоимость - первоначальный взнос)',
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
        required(p.carBrand);
        minLength(p.carBrand, 2);
        maxLength(p.carBrand, 50);
        required(p.carModel);
        minLength(p.carModel, 1);
        maxLength(p.carModel, 50);
        required(p.carYear);
        min(p.carYear, 2000);
        max(p.carYear, CURRENT_YEAR_PLUS_ONE);
        required(p.carPrice);
        min(p.carPrice, 300_000);
        max(p.carPrice, 10_000_000);
      }
    );
  },

  2: (path) => {
    apply(path.personalData, personalDataValidation);
    apply(path.passportData, passportValidation);
    required(path.inn);
    pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
    required(path.snils);
    pattern(path.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, { message: 'Формат СНИЛС' });
    // age 18-70
    validate(path.age, (value) => {
      if (typeof value === 'number' && (value < 18 || value > 70)) {
        return { code: 'age-out-of-range', message: 'Возраст должен быть от 18 до 70 лет' };
      }
      return null;
    });
  },

  3: (path) => {
    required(path.phoneMain, { message: 'Основной телефон обязателен' });
    pattern(path.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (999) 999-99-99',
    });
    required(path.email, { message: 'Email обязателен' });
    emailValidator(path.email, { message: 'Неверный формат email' });
    apply(path.registrationAddress, addressValidation);
    applyWhen(
      path.sameAsRegistration,
      (v) => v === false,
      (p) => {
        apply(p.residenceAddress, addressValidation);
      }
    );
  },

  4: (path) => {
    required(path.employmentStatus);
    required(path.workExperienceTotal);
    min(path.workExperienceTotal, 0);
    required(path.workExperienceCurrent);
    min(path.workExperienceCurrent, 0);
    // workExperienceCurrent <= workExperienceTotal
    validate(path.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.workExperienceTotal.value.value;
      if (typeof total === 'number' && typeof value === 'number' && value > total) {
        return {
          code: 'experience-mismatch',
          message: 'Текущий стаж не может превышать общий',
        };
      }
      return null;
    });
    required(path.monthlyIncome, { message: 'Доход обязателен' });
    min(path.monthlyIncome, 10_000);
    // additionalIncomeSource обязателен если additionalIncome > 0
    validate(path.additionalIncomeSource, (value, ctx) => {
      const additional = ctx.form.additionalIncome.value.value;
      if (typeof additional === 'number' && additional > 0 && (!value || value === '')) {
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
        required(p.companyName, { message: 'Название компании обязательно' });
        required(p.companyInn, { message: 'ИНН компании обязателен' });
        pattern(p.companyInn, /^\d{10}$/, { message: 'ИНН: 10 цифр' });
        required(p.companyPhone);
        required(p.companyAddress);
        required(p.position, { message: 'Должность обязательна' });
      }
    );

    applyWhen(
      path.employmentStatus,
      (v) => v === 'selfEmployed',
      (p) => {
        required(p.businessType, { message: 'Тип бизнеса обязателен' });
        required(p.businessInn, { message: 'ИНН ИП обязателен' });
        pattern(p.businessInn, /^\d{12}$/, { message: 'ИНН: 12 цифр' });
        required(p.businessActivity);
      }
    );

    // paymentToIncomeRatio <= 50
    validate(path.paymentToIncomeRatio, (value) => {
      if (typeof value === 'number' && value > 50) {
        return {
          code: 'ratio-too-high',
          message: 'Платёж не должен превышать 50% от дохода',
        };
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

    applyWhen(
      path.hasProperty,
      (v) => v === true,
      (p) => {
        validateItems(p.properties, (itemPath) => {
          required(itemPath.type);
          required(itemPath.description, { message: 'Опишите имущество' });
          min(itemPath.estimatedValue, 0);
        });
      }
    );

    applyWhen(
      path.hasExistingLoans,
      (v) => v === true,
      (p) => {
        validateItems(p.existingLoans, (itemPath) => {
          required(itemPath.bank, { message: 'Банк обязателен' });
          required(itemPath.type);
          min(itemPath.amount, 0);
          min(itemPath.remainingAmount, 0);
          // remainingAmount <= amount
          validate(itemPath.remainingAmount, (value, ctx) => {
            const amount = ctx.form.amount.value.value;
            if (
              typeof amount === 'number' &&
              typeof value === 'number' &&
              value > amount
            ) {
              return {
                code: 'remaining-exceeds-amount',
                message: 'Остаток не может превышать сумму кредита',
              };
            }
            return null;
          });
          min(itemPath.monthlyPayment, 0);
          required(itemPath.maturityDate);
        });
      }
    );

    applyWhen(
      path.hasCoBorrower,
      (v) => v === true,
      (p) => {
        validateItems(p.coBorrowers, (itemPath) => {
          apply(itemPath.personalData, personalDataValidation);
          required(itemPath.phone);
          pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
            message: 'Формат телефона',
          });
          required(itemPath.email);
          emailValidator(itemPath.email);
          required(itemPath.relationship);
          min(itemPath.monthlyIncome, 0);
        });
      }
    );
  },

  6: (path) => {
    validate(path.agreePersonalData, (value) => {
      if (value !== true) {
        return { code: 'must-agree', message: 'Необходимо согласие' };
      }
      return null;
    });
    validate(path.agreeCreditHistory, (value) => {
      if (value !== true) {
        return { code: 'must-agree', message: 'Необходимо согласие' };
      }
      return null;
    });
    validate(path.agreeTerms, (value) => {
      if (value !== true) {
        return { code: 'must-agree', message: 'Необходимо согласие' };
      }
      return null;
    });
    validate(path.confirmAccuracy, (value) => {
      if (value !== true) {
        return { code: 'must-confirm', message: 'Необходимо подтверждение' };
      }
      return null;
    });
    required(path.electronicSignature, { message: 'Введите код' });
    pattern(path.electronicSignature, /^\d{6}$/, { message: '6 цифр' });
  },
};

export const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  STEP_VALIDATIONS[1](path);
  STEP_VALIDATIONS[2](path);
  STEP_VALIDATIONS[3](path);
  STEP_VALIDATIONS[4](path);
  STEP_VALIDATIONS[5](path);
  STEP_VALIDATIONS[6](path);
};

// =================================================================
// Behavior — computed fields + watchers + copyFrom
// =================================================================

function annuityMonthly(amount: number, term: number, ratePct: number): number {
  if (!amount || !term || !ratePct) return 0;
  const r = ratePct / 100 / 12;
  const n = term;
  const denom = Math.pow(1 + r, n) - 1;
  if (denom === 0) return 0;
  return Math.round((amount * r * Math.pow(1 + r, n)) / denom);
}

function calcAge(birthDateStr: string | null): number | null {
  if (!birthDateStr) return null;
  const bd = new Date(birthDateStr);
  if (isNaN(bd.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
}

// Mock async loaders
async function fetchCitiesByRegion(
  region: string
): Promise<{ value: string; label: string }[]> {
  await new Promise((res) => setTimeout(res, 200));
  const map: Record<string, { value: string; label: string }[]> = {
    msk: [
      { value: 'moscow', label: 'Москва' },
      { value: 'zelenograd', label: 'Зеленоград' },
    ],
    spb: [
      { value: 'spb', label: 'Санкт-Петербург' },
      { value: 'pushkin', label: 'Пушкин' },
    ],
    novosibirsk: [{ value: 'novosibirsk', label: 'Новосибирск' }],
    sverdlovsk: [{ value: 'ekb', label: 'Екатеринбург' }],
  };
  return map[region] ?? [];
}

async function fetchCarModels(brand: string): Promise<{ value: string; label: string }[]> {
  await new Promise((res) => setTimeout(res, 200));
  const map: Record<string, { value: string; label: string }[]> = {
    Toyota: [
      { value: 'camry', label: 'Camry' },
      { value: 'corolla', label: 'Corolla' },
      { value: 'rav4', label: 'RAV4' },
    ],
    Lada: [
      { value: 'vesta', label: 'Vesta' },
      { value: 'granta', label: 'Granta' },
    ],
    BMW: [
      { value: 'x5', label: 'X5' },
      { value: '3-series', label: '3 Series' },
    ],
  };
  return map[brand] ?? [];
}

export const formBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 — fullName
  computeFrom(
    [path.personalData],
    path.fullName,
    ({ personalData }: CreditApplicationForm) =>
      [personalData.lastName, personalData.firstName, personalData.middleName]
        .filter(Boolean)
        .join(' ')
  );

  // C.5 — age (group-node subscription)
  computeFrom(
    [path.personalData],
    path.age,
    ({ personalData }: CreditApplicationForm) => calcAge(personalData.birthDate)
  );

  // C.3 — initialPayment = 20% от propertyValue (только для mortgage)
  computeFrom(
    [path.propertyValue, path.loanType],
    path.initialPayment,
    ({ propertyValue, loanType }: CreditApplicationForm) => {
      if (loanType !== 'mortgage' || typeof propertyValue !== 'number') return null;
      return Math.round(propertyValue * 0.2);
    }
  );

  // C.1 — interestRate (depends on loanType, region, hasProperty)
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty],
    path.interestRate,
    ({ loanType, registrationAddress, hasProperty }: CreditApplicationForm) => {
      let base = 15;
      if (loanType === 'mortgage') base = 9;
      else if (loanType === 'car') base = 12;
      else if (loanType === 'business') base = 14;
      else if (loanType === 'refinance') base = 10;
      else base = 15;
      if (registrationAddress.region === 'msk' || registrationAddress.region === 'spb')
        base -= 0.5;
      if (hasProperty) base -= 0.5;
      return Math.max(5, Math.round(base * 100) / 100);
    }
  );

  // C.2 — monthlyPayment (annuity)
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }: CreditApplicationForm) =>
      annuityMonthly(loanAmount ?? 0, loanTerm ?? 0, interestRate)
  );

  // C.6 — totalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );

  // C.7 — paymentToIncomeRatio
  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    ({ monthlyPayment, totalIncome }: CreditApplicationForm) => {
      if (!totalIncome || totalIncome === 0) return 0;
      return Math.round(((monthlyPayment / totalIncome) * 100) * 100) / 100;
    }
  );

  // C.8 — coBorrowersIncome
  computeFrom(
    [path.coBorrowers],
    path.coBorrowersIncome,
    ({ coBorrowers }: CreditApplicationForm) =>
      (coBorrowers ?? []).reduce((sum, b) => sum + (b.monthlyIncome ?? 0), 0)
  );

  // copyFrom — registrationAddress → residenceAddress (when sameAsRegistration)
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // copyFrom — email → emailAdditional (when sameEmail)
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // Async — region → cities options
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      if (!region) {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
        ctx.form.registrationAddress.city.setValue('');
        return;
      }
      try {
        const opts = await fetchCitiesByRegion(region);
        ctx.form.registrationAddress.city.updateComponentProps({ options: opts });
      } catch {
        ctx.form.registrationAddress.city.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );

  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      if (!region) {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
        return;
      }
      try {
        const opts = await fetchCitiesByRegion(region);
        ctx.form.residenceAddress.city.updateComponentProps({ options: opts });
      } catch {
        ctx.form.residenceAddress.city.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );

  // Async — carBrand → carModel options
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      if (!brand) {
        ctx.form.carModel.updateComponentProps({ options: [] });
        ctx.form.carModel.setValue(null);
        return;
      }
      // Reset model when brand changes
      ctx.form.carModel.setValue(null);
      try {
        const opts = await fetchCarModels(brand);
        ctx.form.carModel.updateComponentProps({ options: opts });
      } catch {
        ctx.form.carModel.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );

  // loanType change — reset specific fields
  watchField(
    path.loanType,
    (loanType, ctx) => {
      if (loanType !== 'mortgage') {
        ctx.form.propertyValue.setValue(null);
      }
      if (loanType !== 'car') {
        ctx.form.carBrand.setValue(null);
        ctx.form.carModel.setValue(null);
        ctx.form.carYear.setValue(null);
        ctx.form.carPrice.setValue(null);
      }
    },
    { immediate: false }
  );

  // employmentStatus change — reset employer/business fields
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
    { immediate: false }
  );
};
