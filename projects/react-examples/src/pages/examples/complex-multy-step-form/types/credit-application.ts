// ============================================================================
// Базовые типы
// ============================================================================

import type { Address } from '../components/nested-forms/Address/AddressForm';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/CoBorrowerForm';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/ExistingLoanForm';
import type { PassportData } from '../components/nested-forms/PassportData/PassportDataForm';
import type { PersonalData } from '../components/nested-forms/PersonalData/PersonalDataForm';
import type { Property } from '../components/nested-forms/Property/PropertyForm';

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

// ============================================================================
// Основной интерфейс формы
// ============================================================================

export interface CreditApplicationForm {
  // Шаг 1: Основная информация
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Специфичные поля для ипотеки
  propertyValue: number;
  initialPayment: number;

  // Специфичные поля для автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // Шаг 2: Персональные данные
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Шаг 3: Контактная информация
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Шаг 4: Информация о занятости
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
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // Шаг 5: Дополнительная информация
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Шаг 6: Согласия
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Вычисляемые поля (computed fields)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
  sameEmail: boolean;
}
