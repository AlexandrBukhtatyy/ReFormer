/**
 * Happy-path consumer-credit fixture for the iter-9 credit-application form.
 *
 * Used by the dev-only «Заполнить тестовыми данными» button in `index.tsx`.
 * Skips conditional fields (mortgage / car / properties / existingLoans /
 * coBorrowers) so the form takes the shortest valid path through all 6 steps.
 *
 * Computed fields (interestRate, monthlyPayment, fullName, age, totalIncome,
 * paymentToIncomeRatio, coBorrowersIncome) are intentionally seeded as-is and
 * will be overwritten by `computeFrom` behaviors as soon as values are set.
 */

import type { CreditApplicationForm } from './types';

export const happyPathFixture: CreditApplicationForm = {
  // Step 1 — Кредит
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 36,
  loanPurpose: 'Ремонт квартиры и покупка мебели для семейного жилья.',
  propertyValue: 0,
  initialPayment: 0,
  carBrand: '',
  carModel: '',
  carYear: 0,
  carPrice: 0,

  // Step 2 — Данные
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '45 12',
    number: '345678',
    issueDate: '2015-06-20',
    issuedBy: 'ОУФМС России по гор. Москве',
    departmentCode: '770-001',
  },
  inn: '770123456789',
  snils: '123-456-789 00',

  // Step 3 — Контакты
  phoneMain: '+7 (916) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov.ivan@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '15',
    apartment: '42',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  residenceAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '15',
    apartment: '42',
    postalCode: '125009',
  },

  // Step 4 — Работа
  employmentStatus: 'employed',
  companyName: 'ООО «Технологии Будущего»',
  companyInn: '7701234567',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Пушкина, д. 10',
  position: 'Ведущий инженер',
  workExperienceTotal: 120,
  workExperienceCurrent: 36,
  monthlyIncome: 150000,
  additionalIncome: 0,
  additionalIncomeSource: '',
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // Step 5 — Доп. инфо
  maritalStatus: 'married',
  dependents: 1,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  // Step 6 — Согласия
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: false,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // Computed (will be overridden by computeFrom on first reactive cycle)
  interestRate: 0,
  monthlyPayment: 0,
  fullName: '',
  age: 0,
  totalIncome: 0,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 0,
};
