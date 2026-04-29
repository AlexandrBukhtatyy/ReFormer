/**
 * Happy-path fixture: consumer credit, employed, no property/loans/co-borrowers,
 * all required consents and SMS-code filled.
 *
 * Used by the dev-only "Заполнить тестовыми данными" button in `index.tsx`.
 */

import type { CreditApplicationForm } from './types';

export const happyPathFixture: CreditApplicationForm = {
  // Step 1
  loanType: 'consumer',
  loanAmount: 800_000,
  loanTerm: 24,
  loanPurpose: 'Покупка бытовой техники и ремонт квартиры',
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
    birthDate: '1988-05-12',
    birthPlace: 'г. Москва',
    gender: 'male',
  },
  passportData: {
    series: '4509',
    number: '123456',
    issueDate: '2010-06-15',
    issuedBy: 'ОУФМС России по г. Москве',
    departmentCode: '770-001',
  },
  inn: '770123456789',
  snils: '123-456-789 00',

  // Step 3
  phoneMain: '+7 (916) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '15',
    apartment: '32',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  residenceAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '15',
    apartment: '32',
    postalCode: '125009',
  },
  sameEmail: false,

  // Step 4
  employmentStatus: 'employed',
  companyName: 'ООО "Технологии Будущего"',
  companyInn: '7707083893',
  companyPhone: '+7 (495) 555-12-34',
  companyAddress: 'г. Москва, ул. Ленина, д. 100',
  position: 'Senior Software Engineer',
  workExperienceTotal: 96,
  workExperienceCurrent: 36,
  monthlyIncome: 250_000,
  additionalIncome: 0,
  additionalIncomeSource: '',
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // Step 5
  maritalStatus: 'married',
  dependents: 1,
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
  agreeMarketing: false,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // Computed (will be overwritten by behavior on first reactive tick)
  interestRate: 18,
  monthlyPayment: 0,
  fullName: 'Иванов Иван Иванович',
  age: null,
  totalIncome: 250_000,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
};
