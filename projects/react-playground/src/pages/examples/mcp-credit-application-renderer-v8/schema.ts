/**
 * Iter-8 — credit-application form (target=renderer-react)
 *
 * Self-contained form module:
 * - FormSchema (createForm) — все componentProps в createForm (Patch D / D1).
 * - Behavior — declarative reactive rules.
 * - Validation — required + per-step composition + cross-field rules.
 *
 * NOTE: this is a deliberate slim implementation focused on iter-8 patch
 * verification (G/H/I/D1/D3) and happy-path orchestrator fill-button.
 * Async fetch (carModels/cities), warning-level validators and view-mode
 * are explicitly out of scope per orchestrator instructions.
 */

import { createForm, type FieldPath, type FormProxy, type FormSchema } from '@reformer/core';
import {
  copyFrom,
  enableWhen,
  computeFrom,
  watchField,
  type BehaviorSchemaFn,
} from '@reformer/core/behaviors';
import {
  apply,
  applyWhen,
  required,
  min,
  max,
  minLength,
  maxLength,
  email,
  pattern,
  validateItems,
  validateTree,
  type ValidationSchemaFn,
} from '@reformer/core/validators';
import { Checkbox, Input, InputMask, RadioGroup, Select, Textarea } from '@reformer/ui-kit';

import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  type Address,
  type CoBorrower,
  type CreditApplicationForm,
  type ExistingLoan,
  type PersonalData,
  type Property,
} from './types';

// ============================================================================
// Nested schemas (Address, PersonalData, PassportData, item-schemas)
// ============================================================================

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
    componentProps: {
      label: 'Индекс',
      placeholder: '000000',
      mask: '999999',
    },
  },
};

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
    componentProps: {
      label: 'Пол',
      options: GENDER_OPTIONS,
    },
  },
  birthPlace: {
    value: '',
    component: Input,
    componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
  },
};

const propertyItemSchema: FormSchema<Property> = {
  type: {
    value: 'apartment',
    component: Select,
    componentProps: {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: PROPERTY_TYPE_OPTIONS,
    },
  },
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
    componentProps: {
      label: 'Оценочная стоимость',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  hasEncumbrance: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Имеется обременение (залог)',
    },
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
    componentProps: { label: 'Сумма кредита', placeholder: '0', type: 'number', min: 0 },
  },
  remainingAmount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Остаток задолженности', placeholder: '0', type: 'number', min: 0 },
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

const coBorrowerItemSchema: FormSchema<CoBorrower> = {
  personalData: {
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
    componentProps: { label: 'Ежемесячный доход', placeholder: '0', type: 'number', min: 0 },
  },
};

