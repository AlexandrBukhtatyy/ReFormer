/**
 * Credit application form (renderer-react v2 — page 2 of MCP-validation iter 2).
 * Field set mirrors page 1 of this iteration. See spec at
 * docs/specs/credit-application-form.md.
 */

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'car' | 'other';

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

export interface CoBorrower {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export interface Step1Loan {
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null;
  initialPayment: number | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
}

export interface Step2Personal {
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  fullName: string;
  age: number | null;
}

export interface Step3Contact {
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
}

export interface Step4Employment {
  employmentStatus: EmploymentStatus;
  companyName: string | null;
  companyInn: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  position: string | null;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string | null;
  businessType: string | null;
  businessInn: string | null;
  businessActivity: string | null;
  totalIncome: number | null;
  paymentToIncomeRatio: number | null;
}

export interface Step5Extra {
  maritalStatus: MaritalStatus;
  dependents: number;
  education: Education;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
  coBorrowersIncome: number | null;
}

export interface Step6Confirmation {
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

export interface CreditApplicationForm {
  step1: Step1Loan;
  step2: Step2Personal;
  step3: Step3Contact;
  step4: Step4Employment;
  step5: Step5Extra;
  step6: Step6Confirmation;
}
