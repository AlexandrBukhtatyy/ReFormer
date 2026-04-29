/**
 * Types for the iter-9 credit-application form (renderer-react target).
 *
 * Note: leaf interfaces with union-literal fields (gender, loanType,
 * employmentStatus, …) intentionally do NOT `extends FormFields` —
 * `FormFields = Record<string, FormValue>` index signature would widen
 * the literal back to `string` and break the typed `FormProxy<T>`.
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
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'commercial' | 'other';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
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
  // Step 1 — основная информация о кредите
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  // Mortgage-specific
  propertyValue: number;
  initialPayment: number;
  // Car-loan-specific
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // Step 2 — персональные данные
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3 — контакты
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Step 4 — занятость
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

  // Step 5 — доп. информация / массивы
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6 — согласия и подпись
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed (readonly)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
