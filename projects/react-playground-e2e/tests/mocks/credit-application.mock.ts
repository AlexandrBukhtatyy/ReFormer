/**
 * Mock data for Credit Application API responses
 * Based on CreditApplicationForm interface from the application
 */

// ============================================================================
// Types (matching the application types)
// ============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: 'male' | 'female';
  birthPlace: string;
}

export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

export interface Property {
  type: string;
  value: number;
  description: string;
}

export interface ExistingLoan {
  bank: string;
  amount: number;
  monthlyPayment: number;
  remainingTerm: number;
}

export interface CoBorrower {
  personalData: PersonalData;
  monthlyIncome: number;
  relationship: string;
}

export interface CreditApplicationMock {
  // Step 1: Basic loan info
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  // Mortgage specific
  propertyValue?: number;
  initialPayment?: number;
  // Car loan specific
  carBrand?: string;
  carModel?: string;
  carYear?: number;
  carPrice?: number;

  // Step 2: Personal data
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3: Contact info
  phoneMain: string;
  phoneAdditional?: string;
  email: string;
  emailAdditional?: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress?: Address;

  // Step 4: Employment
  employmentStatus: EmploymentStatus;
  companyName?: string;
  companyInn?: string;
  companyPhone?: string;
  companyAddress?: string;
  position?: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome?: number;
  additionalIncomeSource?: string;
  businessType?: string;
  businessInn?: string;
  businessActivity?: string;

  // Step 5: Additional info
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties?: Property[];
  hasExistingLoans: boolean;
  existingLoans?: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers?: CoBorrower[];

  // Step 6: Agreements (usually false in mock, filled during test)
  agreePersonalData?: boolean;
  agreeCreditHistory?: boolean;
  agreeMarketing?: boolean;
  agreeTerms?: boolean;
  confirmAccuracy?: boolean;
  electronicSignature?: string;
}

// ============================================================================
// Mock Data: Consumer Loan Application (ID: 1)
// ============================================================================

export const MOCK_CREDIT_APPLICATION_1: Partial<CreditApplicationMock> = {
  // Step 1: Basic info
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры',

  // Step 2: Personal data
  personalData: {
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: 'Иванович',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'г. Москва',
  },
  passportData: {
    series: '45 06',
    number: '123456',
    issueDate: '2010-06-20',
    issuedBy: 'ОВД Центрального района г. Москвы',
    departmentCode: '770-001',
  },
  inn: '123456789012',
  snils: '123-456-789 01',

  // Step 3: Contact info
  phoneMain: '+7 (999) 123-45-67',
  phoneAdditional: '',
  email: 'ivanov@example.com',
  emailAdditional: '',
  registrationAddress: {
    region: 'Московская область',
    city: 'Москва',
    street: 'Тверская',
    house: '1',
    apartment: '10',
    postalCode: '123456',
  },
  sameAsRegistration: true,

  // Step 4: Employment
  employmentStatus: 'employed',
  companyName: 'ООО Рога и Копыта',
  companyInn: '7707083893',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'г. Москва, ул. Ленина, д. 1',
  position: 'Менеджер',
  workExperienceTotal: 60,
  workExperienceCurrent: 24,
  monthlyIncome: 100000,
  additionalIncome: 20000,
  additionalIncomeSource: 'Сдача квартиры',

  // Step 5: Additional info
  maritalStatus: 'married',
  dependents: 2,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  // Step 6: Not pre-filled (user must accept)
  agreePersonalData: false,
  agreeCreditHistory: false,
  agreeMarketing: false,
  agreeTerms: false,
  confirmAccuracy: false,
  electronicSignature: '',
};

// ============================================================================
// Mock Data: Mortgage Application (ID: 2)
// ============================================================================

