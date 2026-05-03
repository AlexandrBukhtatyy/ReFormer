// =============================================================================
// schema.ts — createCreditApplicationForm (target=core, iter-10 MCP regression)
// =============================================================================
//
// Composition:
//   - form: declarative FormSchema (76 spec fields, 6 steps; arrays = tuple shape)
//   - validation: ValidationSchemaFn — required/min/max/applyWhen/cross-field
//   - behavior:   BehaviorSchemaFn — copyFrom/enableWhen/computeFrom/watchField
//
// Stage flow per MCP playbook:
//   01 plan-form     — see dev-plan.md
//   02 create-form   — schema below (declarative only)
//   03 add-validation — `validation:` callback
//   04 add-behavior   — `behavior:` callback
//   05 add-form-array — tuple-shape arrays + plain-leaf templates
//   06 add-wizard     — STEP_VALIDATIONS map (consumed by FormWizard in index.tsx)
//
// Notes:
// - Conditional fields are ALWAYS declared in the FormSchema (so setValue works
//   on every leaf); Hide-not-Disable is realized in the index.tsx step bodies.
// - All `watchField` carry `{ immediate: false }`; `setValue` calls are guarded.
// =============================================================================

import {
  createForm,
  type FieldPath,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
} from '@reformer/core';
import { Checkbox, Input, InputMask, RadioGroup, Select, Textarea } from '@reformer/ui-kit';
import {
  apply,
  applyWhen,
  required,
  min,
  max,
  minLength,
  maxLength,
  email,
  validate,
  validateItems,
  validateTree,
} from '@reformer/core/validators';
import {
  copyFrom,
  enableWhen,
  computeFrom,
  watchField,
  type BehaviorSchemaFn,
} from '@reformer/core/behaviors';

import type {
  Address,
  CoBorrower,
  CreditApplicationFormV10,
  ExistingLoan,
  PersonalData,
  PassportData,
  Property,
} from './types';
import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from './types';

// =============================================================================
// Nested schemas
// =============================================================================

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
    componentProps: { label: 'Пол', options: [...GENDER_OPTIONS] },
  },
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
  // city: options загружаются асинхронно через watchField на region (см. behavior).
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
    componentProps: { label: 'Индекс', placeholder: '000000', mask: '999999' },
  },
};

const propertySchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: [...PROPERTY_TYPE_OPTIONS],
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
    componentProps: { label: 'Оценочная стоимость', placeholder: '0', type: 'number', min: 0 },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Имеется обременение (залог)' },
  },
};

const existingLoanSchema: FormSchema<ExistingLoan> = {
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
    componentProps: { label: 'Сумма кредита', placeholder: '0', type: 'number', min: 0 },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Остаток задолженности',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платеж', placeholder: '0', type: 'number', min: 0 },
  },
  maturityDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата погашения', type: 'date' },
  },
};

const coBorrowerSchema: FormSchema<CoBorrower> = {
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
    value: '',
    component: Input,
    componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Ежемесячный доход',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
};

// =============================================================================
// Root form schema (76 spec fields)
// =============================================================================

