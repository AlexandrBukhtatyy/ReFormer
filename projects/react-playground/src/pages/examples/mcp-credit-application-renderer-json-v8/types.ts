/**
 * Types for credit-application form (iter-8, target=renderer-json).
 *
 * Critical (Patch C): leaf interfaces with union-literal fields do NOT extend
 * `FormFields` — that index signature widens unions back to `string` and
 * breaks `FormProxy<T>` typing.
 */

// ----------------------------------------------------------------------------
// Union literals
// ----------------------------------------------------------------------------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type Gender = 'male' | 'female';
export type PropertyKind = 'apartment' | 'house' | 'land' | 'commercial' | 'car' | 'other';
export type ExistingLoanKind = 'consumer' | 'mortgage' | 'car' | 'creditCard' | 'other';
export type Relationship = 'spouse' | 'parent' | 'child' | 'sibling' | 'relative' | 'other';

// ----------------------------------------------------------------------------
// Nested forms (no extends FormFields — keeps union literals narrow)
// ----------------------------------------------------------------------------

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
  type: PropertyKind;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export interface ExistingLoan {
  bank: string;
  type: ExistingLoanKind;
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
  relationship: Relationship;
  monthlyIncome: number;
}

// ----------------------------------------------------------------------------
// Root form
// ----------------------------------------------------------------------------

export interface CreditApplicationForm {
  // Step 1 — credit basics
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;

  // Step 1 — mortgage
  propertyValue: number | null;
  initialPayment: number | null;

  // Step 1 — car
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;

  // Step 2 — personal data
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3 — contacts
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
  sameEmail: boolean;

  // Step 4 — employment
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

  // Step 5 — additional info
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6 — confirmation
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
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
