// model.ts — createModel + initial values + array-element factories.
// Every field (incl. conditional / computed) is materialized here so behavior
// signals (model.$.path) exist. Reused across all render targets.

import { createModel, type FormModel } from '@reformer/core';
import type { Address, CoBorrower, CreditApplicationForm, ExistingLoan, Property } from './types';

const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

/** New empty element for the `properties` FormArray. Plain leaves only. */
export const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

/** New empty element for the `existingLoans` FormArray. */
export const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

/** New empty element for the `coBorrowers` FormArray. */
export const blankCoBorrower = (): CoBorrower => ({
  personalData: { lastName: '', firstName: '', middleName: '' },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

/** Full initial snapshot — defines data shape + defaults (spec "Значение" column). */
export function createInitialValues(): CreditApplicationForm {
  return {
    // Step 1
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

    // Step 2
    personalData: {
      lastName: '',
      firstName: '',
      middleName: '',
      birthDate: '',
      gender: 'male',
      birthPlace: '',
    },
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
    interestRate: 0,
    monthlyPayment: 0,
    fullName: '',
    age: 0,
    totalIncome: 0,
    paymentToIncomeRatio: 0,
    coBorrowersIncome: 0,
  };
}

export function createCreditModel(
  initial?: Partial<CreditApplicationForm>
): FormModel<CreditApplicationForm> {
  return createModel<CreditApplicationForm>({
    ...createInitialValues(),
    ...initial,
  });
}
