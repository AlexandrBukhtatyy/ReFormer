/**
 * Form schema + behavior + validation для credit-application-form (iter-9, renderer-json).
 *
 * Form-schema declarative: для каждого поля компонент + componentProps живут здесь
 * (это runtime source-of-truth для рендера; renderer-json не дублирует componentProps).
 *
 * Behavior: computeFrom для всех 7 computed-полей, copyFrom для адресов.
 *
 * Validation: основные rules (required/min/max/minLength/maxLength/email).
 *
 * Cast createForm to (config: { form, behavior, validation }) => FormProxy<T>
 * для ухода от TS2589 на глубоко вложенной форме (Address × 2 + PassportData
 * + PersonalData + CoBorrower).
 */

import {
  createForm,
  type FieldPathNode,
  type FormProxy,
  type FormSchema,
  type ValidateOptions,
  type ValidationSchemaFn,
} from '@reformer/core';
import {
  computeFrom,
  copyFrom,
  type BehaviorSchemaFn,
} from '@reformer/core/behaviors';
import {
  required,
  email as emailValidator,
  min as minRaw,
  max as maxRaw,
  minLength,
  maxLength,
} from '@reformer/core/validators';

// Wrappers — спека объявляет числовые поля как `number | null` (для пустых
// контролируемых input[type=number]), а validators из core ожидают
// `number | undefined`. Cast сужает разницу без silent потери семантики.
type NullableNumberPath = FieldPathNode<CreditApplicationForm, number | null, unknown>;
function min(path: NullableNumberPath, value: number, options?: ValidateOptions): void {
  return minRaw(
    path as unknown as FieldPathNode<CreditApplicationForm, number | undefined>,
    value,
    options
  );
}
function max(path: NullableNumberPath, value: number, options?: ValidateOptions): void {
  return maxRaw(
    path as unknown as FieldPathNode<CreditApplicationForm, number | undefined>,
    value,
    options
  );
}
import {
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Select,
  Textarea,
} from '@reformer/ui-kit';
import {
  CO_BORROWER_RELATIONSHIPS,
  EDUCATIONS,
  EMPLOYMENT_STATUSES,
  EXISTING_LOAN_TYPES,
  GENDERS,
  LOAN_TYPES,
  MARITAL_STATUSES,
  PROPERTY_TYPES,
} from './registry';
import type {
  Address,
  CoBorrower,
  CreditApplicationForm,
  ExistingLoan,
  PassportData,
  PersonalData,
  Property,
} from './types';

// ── Reusable nested schemas ────────────────────────────────────────────────

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
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
  gender: {
    value: 'male',
    component: RadioGroup,
    componentProps: { label: 'Пол', options: GENDERS },
  },
};

const passportDataSchema: FormSchema<PassportData> = {
  series: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Серия паспорта', placeholder: '12 34', mask: '99 99' },
  },
  number: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Номер паспорта', placeholder: '123456', mask: '999999' },
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
    componentProps: { label: 'Код подразделения', placeholder: '123-456', mask: '999-999' },
  },
};

const addressSchema: FormSchema<Address> = {
  region: {
    value: '',
    component: Input,
    componentProps: { label: 'Регион', placeholder: 'Введите регион' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
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
    componentProps: { label: 'Индекс', placeholder: '000000', mask: '999999' },
  },
};

const propertyItemSchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: PROPERTY_TYPES,
    },
  },
  description: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Оценочная стоимость (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
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
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: EXISTING_LOAN_TYPES,
    },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток задолженности (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 100,
    },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};

