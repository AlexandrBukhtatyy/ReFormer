/**
 * Happy-path fixture for the credit application form.
 *
 * Used by the dev-only "Заполнить тестовыми данными" button to fill all fields
 * with realistic values so an e2e/orchestrator pass can walk through all 6 steps
 * to submit without manual typing.
 *
 * Path strategy: consumer loan (no mortgage/car/property/coBorrowers) — minimal
 * conditional fields, all 4 mandatory consent checkboxes true, electronicSignature
 * '123456'.
 */

import type { CreditApplicationForm } from './types';

export const happyPathFixture: CreditApplicationForm = {
  // ----- Step 1: loan (consumer) -----
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры и покупка мебели для нового дома',
  // mortgage-only — leave nullable defaults
  propertyValue: null,
  initialPayment: null,
  // car-only — empty
  carBrand: '',
  carModel: '',
  carYear: null,
  carPrice: null,

  // ----- Step 2: personal -----
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-01-01',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '4509',
    number: '123456',
    issueDate: '2010-01-01',
    issuedBy: 'УФМС России по г. Москве',
    departmentCode: '770-001',
  },
  inn: '123456789012',
  snils: '123-456-789 00',

  // ----- Step 3: contacts -----
  phoneMain: '+7 (999) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'г. Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '10',
    apartment: '25',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  // residenceAddress copied from registrationAddress via copyFrom behavior;
  // fixture provides the same values so the field is consistent if user toggles flag
  residenceAddress: {
    region: 'г. Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '10',
    apartment: '25',
    postalCode: '125009',
  },

  // ----- Step 4: employment (employed) -----
  employmentStatus: 'employed',
  companyName: 'ООО Тестовая компания',
  companyInn: '7707083893',
  companyPhone: '+7 (495) 111-22-33',
  companyAddress: 'г. Москва, ул. Ленина, д. 1',
  position: 'Менеджер',
  workExperienceTotal: 60,
  workExperienceCurrent: 24,
  monthlyIncome: 120000,
  additionalIncome: 0,
  additionalIncomeSource: '',
  // selfEmployed-only — empty
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // ----- Step 5: additional (no arrays) -----
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  // ----- Step 6: confirmations -----
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: true,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // ----- Computed (will be overridden by computeFrom — provide neutral values) -----
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: null,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
};
