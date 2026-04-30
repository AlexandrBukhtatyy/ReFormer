/**
 * Types for MCP Credit Application Renderer v10 (target=renderer-react)
 *
 * Plain interfaces; FormFields constraint flows structurally through createForm<T>.
 * NO `extends FormFields` on union-literal leaf interfaces (would widen literals to string).
 */

// ============================================================================
// Union literal types
// ============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type Gender = 'male' | 'female';
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'commercial' | 'other';

// ============================================================================
// Nested sub-form types
// ============================================================================

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

// ============================================================================
// Array item types
// ============================================================================

export interface PropertyItem {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export interface ExistingLoanItem {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export interface CoBorrowerPersonal {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

export interface CoBorrowerItem {
  personalData: CoBorrowerPersonal;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

// ============================================================================
// Root form interface
// ============================================================================

export interface CreditApplicationForm {
  // ----- Step 1: loan -----
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  // mortgage-conditional
  propertyValue: number | null;
  initialPayment: number | null;
  // car-conditional
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;

  // ----- Step 2: personal -----
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // ----- Step 3: contacts -----
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // ----- Step 4: employment -----
  employmentStatus: EmploymentStatus;
  // employed-conditional
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  // common
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  // selfEmployed-conditional
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // ----- Step 5: additional -----
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];

  // ----- Step 6: confirmations -----
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // ----- Computed fields (readOnly UI) -----
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
