/**
 * Happy-path fixture для credit-application-form (iter-9, renderer-json).
 *
 * Используется dev-only fill-button (testId `fill-fake-data`) — заполняет
 * все поля валидными значениями для быстрого smoke-теста UX.
 *
 * Computed-поля (interestRate, monthlyPayment, fullName, age, totalIncome,
 * paymentToIncomeRatio, coBorrowersIncome) пересчитываются behavior'ом
 * автоматически — fixture их не трогает (значения здесь — fallback на
 * случай отсутствия behavior).
 */

import type { CreditApplicationForm } from './types';

export const happyPathFixture: CreditApplicationForm = {
  // Шаг 1
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры и покупка мебели',
  propertyValue: null,
  initialPayment: null,
  carBrand: '',
  carModel: '',
  carYear: null,
  carPrice: null,

  // Шаг 2
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    birthPlace: 'г. Москва',
    gender: 'male',
  },
  passportData: {
    series: '4510',
    number: '123456',
    issueDate: '2010-06-20',
    issuedBy: 'ОВД района Хамовники г. Москвы',
    departmentCode: '770-001',
  },
  inn: '123456789012',
  snils: '123-456-789 00',

  // Шаг 3
  phoneMain: '+7 (999) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '1',
    apartment: '10',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  residenceAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '1',
    apartment: '10',
    postalCode: '125009',
  },

  // Шаг 4
  employmentStatus: 'employed',
  companyName: 'ООО "Технологии будущего"',
  companyInn: '7701234567',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Ленина, д. 5',
  position: 'Старший разработчик',
  workExperienceTotal: 60,
  workExperienceCurrent: 24,
  monthlyIncome: 150000,
  additionalIncome: 20000,
  additionalIncomeSource: 'Фриланс-проекты',
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // Шаг 5
  maritalStatus: 'married',
  dependents: 1,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  // Шаг 6
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: false,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // Computed (behavior пересчитает)
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: null,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
};
