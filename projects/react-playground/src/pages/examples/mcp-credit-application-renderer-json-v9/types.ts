/**
 * Типы для формы кредитной заявки.
 *
 * НЕТ `extends FormFields` на union-literal leaf-интерфейсах
 * (FormFields = Record<string, FormValue> с index-signature, который
 * расширяет union-литералы до `string` и ломает FormProxy<T>).
 */

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus =
  | 'employed'
  | 'selfEmployed'
  | 'unemployed'
  | 'retired'
  | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type Gender = 'male' | 'female';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car' | 'other';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: Gender;
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

export interface CoBorrowerPersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

export interface CoBorrower {
  personalData: CoBorrowerPersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export interface CreditApplicationForm {
  // ── Шаг 1: Кредит ────────────────────────────────────────────────────
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  // mortgage-specific
  propertyValue: number | null;
  initialPayment: number | null;
  // car-specific
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;

  // ── Шаг 2: Личные данные ─────────────────────────────────────────────
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // ── Шаг 3: Контакты ──────────────────────────────────────────────────
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // ── Шаг 4: Работа ────────────────────────────────────────────────────
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // ── Шаг 5: Доп. инфо ─────────────────────────────────────────────────
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // ── Шаг 6: Согласия + подпись ────────────────────────────────────────
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // ── Computed-поля (readonly, заполняются через computeFrom) ──────────
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