export const MOCK_CREDIT_APPLICATION_2: Partial<CreditApplicationMock> = {
  // Step 1: Basic info - Mortgage
  loanType: 'mortgage',
  loanAmount: 4000000,
  loanTerm: 240,
  loanPurpose: 'Покупка квартиры',
  propertyValue: 5000000,
  initialPayment: 1000000,

  // Step 2: Personal data
  personalData: {
    lastName: 'Петрова',
    firstName: 'Анна',
    middleName: 'Сергеевна',
    birthDate: '1985-03-20',
    gender: 'female',
    birthPlace: 'г. Санкт-Петербург',
  },
  passportData: {
    series: '40 15',
    number: '654321',
    issueDate: '2015-04-10',
    issuedBy: 'УФМС России по г. Санкт-Петербургу',
    departmentCode: '780-002',
  },
  inn: '782512345678',
  snils: '987-654-321 00',

  // Step 3: Contact info
  phoneMain: '+7 (911) 987-65-43',
  phoneAdditional: '+7 (812) 555-12-34',
  email: 'petrova@example.com',
  emailAdditional: 'anna.petrova@work.com',
  registrationAddress: {
    region: 'Ленинградская область',
    city: 'Санкт-Петербург',
    street: 'Невский проспект',
    house: '100',
    apartment: '25',
    postalCode: '190000',
  },
  sameAsRegistration: false,
  residenceAddress: {
    region: 'Ленинградская область',
    city: 'Санкт-Петербург',
    street: 'Московский проспект',
    house: '50',
    apartment: '15',
    postalCode: '190001',
  },

  // Step 4: Employment - Self-employed
  employmentStatus: 'selfEmployed',
  businessType: 'ИП',
  businessInn: '782512345678',
  businessActivity: 'Консалтинговые услуги',
  workExperienceTotal: 120,
  workExperienceCurrent: 60,
  monthlyIncome: 200000,
  additionalIncome: 50000,
  additionalIncomeSource: 'Инвестиции',

  // Step 5: Additional info - with property and co-borrower
  maritalStatus: 'married',
  dependents: 1,
  education: 'postgraduate',
  hasProperty: true,
  properties: [
    {
      type: 'apartment',
      value: 3000000,
      description: 'Однокомнатная квартира в центре',
    },
    {
      type: 'car',
      value: 1500000,
      description: 'BMW X5 2020',
    },
  ],
  hasExistingLoans: true,
  existingLoans: [
    {
      bank: 'sberbank',
      amount: 500000,
      monthlyPayment: 15000,
      remainingTerm: 24,
    },
  ],
  hasCoBorrower: true,
  coBorrowers: [
    {
      personalData: {
        lastName: 'Петров',
        firstName: 'Сергей',
        middleName: 'Александрович',
        birthDate: '1983-08-10',
        gender: 'male',
        birthPlace: 'г. Санкт-Петербург',
      },
      monthlyIncome: 150000,
      relationship: 'Супруг',
    },
  ],

  // Step 6: Not pre-filled
  agreePersonalData: false,
  agreeCreditHistory: false,
  agreeMarketing: false,
  agreeTerms: false,
  confirmAccuracy: false,
  electronicSignature: '',
};

// ============================================================================
// Mock Data: Empty Application (new application)
// ============================================================================

export const MOCK_EMPTY_APPLICATION: Partial<CreditApplicationMock> = {
  loanType: 'consumer',
  loanAmount: 0,
  loanTerm: 0,
  loanPurpose: '',

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

  phoneMain: '',
  email: '',
  registrationAddress: {
    region: '',
    city: '',
    street: '',
    house: '',
    apartment: '',
    postalCode: '',
  },
  sameAsRegistration: true,

  employmentStatus: 'employed',
  workExperienceTotal: 0,
  workExperienceCurrent: 0,
  monthlyIncome: 0,

  maritalStatus: 'single',
  dependents: 0,
  education: 'secondary',
  hasProperty: false,
  hasExistingLoans: false,
  hasCoBorrower: false,
};

// ============================================================================
// Mock Data: Car Loan Application
// ============================================================================

export const MOCK_CAR_LOAN_APPLICATION: Partial<CreditApplicationMock> = {
  // Step 1: Basic info - Car loan
  loanType: 'car',
  loanAmount: 2500000,
  loanTerm: 60,
  loanPurpose: '',
  carBrand: 'Toyota',
  carModel: 'Camry',
  carYear: 2023,
  carPrice: 3000000,

  // Step 2: Personal data
  personalData: {
    lastName: 'Сидоров',
    firstName: 'Петр',
    middleName: 'Николаевич',
    birthDate: '1988-11-25',
    gender: 'male',
    birthPlace: 'г. Екатеринбург',
  },
  passportData: {
    series: '65 10',
    number: '789012',
    issueDate: '2018-12-01',
    issuedBy: 'ОВМ УМВД России по г. Екатеринбургу',
    departmentCode: '660-003',
  },
  inn: '667012345678',
  snils: '555-666-777 88',

  // Step 3: Contact info
  phoneMain: '+7 (912) 345-67-89',
  email: 'sidorov@example.com',
  registrationAddress: {
    region: 'Свердловская область',
    city: 'Екатеринбург',
    street: 'Ленина',
    house: '50',
    apartment: '100',
    postalCode: '620000',
  },
  sameAsRegistration: true,

  // Step 4: Employment
  employmentStatus: 'employed',
  companyName: 'АО Уральские заводы',
  companyInn: '6671234567',
  companyPhone: '+7 (343) 123-45-67',
  companyAddress: 'г. Екатеринбург, ул. Промышленная, д. 10',
  position: 'Инженер',
  workExperienceTotal: 96,
  workExperienceCurrent: 48,
  monthlyIncome: 120000,
  additionalIncome: 0,

  // Step 5: Additional info
  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  hasExistingLoans: false,
  hasCoBorrower: false,
};

// ============================================================================
// Utility: Get application by ID
// ============================================================================

export function getMockApplicationById(id: string): Partial<CreditApplicationMock> {
  switch (id) {
    case '1':
      return MOCK_CREDIT_APPLICATION_1;
    case '2':
      return MOCK_CREDIT_APPLICATION_2;
    case '3':
      return MOCK_CAR_LOAN_APPLICATION;
    default:
      return MOCK_EMPTY_APPLICATION;
  }
}
