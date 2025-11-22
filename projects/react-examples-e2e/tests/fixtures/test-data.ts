/**
 * Тестовые данные для E2E тестов формы заявки на кредит
 * Данные взяты из спецификации spec/test-cases-credit-form.md
 */

// ============================================================================
// Типы данных
// ============================================================================

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
  issuedBy: string;
  issuedDate: string;
  code: string;
}

export interface AddressData {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

export interface EmploymentData {
  status: 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
  companyName?: string;
  companyInn?: string;
  position?: string;
  monthlyIncome: number;
  additionalIncome?: number;
  workExperience: number;
  currentJobExperience: number;
}

export interface ConsumerLoanData {
  loanType: 'consumer';
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
}

export interface MortgageLoanData {
  loanType: 'mortgage';
  propertyValue: number;
  initialPayment: number;
  loanAmount: number;
  loanTerm: number;
}

export interface CarLoanData {
  loanType: 'car';
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;
  loanAmount: number;
  loanTerm: number;
}

// ============================================================================
// Данные для Happy Path тестов
// ============================================================================

/**
 * TC-HP-001: Потребительский кредит
 */
export const CONSUMER_LOAN_DATA: ConsumerLoanData = {
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Ремонт квартиры',
};

/**
 * TC-HP-002: Ипотека
 */
export const MORTGAGE_LOAN_DATA: MortgageLoanData = {
  loanType: 'mortgage',
  propertyValue: 5000000,
  initialPayment: 1000000, // 20%
  loanAmount: 4000000,
  loanTerm: 240,
};

/**
 * TC-HP-003: Автокредит
 */
export const CAR_LOAN_DATA: CarLoanData = {
  loanType: 'car',
  carBrand: 'Toyota',
  carModel: 'Camry',
  carYear: 2023,
  carPrice: 3000000,
  loanAmount: 2500000,
  loanTerm: 60,
};

// ============================================================================
// Персональные данные
// ============================================================================

export const VALID_PERSONAL_DATA: PersonalData = {
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: 'Иванович',
  birthDate: '1990-05-15',
  gender: 'male',
  birthPlace: 'г. Москва',
};

export const VALID_PASSPORT_DATA: PassportData = {
  series: '45 06',
  number: '123456',
  issuedBy: 'ОВД Центрального района г. Москвы',
  issuedDate: '2010-06-20',
  code: '770-001',
};

export const VALID_INN = '123456789012';
export const VALID_SNILS = '123-456-789 01';

// ============================================================================
// Контактные данные
// ============================================================================

export const VALID_PHONE = '+7 (999) 123-45-67';
export const VALID_EMAIL = 'ivanov@example.com';

export const VALID_ADDRESS: AddressData = {
  region: 'Московская область',
  city: 'Москва',
  street: 'Тверская',
  house: '1',
  apartment: '10',
  postalCode: '123456',
};

// ============================================================================
// Данные о занятости
// ============================================================================

export const EMPLOYED_DATA: EmploymentData = {
  status: 'employed',
  companyName: 'ООО Рога и Копыта',
  companyInn: '7707083893',
  position: 'Менеджер',
  monthlyIncome: 100000,
  additionalIncome: 20000,
  workExperience: 60,
  currentJobExperience: 24,
};

export const SELF_EMPLOYED_DATA: EmploymentData = {
  status: 'selfEmployed',
  monthlyIncome: 150000,
  workExperience: 48,
  currentJobExperience: 48,
};

export const UNEMPLOYED_DATA: EmploymentData = {
  status: 'unemployed',
  monthlyIncome: 30000, // Пособие/пассивный доход
  workExperience: 36,
  currentJobExperience: 0,
};

// ============================================================================
// Дополнительная информация
// ============================================================================

export const ADDITIONAL_INFO = {
  maritalStatus: 'married' as const,
  dependents: 2,
  education: 'higher' as const,
};

// ============================================================================
// Данные для валидации (невалидные значения)
// ============================================================================

export const INVALID_DATA = {
  // Сумма кредита
  loanAmountTooLow: 10000, // min: 50000
  loanAmountTooHigh: 15000000, // max: 10000000

  // Срок кредита
  loanTermTooShort: 3, // min: 6
  loanTermTooLong: 300, // max: 240

  // Цель кредита
  loanPurposeTooShort: 'Ремонт', // min: 10 символов

  // Email
  invalidEmail: 'invalid-email',

  // Телефон
  incompletePhone: '123',

  // ИНН
  incompleteInn: '12345',

  // СНИЛС
  incompleteSnils: '123-456',

  // Паспорт
  incompletePassportSeries: '12',
  incompletePassportCode: '123',

  // Доход
  incomeTooLow: 5000, // min: 10000

  // Дата рождения
  birthDateTooYoung: '2010-01-01', // < 18 лет
  birthDateTooOld: '1950-01-01', // > 70 лет
  birthDateFuture: '2030-01-01',

  // SMS код
  incompleteSmsCode: '123', // нужно 6 цифр
};

// ============================================================================
// Данные для кросс-валидации
// ============================================================================

export const CROSS_VALIDATION_DATA = {
  // Стаж на текущем месте > общего стажа
  currentJobExperienceGreaterThanTotal: {
    workExperience: 24,
    currentJobExperience: 36,
  },

  // Высокая долговая нагрузка (> 50%)
  highDebtBurden: {
    monthlyIncome: 100000,
    // Платеж будет > 50000
    loanAmount: 2000000,
    loanTerm: 24,
  },

  // Предупреждение при долговой нагрузке > 40%
  warningDebtBurden: {
    monthlyIncome: 100000,
    // Платеж будет ~45000
    loanAmount: 1000000,
    loanTerm: 24,
  },
};

// ============================================================================
// SMS коды
// ============================================================================

export const VALID_SMS_CODE = '123456';
export const INVALID_SMS_CODE = '000000';

// ============================================================================
// Полный набор данных для успешной отправки формы
// ============================================================================

export const COMPLETE_FORM_DATA = {
  loan: CONSUMER_LOAN_DATA,
  personal: VALID_PERSONAL_DATA,
  passport: VALID_PASSPORT_DATA,
  inn: VALID_INN,
  snils: VALID_SNILS,
  phone: VALID_PHONE,
  email: VALID_EMAIL,
  address: VALID_ADDRESS,
  employment: EMPLOYED_DATA,
  additional: ADDITIONAL_INFO,
  smsCode: VALID_SMS_CODE,
};
