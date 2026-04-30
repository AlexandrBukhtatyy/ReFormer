/**
 * Happy-path fixture for the credit application form (v10, target=renderer-react).
 *
 * Used by the dev-only "Заполнить тестовыми данными" button to walk all 6 steps
 * to submit without manual typing.
 *
 * Path strategy: consumer loan (no mortgage/car/property/coBorrowers) — minimal
 * conditional fields, all 4 mandatory consents true, electronicSignature '123456'.
 */

import type { CreditApplicationForm } from './types';

export const happyPathFixture: CreditApplicationForm = {
  // Step 1
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры и покупка мебели для нового дома',
  propertyValue: null,
  initialPayment: null,
  carBrand: '',
  carModel: '',
  carYear: null,
  carPrice: null,

  // Step 2
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

  // Step 3
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
  residenceAddress: {
    region: 'г. Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '10',
    apartment: '25',
    postalCode: '125009',
  },

  // Step 4
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
  businessType: '',
  businessInn: '',
  businessActivity: '',

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
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: true,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // Computed
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: null,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
};
