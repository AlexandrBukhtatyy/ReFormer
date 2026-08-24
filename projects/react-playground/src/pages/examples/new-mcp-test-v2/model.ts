/**
 * Модель формы «Заявка на кредит» — источник истины значений (M1).
 *
 * Инициализируется КАЖДОЕ поле, включая поля элементов массивов: без сигнала
 * поле не отрендерится и не провалидируется.
 */
import { createModel } from '@reformer/core';

import type {
  AddressData,
  CoBorrowerItem,
  CreditApplicationForm,
  ExistingLoanItem,
  PersonalData,
  PropertyItem,
} from './types';

export function emptyPersonalData(): PersonalData {
  return {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  };
}

export function emptyAddress(): AddressData {
  return { region: '', city: '', street: '', house: '', apartment: '', postalCode: '' };
}

/** Литерал нового элемента массива `properties` (он же `initialValue` array-ноды). */
export function emptyProperty(): PropertyItem {
  return { type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false };
}

/** Литерал нового элемента массива `existingLoans`. */
export function emptyExistingLoan(): ExistingLoanItem {
  return {
    bank: '',
    type: '',
    amount: 0,
    remainingAmount: 0,
    monthlyPayment: 0,
    maturityDate: '',
  };
}

/** Литерал нового элемента массива `coBorrowers`. */
export function emptyCoBorrower(): CoBorrowerItem {
  return {
    personalData: emptyPersonalData(),
    phone: '',
    email: '',
    relationship: '',
    monthlyIncome: 0,
  };
}

export const INITIAL_VALUES: CreditApplicationForm = {
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
  interestRate: null,
  monthlyPayment: null,

  personalData: emptyPersonalData(),
  passportData: { series: '', number: '', issueDate: '', issuedBy: '', departmentCode: '' },
  inn: '',
  snils: '',
  fullName: '',
  age: null,

  phoneMain: '',
  phoneAdditional: null,
  email: '',
  emailAdditional: null,
  sameEmail: false,
  registrationAddress: emptyAddress(),
  sameAsRegistration: true,
  residenceAddress: emptyAddress(),

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
  totalIncome: null,
  paymentToIncomeRatio: null,

  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],
  coBorrowersIncome: null,

  agreePersonalData: false,
  agreeCreditHistory: false,
  agreeMarketing: false,
  agreeTerms: false,
  confirmAccuracy: false,
  electronicSignature: '',
};

/** Глубокое слияние предзаполнения поверх дефолтов (сценарий «Загрузка с данными»). */
export function mergeInitial(prefill?: Partial<CreditApplicationForm>): CreditApplicationForm {
  const base = structuredClone(INITIAL_VALUES);
  if (!prefill) return base;
  const merged: CreditApplicationForm = { ...base };
  for (const [key, value] of Object.entries(prefill)) {
    if (value === undefined) continue;
    const current = (base as Record<string, unknown>)[key];
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      (merged as Record<string, unknown>)[key] = {
        ...(current as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function createCreditModel(prefill?: Partial<CreditApplicationForm>) {
  return createModel<CreditApplicationForm>(mergeInitial(prefill));
}