export const creditApplicationSchema: FormSchema<CreditApplicationFormV10> = {
  // ---------------------------------------------------------------------------
  // Step 1 — Loan
  // ---------------------------------------------------------------------------
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: [...LOAN_TYPE_OPTIONS],
    },
  },
  loanAmount: {
    value: undefined,
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
  // Mortgage-only
  propertyValue: {
    value: undefined,
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
    value: undefined,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Введите сумму',
      type: 'number',
      min: 0,
      step: 10000,
      readOnly: true,
    },
  },
  // Car-only
  carBrand: {
    value: '',
    component: Input,
    componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
  },
  // carModel: options загружаются асинхронно через watchField на carBrand.
  carModel: {
    value: '',
    component: Select,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Сначала введите марку',
      options: [],
    },
  },
  carYear: {
    value: undefined,
    component: Input,
    componentProps: { label: 'Год выпуска', placeholder: '2020', type: 'number' },
  },
  carPrice: {
    value: undefined,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 300000,
      max: 10000000,
    },
  },

  // ---------------------------------------------------------------------------
  // Step 2 — Personal & passport
  // ---------------------------------------------------------------------------
  personalData: personalDataSchema,
  passportData: passportDataSchema,
  inn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН', placeholder: '123456789012', mask: '999999999999' },
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

  // ---------------------------------------------------------------------------
  // Step 3 — Contacts
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Step 4 — Employment
  // ---------------------------------------------------------------------------
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: { label: 'Статус занятости', options: [...EMPLOYMENT_OPTIONS] },
  },
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  companyInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН компании', placeholder: '1234567890', mask: '9999999999' },
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
    value: undefined,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  workExperienceCurrent: {
    value: undefined,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyIncome: {
    value: undefined,
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
    value: undefined,
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
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
  },
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
  },
  businessInn: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ИНН ИП', placeholder: '123456789012', mask: '999999999999' },
  },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3 },
  },

  // ---------------------------------------------------------------------------
  // Step 5 — Additional
  // ---------------------------------------------------------------------------
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: { label: 'Семейное положение', options: [...MARITAL_OPTIONS] },
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
      options: [...EDUCATION_OPTIONS],
    },
  },
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  // Tuple-shape array — single-element array literal carries item schema
  properties: [propertySchema],

  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть другие кредиты' },
  },
  existingLoans: [existingLoanSchema],

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Добавить созаемщика' },
  },
  coBorrowers: [coBorrowerSchema],

  // ---------------------------------------------------------------------------
  // Step 6 — Confirmation
  // ---------------------------------------------------------------------------
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
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456', mask: '999999' },
  },

  // ---------------------------------------------------------------------------
  // Computed (read-only)
  // ---------------------------------------------------------------------------
  interestRate: {
    value: 0,
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
    value: undefined,
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
    componentProps: { label: 'Процент платежа от дохода (%)', type: 'number', readOnly: true },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Доход созаемщиков (₽)', type: 'number', readOnly: true },
  },
};

// =============================================================================
// Validation per step
// =============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });

  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' });

  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок: 240 месяцев (20 лет)' });

  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Опишите цель подробнее (минимум 10 символов)' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhen(
    path.loanType,
    (t) => t === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' });
      // Cross-field: loanAmount <= propertyValue − initialPayment (initialPayment computed).
      validateTree<CreditApplicationFormV10>(
        (ctx) => {
          const form = ctx.form.getValue();
          const v = form.loanAmount;
          const propertyValue = form.propertyValue;
          const initialPayment = form.initialPayment;
          if (v == null || propertyValue == null || initialPayment == null) return null;
          const cap = propertyValue - initialPayment;
          if (cap > 0 && v > cap) {
            return {
              code: 'loanAmountExceedsCap',
              message: `Сумма кредита не должна превышать ${cap.toLocaleString('ru-RU')} ₽ (стоимость минус первоначальный взнос)`,
            };
          }
          return null;
        },
        { targetField: 'loanAmount' }
      );
    }
  );

  applyWhen(
    path.loanType,
    (t) => t === 'car',
    (p) => {
      required(p.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(p.carBrand, 2, { message: 'Минимум 2 символа' });
      maxLength(p.carBrand, 50, { message: 'Максимум 50 символов' });

      required(p.carModel, { message: 'Укажите модель автомобиля' });
      minLength(p.carModel, 1, { message: 'Минимум 1 символ' });
      maxLength(p.carModel, 50, { message: 'Максимум 50 символов' });

      required(p.carYear, { message: 'Укажите год выпуска' });
      min(p.carYear, 2000, { message: 'Год выпуска не ранее 2000' });
      max(p.carYear, new Date().getFullYear() + 1, {
        message: `Год выпуска не позднее ${new Date().getFullYear() + 1}`,
      });

      required(p.carPrice, { message: 'Укажите стоимость автомобиля' });
      min(p.carPrice, 300000, { message: 'Минимальная стоимость: 300 000 ₽' });
      max(p.carPrice, 10000000, { message: 'Максимальная стоимость: 10 000 000 ₽' });
    }
  );

  // spec:1140 — loanAmount.max <= totalIncome * 10 (10 годовых доходов).
  // totalIncome = monthlyIncome*12 + additionalIncome*12 (computed).
  validateTree<CreditApplicationFormV10>(
    (ctx) => {
      const form = ctx.form.getValue();
      const v = form.loanAmount;
      const totalIncome = form.totalIncome;
      if (v == null || !totalIncome || totalIncome <= 0) return null;
      const cap = totalIncome * 12 * 10;
      if (v > cap) {
        return {
          code: 'loanAmountExceedsIncomeCap',
          message: `Сумма кредита не должна превышать ${cap.toLocaleString('ru-RU')} ₽ (10 годовых доходов)`,
        };
      }
      return null;
    },
    { targetField: 'loanAmount' }
  );

  // spec:1141 — loanTerm.max <= (70 - age) * 12 (погашение до 70 лет).
  validateTree<CreditApplicationFormV10>(
    (ctx) => {
      const form = ctx.form.getValue();
      const term = form.loanTerm;
      const age = form.age;
      if (term == null || age == null) return null;
      const maxByAge = (70 - age) * 12;
      if (term > maxByAge) {
        return {
          code: 'loanTermExceedsAgeCap',
          message: `Максимальный срок ${maxByAge} мес. — погашение должно завершиться к 70 годам`,
        };
      }
      return null;
    },
    { targetField: 'loanTerm' }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.gender, { message: 'Укажите пол' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });

  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи паспорта' });
  required(path.passportData.issuedBy, { message: 'Укажите, кем выдан паспорт' });
  required(path.passportData.departmentCode, { message: 'Укажите код подразделения' });

  required(path.inn, { message: 'Введите ИНН' });
  required(path.snils, { message: 'Введите СНИЛС' });

  // Возраст 18-70 — валидация по birthDate (single-field, без cross-field).
  validate(path.personalData.birthDate, (value: string) => {
    if (!value) return null;
    const birth = new Date(value);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years -= 1;
    if (years < 18) {
      return { code: 'tooYoung', message: 'Возраст должен быть не меньше 18 лет' };
    }
    if (years > 70) {
      return { code: 'tooOld', message: 'Возраст должен быть не больше 70 лет' };
    }
    return null;
  });
};

