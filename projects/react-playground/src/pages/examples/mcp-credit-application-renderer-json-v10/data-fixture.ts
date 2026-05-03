// =============================================================================
// data-fixture.ts — happy-path values for "Заполнить тестовыми данными" button
// =============================================================================
//
// Every checkbox flag (hasProperty/hasExistingLoans/hasCoBorrower) is true so
// each FormArray has at least one item — verifies array-add cascade through
// setValue() and exercises every step.
// =============================================================================

import type { CreditApplicationFormV10 } from './types';

export const happyPathFixture: CreditApplicationFormV10 = {
  // Step 1 — consumer loan, no mortgage/car branches
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Покупка бытовой техники для дома, ремонт кухни и прочие крупные расходы.',
  propertyValue: null,
  initialPayment: null,
  carBrand: '',
  carModel: '',
  carYear: null,
  carPrice: null,

  // Step 2
  personalData: {
    lastName: 'Петров',
    firstName: 'Иван',
    middleName: 'Сергеевич',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '1234',
    number: '123456',
    issueDate: '2010-06-20',
    issuedBy: 'УВД района Тверское г. Москвы',
    departmentCode: '770001',
  },
  inn: '123456789012',
  snils: '12345678900',

  // Step 3
  phoneMain: '+79161234567',
  phoneAdditional: '',
  email: 'ivan.petrov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '5',
    apartment: '12',
    postalCode: '125009',
  },
  sameAsRegistration: true,
  residenceAddress: {
    region: 'Москва',
    city: 'Москва',
    street: 'Тверская',
    house: '5',
    apartment: '12',
    postalCode: '125009',
  },

  // Step 4 — employed
  employmentStatus: 'employed',
  companyName: 'ООО Ромашка',
  companyInn: '7701234567',
  companyPhone: '+74951234567',
  companyAddress: 'г. Москва, Пресненская набережная, 12',
  position: 'Инженер-программист',
  workExperienceTotal: 60,
  workExperienceCurrent: 24,
  monthlyIncome: 120000,
  additionalIncome: 20000,
  additionalIncomeSource: 'Фриланс-проекты',
  businessType: '',
  businessInn: '',
  businessActivity: '',

  // Step 5 — has all three array sections active
  maritalStatus: 'married',
  dependents: 1,
  education: 'higher',
  hasProperty: true,
  properties: [
    {
      type: 'apartment',
      description: 'Двухкомнатная квартира в Москве, 65 м².',
      estimatedValue: 12000000,
      hasEncumbrance: false,
    },
  ],
  hasExistingLoans: true,
  existingLoans: [
    {
      bank: 'Сбербанк',
      type: 'Кредитная карта',
      amount: 100000,
      remainingAmount: 35000,
      monthlyPayment: 5000,
      maturityDate: '2027-12-31',
    },
  ],
  hasCoBorrower: true,
  coBorrowers: [
    {
      personalData: {
        lastName: 'Петрова',
        firstName: 'Анна',
        middleName: 'Александровна',
        birthDate: '1992-08-22',
      },
      phone: '+79169876543',
      email: 'anna.petrova@example.com',
      relationship: 'Супруга',
      monthlyIncome: 90000,
    },
  ],

  // Step 6 — all required agreements true
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: false,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',

  // Computed fields are recalculated by behaviors after setValue, but provide
  // sane initial numbers so playwright sees them populated even if the
  // computeFrom cascade ran on a frame that hasn't ticked yet.
  interestRate: 18,
  monthlyPayment: 0,
  fullName: 'Петров Иван Сергеевич',
  age: 35,
  totalIncome: 230000,
  paymentToIncomeRatio: 0,
  coBorrowersIncome: 90000,
};
