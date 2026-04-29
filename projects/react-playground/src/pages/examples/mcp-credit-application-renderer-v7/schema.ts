/**
 * Form schema, validation and behavior for the iter-7 page-2
 * credit-application form (renderer-react target).
 *
 * createForm wires:
 *  - form    — field structure (FormSchema)
 *  - behavior — minimal reactive cascade (sameAsRegistration copy + totalIncome)
 *  - validation — composed STEP_VALIDATIONS + cross-step rules
 *
 * Notes:
 *  - Every Select / RadioGroup carries `options`, `label`, `placeholder` in
 *    componentProps (Patch / risk #7 — no fallback English placeholders).
 *  - FormArray fields use the tuple shape `[itemSchema]` (Patch from
 *    add-form-array §"FormSchema array shape = tuple").
 *  - All `.value` defaults are PLAIN leaf primitives (no FieldConfig nesting).
 */

import {
  createForm,
  type FormSchema,
  type FormProxy,
  type FieldPath,
  type ValidationSchemaFn,
} from '@reformer/core';
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
  validateTree,
} from '@reformer/core/validators';
import { copyFrom, computeFrom, watchField, type BehaviorSchemaFn } from '@reformer/core/behaviors';
import { Checkbox, Input, InputMask, RadioGroup, Select, Textarea } from '@reformer/ui-kit';
import {
  type CreditApplicationForm,
  type Address,
  type PersonalData,
  type PassportData,
  type Property,
  type ExistingLoan,
  type CoBorrower,
  LOAN_TYPE_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from './types';

// ============================================================================
// Sub-schemas (nested groups)
// ============================================================================

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

const propertySchema: FormSchema<Property> = {
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
    componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
  },
  estimatedValue: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Оценочная стоимость',
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
    componentProps: { label: 'Остаток задолженности', placeholder: '0', type: 'number', min: 0 },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж', placeholder: '0', type: 'number', min: 0 },
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
// Root form schema
// ============================================================================

const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ----- Step 1: основная информация о кредите ----------------------------
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
    value: 0,
    component: Input,
    componentProps: { label: 'Год выпуска', placeholder: '2020', type: 'number' },
  },
  carPrice: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля (₽)',
      placeholder: 'Введите стоимость',
      type: 'number',
      min: 300000,
      step: 10000,
    },
  },

  // ----- Step 2: персональные данные --------------------------------------
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
    componentProps: { label: 'СНИЛС', placeholder: '123-456-789 00', mask: '999-999-999 99' },
  },

  // ----- Step 3: контакты -------------------------------------------------
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

  // ----- Step 4: занятость ------------------------------------------------
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
    componentProps: { label: 'ИНН ИП', placeholder: '123456789012', mask: '999999999999' },
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

  // ----- Step 5: дополнительная информация --------------------------------
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
  // Tuple-literal — array shape required by FormSchema (silent corruption otherwise).
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
    componentProps: { label: 'Добавить созаёмщика' },
  },
  coBorrowers: [coBorrowerSchema],

  // ----- Step 6: согласия --------------------------------------------------
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
    componentProps: { label: 'Подтверждаю точность введённых данных' },
  },
  electronicSignature: {
    value: '',
    component: InputMask,
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456', mask: '999999' },
  },

  // ----- Computed (read-only) ---------------------------------------------
  interestRate: {
    value: 15.5,
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
      label: 'Ежемесячный платёж (₽)',
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
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', readOnly: true, disabled: true },
  },
};

