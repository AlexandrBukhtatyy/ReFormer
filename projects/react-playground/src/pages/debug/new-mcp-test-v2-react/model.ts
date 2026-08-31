/**
 * Модель формы «Заявка на кредит» — источник истины значений (слой M1).
 *
 * Правила, зафиксированные документацией:
 * - инициализируется КАЖДОЕ поле, включая условные и вычисляемые;
 * - числа-необязательные → `null`, строки → `''`, массивы → `[]`;
 * - фабрики элементов массива возвращают ПЛОСКИЕ значения (не `FieldConfig`), иначе
 *   значение поля молча становится объектом и контрол рендерит `[object Object]`.
 */

import { createModel, type FormModel } from '@reformer/core';

import type {
  AddressData,
  CoBorrowerItem,
  CreditApplicationForm,
  ExistingLoanItem,
  PersonalData,
  PropertyItem,
} from './types';

const EMPTY_ADDRESS: AddressData = {
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
};

const EMPTY_PERSONAL_DATA: PersonalData = {
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  gender: 'male',
  birthPlace: '',
};

/** Начальные значения формы — колонка «Значение» из спеки. */
export const INITIAL_CREDIT_APPLICATION: CreditApplicationForm = {
  // Шаг 1
  loanType: 'consumer',
  loanAmount: null,
  loanTerm: 12,
  loanPurpose: '',
  propertyValue: null,
  initialPayment: null,
  carBrand: null,
  carModel: null,
  carYear: null,
  carPrice: null,

  // Шаг 2
  personalData: { ...EMPTY_PERSONAL_DATA },
  passportData: {
    series: '',
    number: '',
    issueDate: '',
    issuedBy: '',
    departmentCode: '',
  },
  inn: '',
  snils: '',

  // Шаг 3
  phoneMain: '',
  phoneAdditional: null,
  email: '',
  emailAdditional: null,
  sameEmail: false,
  registrationAddress: { ...EMPTY_ADDRESS },
  sameAsRegistration: true,
  residenceAddress: { ...EMPTY_ADDRESS },

  // Шаг 4
  employmentStatus: 'employed',
  companyName: null,
  companyInn: null,
  companyPhone: null,
  companyAddress: null,
  position: null,
  workExperienceTotal: null,
  workExperienceCurrent: null,
  monthlyIncome: null,
  additionalIncome: null,
  additionalIncomeSource: null,
  businessType: null,
  businessInn: null,
  businessActivity: null,

  // Шаг 5
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  // Шаг 6
  agreePersonalData: false,
  agreeCreditHistory: false,
  agreeMarketing: false,
  agreeTerms: false,
  confirmAccuracy: false,
  electronicSignature: '',

  // Вычисляемые
  interestRate: null,
  monthlyPayment: null,
  fullName: '',
  age: null,
  totalIncome: null,
  paymentToIncomeRatio: null,
  coBorrowersIncome: null,
};

/** Новый элемент массива properties — плоские значения. */
export function createBlankProperty(): PropertyItem {
  return {
    type: 'apartment',
    description: '',
    estimatedValue: 0,
    hasEncumbrance: false,
  };
}

/** Новый элемент массива existingLoans — плоские значения. */
export function createBlankExistingLoan(): ExistingLoanItem {
  return {
    bank: '',
    type: '',
    amount: 0,
    remainingAmount: 0,
    monthlyPayment: 0,
    maturityDate: '',
  };
}

/** Новый элемент массива coBorrowers — плоские значения (personalData инициализируется целиком). */
export function createBlankCoBorrower(): CoBorrowerItem {
  return {
    personalData: { ...EMPTY_PERSONAL_DATA },
    phone: '',
    email: '',
    relationship: '',
    monthlyIncome: 0,
  };
}

/** Создать модель формы. Экземпляр стабилизируется вызывающей стороной (`useReactForm`). */
export function createCreditApplicationModel(
  initial: CreditApplicationForm = INITIAL_CREDIT_APPLICATION
): FormModel<CreditApplicationForm> {
  return createModel<CreditApplicationForm>(structuredClone(initial));
}