const coBorrowerItemSchema: FormSchema<CoBorrower> = {
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
  },
  phone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  relationship: {
    value: 'spouse',
    component: Select,
    componentProps: {
      label: 'Родство',
      placeholder: 'Выберите родство',
      options: CO_BORROWER_RELATIONSHIPS,
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
};

// ── Top-level form schema ──────────────────────────────────────────────────

const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // Шаг 1: Кредит
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPES,
    },
  },
  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Сумма кредита (₽)',
      placeholder: 'Введите сумму',
      type: 'number',
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
      placeholder: 'Введите срок',
      type: 'number',
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
      rows: 4,
      maxLength: 500,
    },
  },
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 1000000,
      step: 100000,
    },
  },
  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Вычисляется автоматически',
      type: 'number',
      min: 0,
      step: 10000,
      readOnly: true,
    },
  },
  carBrand: {
    value: '',
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  carModel: {
    value: '',
    component: Input,
    componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
  },
  carYear: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      placeholder: '2020',
      type: 'number',
      min: 2000,
      max: new Date().getFullYear() + 1,
    },
  },
  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 300000,
      max: 10000000,
      step: 10000,
    },
  },

  // Шаг 2: Личные
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН',
      placeholder: '123456789012',
      mask: '999999999999',
    },
  },
  snils: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'СНИЛС',
      placeholder: '123-456-789 00',
      mask: '999-999-999 99',
    },
  },

  // Шаг 3: Контакты
  phoneMain: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Основной телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  phoneAdditional: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Дополнительный телефон',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дополнительный email',
      placeholder: 'example@mail.com',
      type: 'email',
    },
  },
  registrationAddress: addressSchema,
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressSchema,

  // Шаг 4: Работа
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
  },
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН компании',
      placeholder: '1234567890',
      mask: '9999999999',
    },
  },
  companyPhone: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Телефон компании',
      placeholder: '+7 (___) ___-__-__',
      mask: '+7 (999) 999-99-99',
    },
  },
  companyAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
  },
  position: {
    value: '',
    component: Input,
    componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
  },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 10000,
      step: 1000,
    },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Дополнительный доход (₽)',
      placeholder: '0',
      type: 'number',
      min: 0,
      step: 1000,
    },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Источник дополнительного дохода',
      placeholder: 'Опишите источник',
    },
  },
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
  },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'ИНН ИП',
      placeholder: '123456789012',
      mask: '999999999999',
    },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Вид деятельности',
      placeholder: 'Опишите вид деятельности',
      rows: 3,
    },
  },

  // Шаг 5: Доп. инфо
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
  },
  dependents: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Количество иждивенцев',
      placeholder: '0',
      type: 'number',
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
      options: EDUCATIONS,
    },
  },
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

  // Шаг 6
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
      placeholder: '123456',
      mask: '999999',
    },
  },

  // Computed
  interestRate: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный платеж (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, disabled: true },
  },
  age: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Возраст (лет)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий доход (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процент платежа от дохода (%)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Доход созаемщиков (₽)',
      type: 'number',
      readOnly: true,
      disabled: true,
    },
  },
};

// ── Behavior ───────────────────────────────────────────────────────────────

function annuity(amount: number, term: number, rate: number): number {
  if (!amount || !term || !rate) return 0;
  const r = rate / 100 / 12;
  const denom = Math.pow(1 + r, term) - 1;
  if (denom === 0) return 0;
  return Math.round((amount * r * Math.pow(1 + r, term)) / denom);
}

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function baseRate(loanType: CreditApplicationForm['loanType']): number {
  switch (loanType) {
    case 'mortgage':
      return 8.5;
    case 'car':
      return 12;
    case 'consumer':
      return 18;
    case 'business':
      return 14;
    case 'refinancing':
      return 10;
    default:
      return 18;
  }
}