// ============================================================================
// Validation — STEP_VALIDATIONS + composite full
// ============================================================================

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Укажите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма кредита: 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Укажите срок кредита' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимальный срок: 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  applyWhen(
    path.loanType,
    (t) => t === 'mortgage',
    (p: FieldPath<CreditApplicationForm>) => {
      required(p.propertyValue, { message: 'Укажите стоимость недвижимости' });
      min(p.propertyValue, 1000000, { message: 'Минимальная стоимость: 1 000 000 ₽' });
      required(p.initialPayment, { message: 'Укажите первоначальный взнос' });
    }
  );

  applyWhen(
    path.loanType,
    (t) => t === 'car',
    (p: FieldPath<CreditApplicationForm>) => {
      required(p.carBrand, { message: 'Укажите марку автомобиля' });
      minLength(p.carBrand, 2);
      required(p.carModel, { message: 'Укажите модель автомобиля' });
      required(p.carYear, { message: 'Укажите год выпуска' });
      min(p.carYear, 2000);
      max(p.carYear, new Date().getFullYear() + 1);
      required(p.carPrice, { message: 'Укажите стоимость автомобиля' });
      min(p.carPrice, 300000);
    }
  );
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.personalData.lastName, { message: 'Введите фамилию' });
  required(path.personalData.firstName, { message: 'Введите имя' });
  required(path.personalData.middleName, { message: 'Введите отчество' });
  required(path.personalData.birthDate, { message: 'Укажите дату рождения' });
  required(path.personalData.gender, { message: 'Укажите пол' });
  required(path.personalData.birthPlace, { message: 'Укажите место рождения' });

  required(path.passportData.series, { message: 'Введите серию паспорта' });
  required(path.passportData.number, { message: 'Введите номер паспорта' });
  required(path.passportData.issueDate, { message: 'Укажите дату выдачи' });
  required(path.passportData.issuedBy, { message: 'Укажите кем выдан' });
  required(path.passportData.departmentCode, { message: 'Введите код подразделения' });

  required(path.inn, { message: 'Введите ИНН' });
  pattern(path.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });
  required(path.snils, { message: 'Введите СНИЛС' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите основной телефон' });
  required(path.email, { message: 'Введите email' });
  email(path.email, { message: 'Неверный формат email' });

  required(path.registrationAddress.region, { message: 'Введите регион' });
  required(path.registrationAddress.city, { message: 'Введите город' });
  required(path.registrationAddress.street, { message: 'Введите улицу' });
  required(path.registrationAddress.house, { message: 'Введите дом' });
  required(path.registrationAddress.postalCode, { message: 'Введите индекс' });

  applyWhen(
    path.sameAsRegistration,
    (v) => v === false,
    (p: FieldPath<CreditApplicationForm>) => {
      required(p.residenceAddress.region, { message: 'Введите регион проживания' });
      required(p.residenceAddress.city, { message: 'Введите город проживания' });
      required(p.residenceAddress.street, { message: 'Введите улицу проживания' });
      required(p.residenceAddress.house, { message: 'Введите дом проживания' });
      required(p.residenceAddress.postalCode, { message: 'Введите индекс проживания' });
    }
  );
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Укажите статус занятости' });

  applyWhen(
    path.employmentStatus,
    (s) => s === 'employed',
    (p: FieldPath<CreditApplicationForm>) => {
      required(p.companyName, { message: 'Введите название компании' });
      required(p.companyInn, { message: 'Введите ИНН компании' });
      required(p.position, { message: 'Введите должность' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s === 'selfEmployed',
    (p: FieldPath<CreditApplicationForm>) => {
      required(p.businessType, { message: 'Укажите тип бизнеса' });
      required(p.businessInn, { message: 'Введите ИНН ИП' });
    }
  );

  applyWhen(
    path.employmentStatus,
    (s) => s !== 'unemployed',
    (p: FieldPath<CreditApplicationForm>) => {
      required(p.monthlyIncome, { message: 'Укажите ежемесячный доход' });
      min(p.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });
    }
  );

  required(path.workExperienceTotal, { message: 'Укажите общий стаж' });
  min(path.workExperienceTotal, 0);
  required(path.workExperienceCurrent, { message: 'Укажите стаж на текущем месте' });
  min(path.workExperienceCurrent, 0);
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Укажите семейное положение' });
  required(path.dependents, { message: 'Укажите количество иждивенцев' });
  min(path.dependents, 0);
  max(path.dependents, 10);
  required(path.education, { message: 'Укажите образование' });
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие на обработку данных' });
  required(path.agreeCreditHistory, { message: 'Необходимо согласие на проверку КИ' });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями' });
  required(path.confirmAccuracy, { message: 'Необходимо подтверждение точности данных' });
  required(path.electronicSignature, { message: 'Введите код подтверждения' });
  pattern(path.electronicSignature, /^\d{6}$/, { message: 'Код должен содержать 6 цифр' });
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
  apply(path, step1Validation);
  apply(path, step2Validation);
  apply(path, step3Validation);
  apply(path, step4Validation);
  apply(path, step5Validation);
  apply(path, step6Validation);

  // Cross-step rule: payment-to-income ratio (using monthly income only as
  // simplification — full computeFrom cascade is out of scope for this iter).
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const v = ctx.form.getValue();
      if (v.monthlyIncome > 0 && v.loanAmount > 0 && v.loanTerm > 0) {
        const approx = v.loanAmount / v.loanTerm;
        if (approx / v.monthlyIncome > 0.5) {
          return {
            code: 'paymentToIncomeTooHigh',
            message: 'Ежемесячный платёж не должен превышать 50% от дохода',
          };
        }
      }
      return null;
    },
    { targetField: 'monthlyIncome' }
  );

  // Cross-step rule: age 18..70 from birthDate.
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const v = ctx.form.getValue();
      if (!v.personalData?.birthDate) return null;
      const birth = new Date(v.personalData.birthDate);
      if (Number.isNaN(birth.getTime())) return null;
      const ageMs = Date.now() - birth.getTime();
      const age = ageMs / (365.25 * 24 * 3600 * 1000);
      if (age < 18) return { code: 'ageTooYoung', message: 'Возраст должен быть не менее 18 лет' };
      if (age > 70) return { code: 'ageTooOld', message: 'Возраст должен быть не более 70 лет' };
      return null;
    },
    { targetField: 'personalData' }
  );
};

