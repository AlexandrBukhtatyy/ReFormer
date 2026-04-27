import type { FormFields, FormValue } from '@reformer/core';

// ───── Sub-form interfaces (must satisfy FormFields = Record<string, FormValue>) ─────

export interface PersonalData extends FormFields {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  birthPlace: string;
}

export interface PassportData extends FormFields {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export interface Address extends FormFields {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

// ───── Array-item interfaces ─────

export interface Property extends FormFields {
  type: string;
  description: string;
  estimatedValue: number | null;
  hasEncumbrance: boolean;
}

export interface ExistingLoan extends FormFields {
  bank: string;
  type: string;
  amount: number | null;
  remainingAmount: number | null;
  monthlyPayment: number | null;
  maturityDate: string;
}

export interface CoBorrower extends FormFields {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number | null;
  [key: string]: FormValue;
}

// ───── Step groups ─────

export interface Step1Loan extends FormFields {
  loanType: string;
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  // Mortgage-only
  propertyValue: number | null;
  initialPayment: number | null;
  // Auto-only
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;
  // Computed
  interestRate: number | null;
  monthlyPayment: number | null;
}

export interface Step2Personal extends FormFields {
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  // Computed
  fullName: string;
  age: number | null;
}

export interface Step3Contacts extends FormFields {
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;
}

export interface Step4Employment extends FormFields {
  employmentStatus: string;
  // Employed
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  // Common
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  // Self-employed / business owner
  businessType: string;
  businessInn: string;
  businessActivity: string;
  // Computed
  totalIncome: number | null;
  paymentToIncomeRatio: number | null;
}

export interface Step5Additional extends FormFields {
  maritalStatus: string;
  dependents: number | null;
  education: string;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
  // Computed
  coBorrowersIncome: number | null;
}

export interface Step6Confirmation extends FormFields {
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

// ───── Root form ─────

export interface CreditApplicationForm extends FormFields {
  step1: Step1Loan;
  step2: Step2Personal;
  step3: Step3Contacts;
  step4: Step4Employment;
  step5: Step5Additional;
  step6: Step6Confirmation;
}