// ============================================================================
// Root FormSchema
// ============================================================================

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // -------- Шаг 1 --------
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: LOAN_TYPE_OPTIONS,
    },
  },
  loanAmount: {
    value: 0,
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
      // Patch H: camelCase prop name
      maxLength: 500,
    },
  },
  propertyValue: {
    value: 0,
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
    value: 0,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос (₽)',
      placeholder: 'Введите сумму',
      type: 'number',
      min: 0,
      step: 10000,
      // Patch H: camelCase
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
    value: 2020,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      placeholder: '2020',
      type: 'number',
      min: 2000,
    },
  },
  carPrice: {
    value: 0,
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

  // -------- Шаг 2 --------
  personalData: personalDataSchema,
  passportData: {
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
      componentProps: {
        label: 'Код подразделения',
        placeholder: '123-456',
        mask: '999-999',
      },
    },
  },
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

  // -------- Шаг 3 --------
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

  // -------- Шаг 4 --------
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: EMPLOYMENT_STATUS_OPTIONS,
    },
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
    value: 0,
    component: Input,
    componentProps: {
      label: 'Общий стаж работы (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  workExperienceCurrent: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Стаж на текущем месте (месяцев)',
      placeholder: '0',
      type: 'number',
      min: 0,
    },
  },
  monthlyIncome: {
    value: 0,
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
    value: 0,
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

  // -------- Шаг 5 --------
  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: MARITAL_STATUS_OPTIONS,
    },
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
      options: EDUCATION_OPTIONS,
    },
  },
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  // D3: tuple-shape array; initialValue для AddButton — plain leaves (см. render-schema)
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

  // -------- Шаг 6 --------
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

  // -------- Computed (read-only) --------
  interestRate: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процентная ставка (%)',
      type: 'number',
      // Patch H: camelCase
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
    componentProps: {
      label: 'Полное имя',
      readOnly: true,
      disabled: true,
    },
  },
  age: {
    value: 0,
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

// ============================================================================
// Behavior — declarative reactive rules
// ============================================================================

export const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // -------------------------------------------------------------------------
  // copyFrom — registration → residence (full address copy when checkbox on)
  // -------------------------------------------------------------------------
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // -------------------------------------------------------------------------
  // enableWhen — progressive disclosure (Patch G: ArrayNode never disabled)
  // -------------------------------------------------------------------------
  // residenceAddress group is enable-controlled (not array)
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });

  // -------------------------------------------------------------------------
  // computeFrom — Patch I: subscribe to GROUP node when reading nested fields
  // -------------------------------------------------------------------------
  // ✅ Group-level subscription — values shape is { personalData: { lastName, firstName, ... } }
  computeFrom([path.personalData], path.fullName, (values) => {
    const pd = values.personalData;
    if (!pd) return '';
    return [pd.lastName, pd.firstName, pd.middleName].filter(Boolean).join(' ').trim();
  });

  // ✅ Group-level subscription — values shape is { personalData: { birthDate, ... } }
  computeFrom([path.personalData], path.age, (values) => {
    const pd = values.personalData;
    if (!pd?.birthDate) return 0;
    const today = new Date();
    const birth = new Date(pd.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  });

  // Same-level numeric leaves — flat shape OK (Patch I exception: top-level leaves)
  computeFrom([path.loanType, path.hasProperty], path.interestRate, (values) => {
    let base = 12;
    switch (values.loanType) {
      case 'mortgage':
        base = 9;
        break;
      case 'car':
        base = 11;
        break;
      case 'business':
        base = 14;
        break;
      case 'refinancing':
        base = 10.5;
        break;
      case 'consumer':
      default:
        base = 13;
        break;
    }
    if (values.hasProperty) base -= 0.5;
    return base;
  });

  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const P = values.loanAmount ?? 0;
      const n = values.loanTerm ?? 0;
      const rate = values.interestRate ?? 0;
      if (!P || !n) return 0;
      const r = rate / 12 / 100;
      if (r === 0) return Math.round(P / n);
      const k = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      return Math.round(P * k);
    }
  );

  computeFrom([path.propertyValue], path.initialPayment, (values) => {
    const v = values.propertyValue ?? 0;
    return Math.round(v * 0.2);
  });

  computeFrom(
    [path.monthlyIncome, path.additionalIncome, path.coBorrowersIncome],
    path.totalIncome,
    (values) =>
      (values.monthlyIncome ?? 0) + (values.additionalIncome ?? 0) + (values.coBorrowersIncome ?? 0)
  );

  computeFrom([path.monthlyPayment, path.totalIncome], path.paymentToIncomeRatio, (values) => {
    const t = values.totalIncome ?? 0;
    const p = values.monthlyPayment ?? 0;
    if (!t) return 0;
    return Math.round((p / t) * 100);
  });

  // coBorrowers is an array — subscribing to the array node yields { coBorrowers: [...] }
  computeFrom([path.coBorrowers], path.coBorrowersIncome, (values) => {
    const arr = values.coBorrowers ?? [];
    return arr.reduce((sum, cb) => sum + (cb?.monthlyIncome ?? 0), 0);
  });

  // -------------------------------------------------------------------------
  // watchField — array cleanup on toggle (immediate: false — cycle prevention)
  // -------------------------------------------------------------------------
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        // length-guard: clear only when there are items
        const arr = ctx.form.properties;
        if (arr && arr.length.value > 0) arr.clear();
      }
    },
    { immediate: false }
  );

  watchField(
    path.hasExistingLoans,
    (hasLoans, ctx) => {
      if (!hasLoans) {
        const arr = ctx.form.existingLoans;
        if (arr && arr.length.value > 0) arr.clear();
      }
    },
    { immediate: false }
  );

  watchField(
    path.hasCoBorrower,
    (hasCoBorrower, ctx) => {
      if (!hasCoBorrower) {
        const arr = ctx.form.coBorrowers;
        if (arr && arr.length.value > 0) arr.clear();
      }
    },
    { immediate: false }
  );
};

