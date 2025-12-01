// Re-export типов из шагов
export type { LoanInfoStep } from './steps/loan-info/type';
export type { PersonalInfoStep } from './steps/personal-info/type';
export type { ContactInfoStep } from './steps/contact-info/type';
export type { EmploymentStep } from './steps/employment/type';
export type { AdditionalInfoStep } from './steps/additional-info/type';
export type { ConfirmationStep } from './steps/confirmation/type';

// Re-export типов из sub-forms
export type { Address } from './sub-forms/address/type';
export type { PersonalData } from './sub-forms/personal-data/type';
export type { PassportData } from './sub-forms/passport-data/type';
export type { Property, PropertyType } from './sub-forms/property/type';
export type { ExistingLoan } from './sub-forms/existing-loan/type';
export type { CoBorrower } from './sub-forms/co-borrower/type';

// Типы кредита
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

// Статус занятости
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

// Семейное положение
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

// Уровень образования
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

// Импорт типов из sub-forms для использования в интерфейсе
import type { Address } from './sub-forms/address/type';
import type { PersonalData } from './sub-forms/personal-data/type';
import type { PassportData } from './sub-forms/passport-data/type';
import type { Property } from './sub-forms/property/type';
import type { ExistingLoan } from './sub-forms/existing-loan/type';
import type { CoBorrower } from './sub-forms/co-borrower/type';

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
