import { createForm } from '@reformer/core';
import type { FormProxy } from '@reformer/core';
import { Input, Textarea, Select, Checkbox } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

// Noop placeholder — real component binding happens via the JSON registry.
// We still need a valid component reference to satisfy FieldConfig.
const Noop = Input;

// ── Address sub-schema factory ─────────────────────────────────────────────────

const addressSchema = () => ({
  region: { value: '', component: Input },
  city: { value: '', component: Input },
  street: { value: '', component: Input },
  house: { value: '', component: Input },
  apartment: { value: '', component: Input },
  postalCode: { value: '', component: Input },
});

// ── PersonalData sub-schema factory ───────────────────────────────────────────

const personalDataSchema = () => ({
  lastName: { value: '', component: Input },
  firstName: { value: '', component: Input },
  middleName: { value: '', component: Input },
  birthDate: { value: '', component: Input },
  gender: { value: 'male', component: Select },
  birthPlace: { value: '', component: Input },
});

// ── Property array item template ──────────────────────────────────────────────

const propertyItemSchema = {
  type: { value: 'apartment', component: Select },
  description: { value: '', component: Textarea },
  estimatedValue: { value: 0, component: Input },
  hasEncumbrance: { value: false, component: Checkbox },
};

// ── ExistingLoan array item template ──────────────────────────────────────────

const existingLoanItemSchema = {
  bank: { value: '', component: Input },
  type: { value: '', component: Input },
  amount: { value: 0, component: Input },
  remainingAmount: { value: 0, component: Input },
  monthlyPayment: { value: 0, component: Input },
  maturityDate: { value: '', component: Input },
};

// ── CoBorrower array item template ────────────────────────────────────────────

const coBorrowerItemSchema = {
  personalData: personalDataSchema(),
  phone: { value: '', component: Input },
  email: { value: '', component: Input },
  relationship: { value: '', component: Input },
  monthlyIncome: { value: 0, component: Input },
};

// ── Root form schema ──────────────────────────────────────────────────────────
// Cast pattern to avoid TS2589 (type instantiation excessively deep) on deeply
// nested schemas.

export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: { form: unknown }) => FormProxy<CreditApplicationForm>
)({
  form: {
    step1: {
      loanType: { value: 'consumer', component: Select },
      loanAmount: { value: null, component: Input },
      loanTerm: { value: 12, component: Input },
      loanPurpose: { value: '', component: Textarea },
      propertyValue: { value: null, component: Input },
      initialPayment: { value: null, component: Noop, disabled: true },
      carBrand: { value: null, component: Input },
      carModel: { value: null, component: Input },
      carYear: { value: null, component: Input },
      carPrice: { value: null, component: Input },
      interestRate: { value: null, component: Noop, disabled: true },
      monthlyPayment: { value: null, component: Noop, disabled: true },
    },
    step2: {
      personalData: personalDataSchema(),
      passportData: {
        series: { value: '', component: Input },
        number: { value: '', component: Input },
        issueDate: { value: '', component: Input },
        issuedBy: { value: '', component: Input },
        departmentCode: { value: '', component: Input },
      },
      inn: { value: '', component: Input },
      snils: { value: '', component: Input },
      fullName: { value: '', component: Noop, disabled: true },
      age: { value: null, component: Noop, disabled: true },
    },
    step3: {
      phoneMain: { value: '', component: Input },
      phoneAdditional: { value: null, component: Input },
      email: { value: '', component: Input },
      emailAdditional: { value: null, component: Input },
      registrationAddress: addressSchema(),
      sameAsRegistration: { value: true, component: Checkbox },
      residenceAddress: addressSchema(),
    },
    step4: {
      employmentStatus: { value: 'employed', component: Select },
      companyName: { value: null, component: Input },
      companyInn: { value: null, component: Input },
      companyPhone: { value: null, component: Input },
      companyAddress: { value: null, component: Input },
      position: { value: null, component: Input },
      workExperienceTotal: { value: null, component: Input },
      workExperienceCurrent: { value: null, component: Input },
      monthlyIncome: { value: null, component: Input },
      additionalIncome: { value: null, component: Input },
      additionalIncomeSource: { value: null, component: Input },
      businessType: { value: null, component: Input },
      businessInn: { value: null, component: Input },
      businessActivity: { value: null, component: Textarea },
      totalIncome: { value: null, component: Noop, disabled: true },
      paymentToIncomeRatio: { value: null, component: Noop, disabled: true },
    },
    step5: {
      maritalStatus: { value: 'single', component: Select },
      dependents: { value: 0, component: Input },
      education: { value: 'higher', component: Select },
      hasProperty: { value: false, component: Checkbox },
      properties: [propertyItemSchema],
      hasExistingLoans: { value: false, component: Checkbox },
      existingLoans: [existingLoanItemSchema],
      hasCoBorrower: { value: false, component: Checkbox },
      coBorrowers: [coBorrowerItemSchema],
      coBorrowersIncome: { value: null, component: Noop, disabled: true },
    },
    step6: {
      agreePersonalData: { value: false, component: Checkbox },
      agreeCreditHistory: { value: false, component: Checkbox },
      agreeMarketing: { value: false, component: Checkbox },
      agreeTerms: { value: false, component: Checkbox },
      confirmAccuracy: { value: false, component: Checkbox },
      electronicSignature: { value: '', component: Input },
    },
  },
});