// ============================================================================
// Validation — per-step + full
// ============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок: 240 месяцев' });

  applyWhen(
    path.loanType,
    (t) => t !== 'mortgage' && t !== 'car',
    (p) => {
      required(p.loanPurpose, { message: 'Укажите цель кредита' });
      minLength(p.loanPurpose, 10, { message: 'Минимум 10 символов' });
      maxLength(p.loanPurpose, 500, { message: 'Максимум 500 символов' });
    }
  );

  applyWhen(
    path.loanType,
    (t) => t === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' });
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
};

const personalDataInnerValidation: ValidationSchemaFn<PersonalData> = (p) => {
  required(p.lastName, { message: 'Фамилия обязательна' });
  required(p.firstName, { message: 'Имя обязательно' });
  required(p.middleName, { message: 'Отчество обязательно' });
  required(p.birthDate, { message: 'Укажите дату рождения' });
  required(p.gender, { message: 'Укажите пол' });
  required(p.birthPlace, { message: 'Укажите место рождения' });
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path.personalData, personalDataInnerValidation);

  required(path.passportData.series, { message: 'Серия паспорта обязательна' });
  pattern(path.passportData.series, /^\d{2}\s\d{2}$/, { message: 'Формат: 12 34' });

  required(path.passportData.number, { message: 'Номер паспорта обязателен' });
  pattern(path.passportData.number, /^\d{6}$/, { message: 'Формат: 6 цифр' });

  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите, кем выдан' });
  required(path.passportData.departmentCode, { message: 'Укажите код подразделения' });
  pattern(path.passportData.departmentCode, /^\d{3}-\d{3}$/, { message: 'Формат: 123-456' });

  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН — 12 цифр' });

  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{3}-\d{3}-\d{3}\s\d{2}$/, { message: 'Формат: 123-456-789 00' });
};