const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Patch I: computeFrom group-node subscription без `as never`.
  // Подписываемся на group-node `path.personalData` целиком (FieldPathNode<TForm,
  // PersonalData>) — это валидный source без приведения. computeFn получает
  // полный values: TForm и читает values.personalData.lastName etc.
  computeFrom([path.personalData], path.fullName, (values) => {
    const pd = values.personalData;
    const ln = pd?.lastName ?? '';
    const fn = pd?.firstName ?? '';
    const mn = pd?.middleName ?? '';
    return [ln, fn, mn].filter(Boolean).join(' ').trim();
  });

  computeFrom([path.personalData], path.age, (values) =>
    calculateAge(values.personalData?.birthDate ?? '')
  );

  computeFrom([path.propertyValue], path.initialPayment, (values) => {
    const pv = values.propertyValue ?? 0;
    return Math.round(pv * 0.2);
  });

  computeFrom(
    [path.loanType, path.hasProperty],
    path.interestRate,
    (values) => {
      const base = baseRate(values.loanType);
      // имущество в залог — небольшой дисконт
      return values.hasProperty ? Math.max(base - 0.5, 0) : base;
    }
  );

  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) =>
      annuity(values.loanAmount ?? 0, values.loanTerm ?? 0, values.interestRate ?? 0)
  );

  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    (values) => (values.monthlyIncome ?? 0) + (values.additionalIncome ?? 0)
  );

  computeFrom(
    [path.monthlyPayment, path.totalIncome],
    path.paymentToIncomeRatio,
    (values) => {
      const inc = values.totalIncome ?? 0;
      if (inc <= 0) return 0;
      return Math.round(((values.monthlyPayment ?? 0) / inc) * 100);
    }
  );

  // copy registrationAddress → residenceAddress when checkbox set
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });
};

// ── Validation ─────────────────────────────────────────────────────────────

const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Шаг 1
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма — 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок — 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // Шаг 2
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });
  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });

  // Шаг 3
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Введите корректный email' });
  required(path.registrationAddress.region, { message: 'Укажите регион' });
  required(path.registrationAddress.city, { message: 'Укажите город' });
  required(path.registrationAddress.street, { message: 'Укажите улицу' });
  required(path.registrationAddress.house, { message: 'Укажите дом' });
  required(path.registrationAddress.postalCode, { message: 'Укажите индекс' });

  // Шаг 4
  required(path.employmentStatus, { message: 'Укажите статус занятости' });
  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход — 10 000 ₽' });

  // Шаг 5
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.education, { message: 'Укажите образование' });

  // Шаг 6
  required(path.agreePersonalData, {
    message: 'Необходимо согласие на обработку персональных данных',
  });
  required(path.agreeCreditHistory, {
    message: 'Необходимо согласие на проверку кредитной истории',
  });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями кредитования' });
  required(path.confirmAccuracy, { message: 'Подтвердите точность данных' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
};

// ── Per-step validation (для FormWizard config) ────────────────────────────

const stepValidation1: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма — 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок — 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });
};

const stepValidation2: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });
  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });
  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const stepValidation3: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Введите корректный email' });
  required(path.registrationAddress.region, { message: 'Укажите регион' });
  required(path.registrationAddress.city, { message: 'Укажите город' });
  required(path.registrationAddress.street, { message: 'Укажите улицу' });
  required(path.registrationAddress.house, { message: 'Укажите дом' });
  required(path.registrationAddress.postalCode, { message: 'Укажите индекс' });
};

const stepValidation4: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });
  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход — 10 000 ₽' });
};

const stepValidation5: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.education, { message: 'Укажите образование' });
};

const stepValidation6: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, {
    message: 'Необходимо согласие на обработку персональных данных',
  });
  required(path.agreeCreditHistory, {
    message: 'Необходимо согласие на проверку кредитной истории',
  });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями кредитования' });
  required(path.confirmAccuracy, { message: 'Подтвердите точность данных' });
  required(path.electronicSignature, { message: 'Введите код из СМС' });
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: stepValidation1,
  2: stepValidation2,
  3: stepValidation3,
  4: stepValidation4,
  5: stepValidation5,
  6: stepValidation6,
};

export const fullValidation = creditApplicationValidation;

// ── Form factory ───────────────────────────────────────────────────────────

// Cast createForm to dodge TS2589 on deeply nested form (Address × 2 + nested arrays).
type CreateFormCast = (config: {
  form: unknown;
  behavior: unknown;
  validation: unknown;
}) => FormProxy<CreditApplicationForm>;

export function createCreditApplicationForm(): FormProxy<CreditApplicationForm> {
  return (createForm as unknown as CreateFormCast)({
    form: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
  });
}
