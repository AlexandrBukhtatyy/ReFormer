// CreditApplicationForm — shared types for the renderer-json v2 page.

import type { FormValue } from '@reformer/core';

export type LoanType = 'consumer' | 'mortgage' | 'car' | '';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | '';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | '';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | '';
export type LoanStatus = 'active' | 'closed' | 'overdue' | '';
export type Relationship = 'spouse' | 'parent' | 'child' | 'sibling' | 'other' | '';

// `[key: string]: FormValue` is required so PropertyItem can be used as `T` in `ArrayNode<T>`,
// which constrains `T extends FormFields = Record<string, FormValue>`.
export interface PropertyItem {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  [key: string]: FormValue;
}

export interface ExistingLoanItem {
  bankName: string;
  loanType: string;
  remainingDebt: number;
  monthlyPayment: number;
  status: LoanStatus;
  [key: string]: FormValue;
}

export interface CoBorrowerItem {
  fullName: string;
  relationship: Relationship;
  monthlyIncome: number;
  passport: string;
  [key: string]: FormValue;
}

export interface CreditApplicationForm {
  // step 1 — loan parameters
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  // mortgage-only
  propertyValue: number;
  initialPayment: number;
  // car-only
  carBrand: string;
  carYear: number;
  // computed
  interestRate: number;
  monthlyPayment: number;

  // step 2 — personal data
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  passport: string;
  inn: string;
  maritalStatus: MaritalStatus;
  childrenCount: number;
  // computed
  fullName: string;
  age: number;

  // step 3 — employment
  employmentStatus: EmploymentStatus;
  // employed
  companyName: string;
  position: string;
  workExperience: number;
  monthlySalary: number;
  // selfEmployed
  businessType: string;
  monthlyRevenue: number;

  // step 4 — financial info
  additionalIncome: number;
  monthlyExpenses: number;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  // computed
  totalIncome: number;
  paymentToIncomeRatio: number;

  // step 5 — co-borrowers
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];
  // computed
  coBorrowersIncome: number;

  // step 6 — confirmation
  agreeToProcessData: boolean;
  agreeToCreditCheck: boolean;
  contactPhone: string;
  contactEmail: string;
}
