import type { FormFields } from '@reformer/core';

// ─── Address (reusable nested group) ───────────────────────────────────────

export interface AddressForm extends FormFields {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

// ─── Step 1: Основная информация о кредите ──────────────────────────────────

export interface Step1LoanInfo extends FormFields {
  loanType: string;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  // Mortgage-only fields
  propertyValue: number | null;
  initialPayment: number | null;
  // Car-only fields
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;
}

// ─── Step 2: Персональные данные ────────────────────────────────────────────

export interface PersonalDataForm extends FormFields {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  birthPlace: string;
}

export interface PassportDataForm extends FormFields {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export interface Step2PersonalData extends FormFields {
  personalData: PersonalDataForm;
  passportData: PassportDataForm;
  inn: string;
  snils: string;
}

// ─── Step 3: Контактная информация ──────────────────────────────────────────

export interface Step3ContactInfo extends FormFields {
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  registrationAddress: AddressForm;
  sameAsRegistration: boolean;
  residenceAddress: AddressForm;
}

// ─── Step 4: Информация о занятости ─────────────────────────────────────────

export interface Step4Employment extends FormFields {
  employmentStatus: string;
  // Employed fields
  companyName: string | null;
  companyInn: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  position: string | null;
  // Experience and income
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string | null;
  // Self-employed fields
  businessType: string | null;
  businessInn: string | null;
  businessActivity: string | null;
}

// ─── Step 5 array items ─────────────────────────────────────────────────────

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

// ─── Step 5: Дополнительная информация ──────────────────────────────────────

export interface Step5Additional extends FormFields {
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

// ─── Step 6: Подтверждение и согласия ───────────────────────────────────────

export interface Step6Confirmation extends FormFields {
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

// ─── Root form type ─────────────────────────────────────────────────────────

export interface CreditApplicationForm extends FormFields {
  step1: Step1LoanInfo;
  step2: Step2PersonalData;
  step3: Step3ContactInfo;
  step4: Step4Employment;
  step5: Step5Additional;
  step6: Step6Confirmation;

  // ── Stage 3b: computed root-level fields ──────────────────────────────────
  interestRate: number; // annual %, default 0
  monthlyPayment: number; // RUB, default 0
  totalIncome: number; // RUB, default 0
  paymentToIncomeRatio: number; // %, default 0
  age: number; // full years, default 0
  fullName: string; // default ''
}