const addressInnerValidation: ValidationSchemaFn<Address> = (p) => {
  required(p.region, { message: 'Регион обязателен' });
  required(p.city, { message: 'Город обязателен' });
  required(p.street, { message: 'Улица обязательна' });
  required(p.house, { message: 'Дом обязателен' });
  required(p.postalCode, { message: 'Индекс обязателен' });
  pattern(p.postalCode, /^\d{6}$/, { message: 'Формат: 6 цифр' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Телефон обязателен' });
  pattern(path.phoneMain, /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/, {
    message: 'Формат: +7 (___) ___-__-__',
  });

  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Некорректный email' });

  apply(path.registrationAddress, addressInnerValidation);

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p) => apply(p.residenceAddress, addressInnerValidation)
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p) => {
      required(p.companyName, { message: 'Укажите название компании' });
      required(p.companyInn, { message: 'Укажите ИНН компании' });
      required(p.position, { message: 'Укажите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p) => {
      required(p.businessType, { message: 'Укажите тип бизнеса' });
      required(p.businessInn, { message: 'Укажите ИНН' });
    }
  );

  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);
  required(path.monthlyIncome, { message: 'Укажите доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });

  // Cross-field: workExperienceCurrent <= workExperienceTotal
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const f = ctx.form.getValue();
      if (
        f.workExperienceCurrent &&
        f.workExperienceTotal &&
        f.workExperienceCurrent > f.workExperienceTotal
      ) {
        return {
          code: 'workExperienceMismatch',
          message: 'Стаж на текущем месте не может превышать общий стаж',
        };
      }
      return null;
    },
    { targetField: 'workExperienceCurrent' }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education, { message: 'Укажите образование' });

  // Item-level validation for arrays (when present)
  validateItems<CreditApplicationForm, Property>(path.properties, (item) => {
    required(item.type, { message: 'Тип имущества обязателен' });
    required(item.description, { message: 'Описание обязательно' });
    min(item.estimatedValue, 0);
  });

  validateItems<CreditApplicationForm, ExistingLoan>(path.existingLoans, (item) => {
    required(item.bank, { message: 'Банк обязателен' });
    required(item.type, { message: 'Тип кредита обязателен' });
    min(item.amount, 0);
    min(item.remainingAmount, 0);
    min(item.monthlyPayment, 0);
    required(item.maturityDate, { message: 'Дата погашения обязательна' });
  });

  validateItems<CreditApplicationForm, CoBorrower>(path.coBorrowers, (item) => {
    required(item.personalData.lastName, { message: 'Фамилия созаемщика обязательна' });
    required(item.personalData.firstName, { message: 'Имя созаемщика обязательно' });
    required(item.personalData.middleName, { message: 'Отчество созаемщика обязательно' });
    required(item.personalData.birthDate, { message: 'Дата рождения обязательна' });
    required(item.phone, { message: 'Телефон обязателен' });
    required(item.email, { message: 'Email обязателен' });
    email(item.email, { message: 'Некорректный email' });
    required(item.relationship, { message: 'Укажите родство' });
    min(item.monthlyIncome, 0);
  });
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validateTree<CreditApplicationForm>(
    (ctx) => {
      if (!ctx.form.getValue().agreePersonalData) {
        return { code: 'required', message: 'Согласие обязательно' };
      }
      return null;
    },
    { targetField: 'agreePersonalData' }
  );
  validateTree<CreditApplicationForm>(
    (ctx) => {
      if (!ctx.form.getValue().agreeCreditHistory) {
        return { code: 'required', message: 'Согласие обязательно' };
      }
      return null;
    },
    { targetField: 'agreeCreditHistory' }
  );
  validateTree<CreditApplicationForm>(
    (ctx) => {
      if (!ctx.form.getValue().agreeTerms) {
        return { code: 'required', message: 'Согласие обязательно' };
      }
      return null;
    },
    { targetField: 'agreeTerms' }
  );
  validateTree<CreditApplicationForm>(
    (ctx) => {
      if (!ctx.form.getValue().confirmAccuracy) {
        return { code: 'required', message: 'Подтверждение обязательно' };
      }
      return null;
    },
    { targetField: 'confirmAccuracy' }
  );
  required(path.electronicSignature, { message: 'Введите код из СМС' });
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

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path, step1Validation);
  apply(path, step2Validation);
  apply(path, step3Validation);
  apply(path, step4Validation);
  apply(path, step5Validation);
  apply(path, step6Validation);

  // Cross-step rule: payment-to-income ratio
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const f = ctx.form.getValue();
      if (f.paymentToIncomeRatio && f.paymentToIncomeRatio > 50) {
        return {
          code: 'paymentToIncomeTooHigh',
          message: 'Ежемесячный платеж не должен превышать 50% от дохода',
        };
      }
      return null;
    },
    { targetField: 'monthlyPayment' }
  );

  // Age 18-70
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const a = ctx.form.getValue().age;
      if (a == null) return null;
      if (a < 18) return { code: 'tooYoung', message: 'Возраст должен быть не менее 18 лет' };
      if (a > 70) return { code: 'tooOld', message: 'Возраст должен быть не более 70 лет' };
      return null;
    },
    { targetField: 'age' }
  );
};

// ============================================================================
// Factory
// ============================================================================

export const createCreditApplicationForm = (): FormProxy<CreditApplicationForm> => {
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema,
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
  });
};
