// Loan types
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

// Employment status
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

// Marital status
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

// Education level
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

// Property types
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'commercial' | 'other';

// Address
export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
}

// Personal Data
export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}

// Passport Data
export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

// Property (for arrays)
export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

// Existing Loan (for arrays)
export interface ExistingLoan {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

// Co-Borrower (for arrays)
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

// Main Form Interface
export interface CreditApplicationForm {
  // ============================================
  // Step 1: Basic Loan Information
  // ============================================
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Mortgage-specific fields
  propertyValue: number;
  initialPayment: number;

  // Car loan-specific fields
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // ============================================
  // Step 2: Personal Information
  // ============================================
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // ============================================
  // Step 3: Contact Information
  // ============================================
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // ============================================
  // Step 4: Employment Information
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

  // Self-employed specific fields
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // ============================================
  // Step 5: Additional Information
  // ============================================
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;

  // Dynamic arrays
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // ============================================
  // Step 6: Confirmations
  // ============================================
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // ============================================
  // Computed Fields
  // ============================================
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
