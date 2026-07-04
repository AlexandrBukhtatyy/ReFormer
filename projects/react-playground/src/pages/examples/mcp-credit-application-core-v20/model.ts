// model.ts — createModel + initial values + array-element factories.
import { createModel, type FormModel } from '@reformer/core';
import type {
  Address,
  CoBorrower,
  CreditForm,
  ExistingLoan,
  PersonalData,
  Property,
} from './types';

export const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

export const blankPersonalData = (): PersonalData => ({
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  gender: 'male',
  birthPlace: '',
});

export const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

export const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

export const blankCoBorrower = (): CoBorrower => ({
  personalData: blankPersonalData(),
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

export const initialCreditForm = (): CreditForm => ({
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
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: 0,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
});

export const createCreditModel = (): FormModel<CreditForm> =>
  createModel<CreditForm>(initialCreditForm());