const step3Validation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Введите корректный email' });

  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите номер дома' });
  required(path.registrationAddress.postalCode, { message: 'Введите почтовый индекс' });

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => {
      required(p.residenceAddress.region, { message: 'Введите регион проживания' });
      required(p.residenceAddress.city, { message: 'Введите город проживания' });
      required(p.residenceAddress.street, { message: 'Введите улицу проживания' });
      required(p.residenceAddress.house, { message: 'Введите номер дома' });
      required(p.residenceAddress.postalCode, { message: 'Введите почтовый индекс' });
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      required(p.companyName, { message: 'Укажите название компании' });
      required(p.companyInn, { message: 'Укажите ИНН компании' });
      required(p.companyPhone, { message: 'Укажите телефон компании' });
      required(p.companyAddress, { message: 'Укажите адрес компании' });
      required(p.position, { message: 'Укажите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Укажите тип бизнеса' });
      required(p.businessInn, { message: 'Укажите ИНН ИП' });
      required(p.businessActivity, { message: 'Опишите вид деятельности' });
    }
  );

  required(path.workExperienceTotal, { message: 'Укажите общий стаж работы' });
  min(path.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });

  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте работы' });
  min(path.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validateTree<CreditApplicationFormV10>(
    (ctx) => {
      const form = ctx.form.getValue();
      const current = form.workExperienceCurrent;
      const total = form.workExperienceTotal;
      if (current == null || total == null) return null;
      if (current > total) {
        return {
          code: 'currentExceedsTotal',
          message: 'Стаж на текущем месте не может превышать общий стаж',
        };
      }
      return null;
    },
    { targetField: 'workExperienceCurrent' }
  );

  required(path.monthlyIncome, { message: 'Укажите ежемесячный доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });

  // spec:1139 — additionalIncomeSource обязателен если additionalIncome > 0.
  applyWhen(
    path.additionalIncome,
    (v) => typeof v === 'number' && v > 0,
    (p) => {
      required(p.additionalIncomeSource, {
        message: 'Укажите источник дополнительного дохода',
      });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0, { message: 'Количество не может быть отрицательным' });
  max(path.dependents, 10, { message: 'Максимум 10 иждивенцев' });
  required(path.education, { message: 'Укажите уровень образования' });

  // spec:1130 — existingLoans[].remainingAmount <= existingLoans[].amount (per-item).
  applyWhen(
    path.hasExistingLoans,
    (v) => v === true,
    (p) => {
      validateItems(p.existingLoans, (itemPath) => {
        // Per-item cross-field: ctx.form внутри validateTree — это FormProxy<ExistingLoan>
        // (sub-form элемента массива), поэтому ctx.form.getValue() возвращает один ExistingLoan.
        void itemPath;
        validateTree<ExistingLoan>(
          (ctx) => {
            const item = ctx.form.getValue();
            if (item.remainingAmount > item.amount) {
              return {
                code: 'remainingExceedsAmount',
                message: 'Остаток задолженности не может превышать сумму кредита',
              };
            }
            return null;
          },
          { targetField: 'remainingAmount' }
        );
      });
    }
  );
};

const step6Validation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  validate(path.agreePersonalData, (value: boolean) =>
    value === true
      ? null
      : {
          code: 'mustAgree',
          message: 'Необходимо согласиться на обработку персональных данных',
        }
  );
  validate(path.agreeCreditHistory, (value: boolean) =>
    value === true
      ? null
      : {
          code: 'mustAgree',
          message: 'Необходимо согласиться на проверку кредитной истории',
        }
  );
  validate(path.agreeTerms, (value: boolean) =>
    value === true
      ? null
      : {
          code: 'mustAgree',
          message: 'Необходимо согласиться с условиями кредитования',
        }
  );
  validate(path.confirmAccuracy, (value: boolean) =>
    value === true
      ? null
      : {
          code: 'mustConfirm',
          message: 'Необходимо подтвердить точность данных',
        }
  );
  required(path.electronicSignature, { message: 'Введите код подтверждения из СМС' });

  // spec:1133 — paymentToIncomeRatio <= 50% final-check at submit.
  validateTree<CreditApplicationFormV10>(
    (ctx) => {
      const ratio = ctx.form.getValue().paymentToIncomeRatio;
      if (ratio == null) return null;
      if (ratio > 50) {
        return {
          code: 'dtiExceeded',
          message: `Платёж по кредиту составляет ${ratio}% от дохода — превышен лимит 50%. Уменьшите сумму или увеличьте срок.`,
        };
      }
      return null;
    },
    { targetField: 'confirmAccuracy' }
  );
};

export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationFormV10>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

const fullValidation: ValidationSchemaFn<CreditApplicationFormV10> = (path) => {
  apply(path, step1Validation);
  apply(path, step2Validation);
  apply(path, step3Validation);
  apply(path, step4Validation);
  apply(path, step5Validation);
  apply(path, step6Validation);
};

// =============================================================================
// Compute helpers — module-level typed functions used by computeFrom below.
// Извлечение вместо inline arrow позволяет TS правильно проинферить
// (values: CreditApplicationFormV10) — не требуется (values: any).
// =============================================================================

function computeFullName(values: CreditApplicationFormV10): string {
  const pd = values.personalData ?? ({} as CreditApplicationFormV10['personalData']);
  const parts = [pd.lastName, pd.firstName, pd.middleName].filter(
    (s) => typeof s === 'string' && s.trim().length > 0
  );
  return parts.join(' ').trim();
}

function computeAge(values: CreditApplicationFormV10): number | undefined {
  const birth = values.personalData?.birthDate;
  if (!birth || typeof birth !== 'string') return undefined;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) y -= 1;
  return y;
}

function computeInitialPayment(values: CreditApplicationFormV10): number | undefined {
  if (
    values.loanType !== 'mortgage' ||
    typeof values.propertyValue !== 'number' ||
    values.propertyValue <= 0
  ) {
    return undefined;
  }
  return Math.round(values.propertyValue * 0.2);
}

const INTEREST_RATE_BASE: Record<string, number> = {
  consumer: 18,
  mortgage: 9,
  car: 12,
  business: 15,
  refinancing: 13,
};

function computeInterestRate(values: CreditApplicationFormV10): number {
  const base = INTEREST_RATE_BASE[values.loanType] ?? 18;
  // Регион-надбавки: столицы — базовая ставка, регионы — +1%.
  const region = values.registrationAddress?.region;
  const isCapital =
    typeof region === 'string' && /^(москва|санкт-петербург|спб)/i.test(region.trim());
  const regionAdjust = region && !isCapital ? 1 : 0;
  const propertyBonus = values.hasProperty ? 0.5 : 0;
  return Math.max(0, base + regionAdjust - propertyBonus);
}

function computeMonthlyPayment(values: CreditApplicationFormV10): number {
  const P = values.loanAmount;
  const n = values.loanTerm;
  const annualPercent = values.interestRate;
  if (!P || !n || !annualPercent || P <= 0 || n <= 0) return 0;
  const i = annualPercent / 100 / 12;
  if (i <= 0) return Math.round(P / n);
  const factor = Math.pow(1 + i, n);
  const payment = (P * (i * factor)) / (factor - 1);
  return Math.round(payment);
}

function computeCoBorrowersIncome(values: CreditApplicationFormV10): number {
  const list = values.coBorrowers;
  if (!Array.isArray(list)) return 0;
  return list.reduce(
    (acc, item) => acc + (typeof item?.monthlyIncome === 'number' ? item.monthlyIncome : 0),
    0
  );
}

function computeTotalIncome(values: CreditApplicationFormV10): number {
  return (values.monthlyIncome ?? 0) + (values.additionalIncome ?? 0);
}

function computeDtiRatio(values: CreditApplicationFormV10): number {
  const mp = values.monthlyPayment ?? 0;
  const ti = values.totalIncome ?? 0;
  if (ti <= 0) return 0;
  return Math.round((mp / ti) * 100);
}

// =============================================================================
// Behavior schema
// =============================================================================

const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationFormV10> = (
  path: FieldPath<CreditApplicationFormV10>
) => {
  // ---------------------------------------------------------------------------
  // copyFrom — sameAsRegistration → copy registrationAddress to residenceAddress
  // ---------------------------------------------------------------------------
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // ---------------------------------------------------------------------------
  // enableWhen — conditional fields (hide-not-disable is handled in JSX, but we
  // still reset values on type/status switch via resetOnDisable)
  // ---------------------------------------------------------------------------
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', { resetOnDisable: true });
  // initialPayment is computed; keep it enabled but reset on non-mortgage
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', { resetOnDisable: true });

  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carYear, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carPrice, (form) => form.loanType === 'car', { resetOnDisable: true });

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

  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });

  // residenceAddress: copyFrom держит группу синхронной с registrationAddress, когда
  // sameAsRegistration=true; скрытие секции — JSX-conditional в index.tsx.
  // НЕ применяем enableWhen+resetOnDisable: race с copyFrom (write→reset).

  // ---------------------------------------------------------------------------
  // computeFrom — same-level computed fields. Compute helpers extracted as
  // typed module-level functions (см. блок выше); inline arrows здесь не
  // используются — это даёт правильную TS-инференцию (values: TForm) → result.
  // Subscribe to GROUP node (path.personalData / path.registrationAddress)
  // when computeFn reads nested fields (Patch I).
  // ---------------------------------------------------------------------------

  computeFrom([path.personalData], path.fullName, computeFullName);
  computeFrom([path.personalData], path.age, computeAge);
  computeFrom([path.propertyValue, path.loanType], path.initialPayment, computeInitialPayment);
  computeFrom(
    [path.loanType, path.hasProperty, path.registrationAddress],
    path.interestRate,
    computeInterestRate
  );
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    computeMonthlyPayment
  );
  computeFrom([path.coBorrowers], path.coBorrowersIncome, computeCoBorrowersIncome);
  computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome, computeTotalIncome);
  computeFrom([path.monthlyPayment, path.totalIncome], path.paymentToIncomeRatio, computeDtiRatio);

  // ---------------------------------------------------------------------------
  // watchField — array cleanup on flag-uncheck (immediate: false + length guard)
  // ---------------------------------------------------------------------------
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (hasProperty === false) {
        const arr = ctx.form.properties;
        if (arr && arr.length.value > 0) arr.clear();
      }
    },
    { immediate: false }
  );
  watchField(
    path.hasExistingLoans,
    (has, ctx) => {
      if (has === false) {
        const arr = ctx.form.existingLoans;
        if (arr && arr.length.value > 0) arr.clear();
      }
    },
    { immediate: false }
  );
  watchField(
    path.hasCoBorrower,
    (has, ctx) => {
      if (has === false) {
        const arr = ctx.form.coBorrowers;
        if (arr && arr.length.value > 0) arr.clear();
      }
    },
    { immediate: false }
  );

  // -------------------------------------------------------------------------
  // Async loaders + reset cascades (spec:1114-1116, 1134-1135)
  //
  // Pattern: на изменение parent-поля делаем debounced fetch, обновляем
  // зависимый Select.options. Reset зависимого поля выполняется ВНУТРИ того
  // же loader'а ПОСЛЕ получения новых options и проверки что текущий value
  // в options не входит — тогда стираем. Это корректно работает с
  // setValue(fixture) когда parent+dependent выставляются одновременно
  // (fixture устанавливает оба, loader подгружает options и оставляет
  // dependent если он валиден для нового parent).
  // -------------------------------------------------------------------------

  // spec:1114+1134 — carBrand changes → load /api/v1/car-models?brand=...
  // + reset carModel если текущая модель не в новых options.
  watchField(
    path.carBrand,
    async (brand, ctx) => {
      const carModel = ctx.form.carModel;
      if (!brand || brand.trim().length < 2) {
        carModel.updateComponentProps({ options: [] });
        if (carModel.value.value !== '') carModel.setValue('');
        return;
      }
      try {
        const res = await fetch(`/api/v1/car-models?brand=${encodeURIComponent(brand.trim())}`);
        if (!res.ok) throw new Error(`car-models ${res.status}`);
        const options = (await res.json()) as Array<{ value: string; label: string }>;
        carModel.updateComponentProps({ options });
        const current = carModel.value.value;
        const validValues = options.map((o) => o.value);
        if (current && !validValues.includes(current)) carModel.setValue('');
      } catch (err) {
        console.error('[carBrand→models] load failed:', err);
        carModel.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );

  // spec:1115+1135 — registrationAddress.region → cities loader + city reset.
  watchField(
    path.registrationAddress.region,
    async (region, ctx) => {
      const cityNode = ctx.form.registrationAddress.city;
      if (!region || region.trim().length < 2) {
        cityNode.updateComponentProps({ options: [] });
        if (cityNode.value.value !== '') cityNode.setValue('');
        return;
      }
      try {
        const res = await fetch(`/api/v1/cities?region=${encodeURIComponent(region.trim())}`);
        if (!res.ok) throw new Error(`cities ${res.status}`);
        const options = (await res.json()) as Array<{ value: string; label: string }>;
        cityNode.updateComponentProps({ options });
        const current = cityNode.value.value;
        const validValues = options.map((o) => o.value);
        if (current && !validValues.includes(current)) cityNode.setValue('');
      } catch (err) {
        console.error('[reg.region→cities] load failed:', err);
        cityNode.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );

  // spec:1116 — residenceAddress.region (только при sameAsRegistration=false).
  watchField(
    path.residenceAddress.region,
    async (region, ctx) => {
      if (ctx.form.sameAsRegistration.value.value === true) return;
      const cityNode = ctx.form.residenceAddress.city;
      if (!region || region.trim().length < 2) {
        cityNode.updateComponentProps({ options: [] });
        if (cityNode.value.value !== '') cityNode.setValue('');
        return;
      }
      try {
        const res = await fetch(`/api/v1/cities?region=${encodeURIComponent(region.trim())}`);
        if (!res.ok) throw new Error(`cities ${res.status}`);
        const options = (await res.json()) as Array<{ value: string; label: string }>;
        cityNode.updateComponentProps({ options });
        const current = cityNode.value.value;
        const validValues = options.map((o) => o.value);
        if (current && !validValues.includes(current)) cityNode.setValue('');
      } catch (err) {
        console.error('[res.region→cities] load failed:', err);
        cityNode.updateComponentProps({ options: [] });
      }
    },
    { immediate: false, debounce: 300 }
  );
};

// =============================================================================
// Factory
// =============================================================================

export const createCreditApplicationForm = (): FormProxy<CreditApplicationFormV10> => {
  // Сплит на 3 типизированных вызова — обходит TS2589 unification на
  // GroupNodeConfig<T>{form,validation,behavior} для 76-полевой формы.
  // FormSchema-overload (createForm<T>(schema)) не рекурсирует в behavior/validation
  // generics — TS успевает проинферить за полиномиальное время.
  const form = createForm<CreditApplicationFormV10>(creditApplicationSchema);
  form.applyValidationSchema(fullValidation);
  form.applyBehaviorSchema(creditApplicationBehavior);
  return form;
};

export { fullValidation };
