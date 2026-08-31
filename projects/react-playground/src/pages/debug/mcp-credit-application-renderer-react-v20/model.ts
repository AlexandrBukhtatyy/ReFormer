// model.ts — createModel + initial values + array-element factories.
// Model is the single source of truth (M1). Every conditional field is materialized here
// (enableWhen/compute/copyFrom operate on model.$.field signals — a non-materialized field has no signal).

import { createModel, type FormModel } from '@reformer/core';
import type {
  Address,
  CoBorrower,
  CreditApplicationForm,
  ExistingLoan,
  PersonalData,
  PropertyItem,
} from './types';

const blankPersonalData = (): PersonalData => ({
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  gender: 'male',
  birthPlace: '',
});

const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

// ── Array-element factories (used by array "add" buttons + prefill) ──────────
export const createBlankProperty = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const createBlankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const createBlankCoBorrower = (): CoBorrower => ({
  personalData: blankPersonalData(),
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

export function createInitialValues(): CreditApplicationForm {
  return {
    // Step 1
    loanType: 'consumer',
    loanAmount: null,
    loanTerm: 12,
    loanPurpose: '',
    propertyValue: null,
    carBrand: null,
    carModel: null,
    carYear: null,
    carPrice: null,
    // Step 2
    personalData: blankPersonalData(),
    passportData: {
      series: '',
      number: '',
      issueDate: '',
      issuedBy: '',
      departmentCode: '',
    },
    inn: '',
    snils: '',
    // Step 3
    phoneMain: '',
    phoneAdditional: null,
    email: '',
    emailAdditional: null,
    sameEmail: false,
    registrationAddress: blankAddress(),
    sameAsRegistration: true,
    residenceAddress: blankAddress(),
    // Step 4
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
    // Step 5
    maritalStatus: 'single',
    dependents: 0,
    education: 'higher',
    hasProperty: false,
    properties: [],
    hasExistingLoans: false,
    existingLoans: [],
    hasCoBorrower: false,
    coBorrowers: [],
    // Step 6
    agreePersonalData: false,
    agreeCreditHistory: false,
    agreeMarketing: false,
    agreeTerms: false,
    confirmAccuracy: false,
    electronicSignature: '',
    // Computed
    interestRate: null,
    monthlyPayment: null,
    initialPayment: null,
    fullName: '',
    age: null,
    totalIncome: null,
    paymentToIncomeRatio: null,
    coBorrowersIncome: null,
  };
}

export function createCreditApplicationModel(): FormModel<CreditApplicationForm> {
  return createModel<CreditApplicationForm>(createInitialValues());
}
