import type { FormFields, FormValue } from '@reformer/core';

// ─── Address sub-form ───────────────────────────────────────────────────────

export interface AddressForm extends FormFields {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

// ─── PersonalData sub-form ──────────────────────────────────────────────────

export interface PersonalDataForm extends FormFields {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  birthPlace: string;
}

// ─── PassportData sub-form ──────────────────────────────────────────────────

export interface PassportDataForm extends FormFields {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

// ─── Step 5 array item types ────────────────────────────────────────────────

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
  personalData: PersonalDataForm;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

// ─── Step shapes ────────────────────────────────────────────────────────────

export interface Step1Form extends FormFields {
  loanType: string;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null;
  initialPayment: number | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;
}

export interface Step2Form extends FormFields {
  personalData: PersonalDataForm;
  passportData: PassportDataForm;
  inn: string;
  snils: string;
}

export interface Step3Form extends FormFields {
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: AddressForm;
  sameAsRegistration: boolean;
  residenceAddress: AddressForm;
}

export interface Step4Form extends FormFields {
  employmentStatus: string;
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
}

export interface Step5Form extends FormFields {
  maritalStatus: string;
  dependents: number;
  education: string;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];
}

export interface Step6Form extends FormFields {
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

// ─── Root form type ─────────────────────────────────────────────────────────

export interface CreditApplicationForm extends FormFields {
  step1: Step1Form;
  step2: Step2Form;
  step3: Step3Form;
  step4: Step4Form;
  step5: Step5Form;
  step6: Step6Form;
  // ── Computed root-level fields (stage 3b) ──────────────────────────────────
  interestRate: number;
  monthlyPayment: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  age: number;
  fullName: string;
  [key: string]: FormValue;
}
