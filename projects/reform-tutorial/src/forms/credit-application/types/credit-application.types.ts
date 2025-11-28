// Типы кредита
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

// Статус занятости
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

// Семейное положение
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

// Уровень образования
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

// Типы имущества
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'commercial' | 'other';

export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string; // Опциональное поле
  postalCode: string;
}

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}

export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export interface ExistingLoan {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export interface CoBorrower {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export interface CreditApplicationForm {
  // ============================================
  // Шаг 1: Основная информация о кредите
  // ============================================
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Поля для ипотеки
  propertyValue: number;
  initialPayment: number;

  // Поля для автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // ============================================
  // Шаг 2: Персональная информация
  // ============================================
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // ============================================
  // Шаг 3: Контактная информация
  // ============================================
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // ============================================
  // Шаг 4: Информация о занятости
  // ============================================
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome: number;
  additionalIncomeSource: string;

  // Поля для ИП
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // ============================================
  // Шаг 5: Дополнительная информация
  // ============================================
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;

  // Динамические массивы
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // ============================================
  // Шаг 6: Согласия
  // ============================================
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // ============================================
  // Вычисляемые поля
  // ============================================
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
