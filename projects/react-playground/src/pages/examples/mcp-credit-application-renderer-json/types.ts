import type { FormFields, FormValue } from '@reformer/core';

// ── Nested interfaces ──────────────────────────────────────────────────────────

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

export interface AddressData extends FormFields {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

// ── FormArray item interfaces ──────────────────────────────────────────────────

export interface PropertyItem extends FormFields {
  type: string;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export interface ExistingLoanItem extends FormFields {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export interface CoBorrowerItem extends FormFields {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

// ── Step interfaces ────────────────────────────────────────────────────────────

export interface Step1 extends FormFields {
  loanType: string;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  // Mortgage-specific
  propertyValue: number | null;
  initialPayment: number | null;
  // Car-specific
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;
  // Computed
  interestRate: number | null;
  monthlyPayment: number | null;
}

export interface Step2 extends FormFields {
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  // Computed
  fullName: string;
  age: number | null;
}

export interface Step3 extends FormFields {
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: AddressData;
  sameAsRegistration: boolean;
  residenceAddress: AddressData;
}

export interface Step4 extends FormFields {
  employmentStatus: string;
  // Employed fields
  companyName: string | null;
  companyInn: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  position: string | null;
  // Work experience
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  // Income
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string | null;
  // Self-employed fields
  businessType: string | null;
  businessInn: string | null;
  businessActivity: string | null;
  // Computed
  totalIncome: number | null;
  paymentToIncomeRatio: number | null;
}

export interface Step5 extends FormFields {
  maritalStatus: string;
  dependents: number;
  education: string;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];
  // Computed
  coBorrowersIncome: number | null;
}

export interface Step6 extends FormFields {
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

// ── Root form interface ────────────────────────────────────────────────────────

export interface CreditApplicationForm extends FormFields {
  step1: Step1;
  step2: Step2;
  step3: Step3;
  step4: Step4;
  step5: Step5;
  step6: Step6;
  // ── Root-level computed fields (Сводка) ──────────────────────────────────
  interestRate: number;
  monthlyPayment: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  age: number;
  fullName: string;
  [key: string]: FormValue;
}