// ============================================================================
// Behavior — minimal reactive cascade (regression-test only)
// ============================================================================

const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Copy registration → residence whenever sameAsRegistration is true.
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
  });

  // Compute totalIncome = monthlyIncome + additionalIncome.
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    (form) => (Number(form.monthlyIncome ?? 0) || 0) + (Number(form.additionalIncome ?? 0) || 0)
  );

  // Compute fullName from personalData.{last,first,middle}Name (read-only display).
  // Subscribe to the personalData GROUP node — computeFrom unpacks last-segment
  // keys into the values object, so a group source gives us { personalData: {...} }
  // instead of three flat leaf keys.
  computeFrom([path.personalData], path.fullName, (values) => {
    const pd = values.personalData;
    return [pd?.lastName, pd?.firstName, pd?.middleName].filter(Boolean).join(' ').trim();
  });

  // interestRate — base rate per loanType (mortgage cheaper, business pricier).
  watchField(
    path.loanType,
    (loanType, ctx) => {
      const rates: Record<string, number> = {
        consumer: 15.5,
        mortgage: 8.5,
        car: 12.0,
        business: 17.5,
        refinancing: 11.0,
      };
      const next = rates[loanType as string] ?? 15.5;
      const cur = ctx.form.interestRate.getValue() as number;
      if (cur !== next) ctx.form.interestRate.setValue(next);
    },
    { immediate: false }
  );

  // monthlyPayment — annuity formula. 0 if any input missing.
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = Number(values.loanAmount ?? 0) || 0;
      const term = Number(values.loanTerm ?? 0) || 0;
      const rate = Number(values.interestRate ?? 0) || 0;
      if (!amount || !term || !rate) return 0;
      const r = rate / 100 / 12;
      const n = term;
      return Math.round((amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }
  );
};

// ============================================================================
// Public factory
// ============================================================================

export const createCreditApplicationForm = (): FormProxy<CreditApplicationForm> => {
  // TS2589 protection: the union of nested schemas + arrays + computed
  // fields can blow the recursive type-check budget. We pin the cast to the
  // last call only, so type-safety inside the schema literal stays strong.
  return createForm<CreditApplicationForm>({
    form: creditApplicationSchema as never,
    behavior: creditApplicationBehavior,
    validation: fullValidation,
  }) as unknown as FormProxy<CreditApplicationForm>;
};

// Re-export for convenience in render-schema.tsx.
export type { FieldPath };
