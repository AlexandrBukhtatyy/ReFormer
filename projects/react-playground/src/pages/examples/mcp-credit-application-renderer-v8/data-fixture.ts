/**
 * Iter-8 — happy-path fixture for the dev-only fill button.
 *
 * Typed plain values for ALL fields of CreditApplicationForm. Allows
 * `form.setValue(happyPathFixture)` to fully populate the form so that
 * orchestrator can click through all 6 wizard steps to submit without
 * manual input.
 *
 * Happy path:
 * - loanType = 'consumer' → no propertyValue / mortgage / car fields needed
 * - hasProperty / hasExistingLoans / hasCoBorrower = false → arrays are []
 * - employmentStatus = 'employed' with companyName/INN/income filled
 * - Все обязательные согласия true; electronicSignature = '123456'
 */

import type { CreditApplicationForm } from './types';

export const happyPathFixture: CreditApplicationForm = {
  // -------- Шаг 1 --------
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 36,
  loanPurpose: 'Ремонт квартиры и покупка мебели для нового жилья',
  // Ипотека (не используется для consumer, но поля типизированы)
  propertyValue: 0,
  initialPayment: 0,
  // Авто (не используется для consumer)
  carBrand: '',
  carModel: '',
  carYear: 2020,
  carPrice: 0,

  // -------- Шаг 2 --------
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-01-01',
    birthPlace: 'г. Москва',
    gender: 'male',
  },
  passportData: {
    series: '45 09',
    number: '123456',
    issueDate: '2010-01-01',
    issuedBy: 'УФМС России по г. Москве',
    departmentCode: '770-001',
  },
  inn: '123456789012',
  snils: '123-456-789 00',

  // -------- Шаг 3 --------
  phoneMain: '+7 (999) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'г. Москва',
    city: 'Москва',
    street: 'ул. Тверская',
    house: '10',
    apartment: '25',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  // residence is enable-controlled by sameAsRegistration; copy via copyFrom on submit
  residenceAddress: {
    region: 'г. Москва',
    city: 'Москва',
    street: 'ул. Тверская',
    house: '10',
    apartment: '25',
    postalCode: '125009',
  },

  // -------- Шаг 4 --------
  employmentStatus: 'employed',
  companyName: 'ООО «Ромашка»',
  companyInn: '7707083893',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Ленина, д. 1',
  position: 'Старший разработчик',
  workExperienceTotal: 96,
  workExperienceCurrent: 36,
  monthlyIncome: 150000,
  additionalIncome: 0,
  additionalIncomeSource: '',
  // ИП — не заполняем для employed
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // -------- Шаг 5 --------
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  // -------- Шаг 6 --------
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: true,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // -------- Computed (read-only — будут пересчитаны behavior'ом) --------
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: 0,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
};
