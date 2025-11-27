import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup } from '@/components/ui/radio-group';
import type { CreditApplicationForm } from '@/types/credit-application.types';

// Import reusable schemas
import { addressSchema } from './address.schema';
import { personalDataSchema } from './personal-data.schema';
import { passportDataSchema } from './passport-data.schema';
import { propertySchema } from './property.schema';
import { existingLoanSchema } from './existing-loan.schema';
import { coBorrowerSchema } from './co-borrower.schema';

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ============================================================================
  // Step 1: Basic Loan Information
  // ============================================================================

  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Loan Type',
      options: [
        { value: 'consumer', label: 'Consumer Loan' },
        { value: 'mortgage', label: 'Mortgage' },
        { value: 'car', label: 'Car Loan' },
        { value: 'business', label: 'Business Loan' },
        { value: 'refinancing', label: 'Refinancing' },
      ],
    },
  },

  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Loan Amount', type: 'number', min: 50000, max: 10000000 },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Loan Term (months)', type: 'number', min: 6, max: 240 },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Loan Purpose', rows: 3 },
  },

  // Mortgage fields
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Property Value', type: 'number', min: 1000000 },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Initial Payment', type: 'number', min: 0 },
  },

  // Car loan fields
  carBrand: { value: '', component: Input, componentProps: { label: 'Car Brand' } },
  carModel: { value: '', component: Input, componentProps: { label: 'Car Model' } },
  carYear: { value: null, component: Input, componentProps: { label: 'Year', type: 'number' } },
  carPrice: { value: null, component: Input, componentProps: { label: 'Car Price', type: 'number' } },

  // ============================================================================
  // Step 2: Personal Information — USE REUSABLE SCHEMAS
  // ============================================================================

  personalData: personalDataSchema,
  passportData: passportDataSchema,

  inn: { value: '', component: Input, componentProps: { label: 'INN' } },
  snils: { value: '', component: Input, componentProps: { label: 'SNILS' } },

  // ============================================================================
  // Step 3: Contact Information
  // ============================================================================

  phoneMain: { value: '', component: Input, componentProps: { label: 'Main Phone' } },
  phoneAdditional: { value: '', component: Input, componentProps: { label: 'Additional Phone' } },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
  emailAdditional: { value: '', component: Input, componentProps: { label: 'Additional Email', type: 'email' } },

  registrationAddress: addressSchema,
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Residence address is the same as registration' },
  },
  residenceAddress: addressSchema,

  // ============================================================================
  // Step 4: Employment Information
  // ============================================================================

  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Employment Status',
      options: [
        { value: 'employed', label: 'Employed' },
        { value: 'selfEmployed', label: 'Self-Employed' },
        { value: 'unemployed', label: 'Unemployed' },
        { value: 'retired', label: 'Retired' },
        { value: 'student', label: 'Student' },
      ],
    },
  },

  companyName: { value: '', component: Input, componentProps: { label: 'Company Name' } },
  companyInn: { value: '', component: Input, componentProps: { label: 'Company INN' } },
  companyPhone: { value: '', component: Input, componentProps: { label: 'Company Phone' } },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Company Address' } },
  position: { value: '', component: Input, componentProps: { label: 'Position' } },
  workExperienceTotal: { value: null, component: Input, componentProps: { label: 'Total Experience (months)', type: 'number' } },
  workExperienceCurrent: { value: null, component: Input, componentProps: { label: 'Current Job (months)', type: 'number' } },
  monthlyIncome: { value: null, component: Input, componentProps: { label: 'Monthly Income', type: 'number' } },
  additionalIncome: { value: null, component: Input, componentProps: { label: 'Additional Income', type: 'number' } },
  additionalIncomeSource: { value: '', component: Input, componentProps: { label: 'Additional Income Source' } },
  businessType: { value: '', component: Input, componentProps: { label: 'Business Type' } },
  businessInn: { value: '', component: Input, componentProps: { label: 'Business INN' } },
  businessActivity: { value: '', component: Textarea, componentProps: { label: 'Business Activity', rows: 3 } },

  // ============================================================================
  // Step 5: Additional Information — ARRAYS USE REUSABLE SCHEMAS
  // ============================================================================

  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Marital Status',
      options: [
        { value: 'single', label: 'Single' },
        { value: 'married', label: 'Married' },
        { value: 'divorced', label: 'Divorced' },
        { value: 'widowed', label: 'Widowed' },
      ],
    },
  },

  dependents: { value: 0, component: Input, componentProps: { label: 'Dependents', type: 'number' } },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Education',
      options: [
        { value: 'secondary', label: 'Secondary' },
        { value: 'specialized', label: 'Specialized' },
        { value: 'higher', label: 'Higher' },
        { value: 'postgraduate', label: 'Postgraduate' },
      ],
    },
  },

  hasProperty: { value: false, component: Checkbox, componentProps: { label: 'I have property' } },
  properties: [propertySchema],

  hasExistingLoans: { value: false, component: Checkbox, componentProps: { label: 'I have existing loans' } },
  existingLoans: [existingLoanSchema],

  hasCoBorrower: { value: false, component: Checkbox, componentProps: { label: 'Add co-borrower' } },
  coBorrowers: [coBorrowerSchema],

  // ============================================================================
  // Step 6: Confirmations
  // ============================================================================

  agreePersonalData: { value: false, component: Checkbox, componentProps: { label: 'I agree to processing of personal data' } },
  agreeCreditHistory: { value: false, component: Checkbox, componentProps: { label: 'I agree to credit history check' } },
  agreeMarketing: { value: false, component: Checkbox, componentProps: { label: 'I agree to marketing materials' } },
  agreeTerms: { value: false, component: Checkbox, componentProps: { label: 'I agree to loan terms' } },
  confirmAccuracy: { value: false, component: Checkbox, componentProps: { label: 'I confirm accuracy' } },
  electronicSignature: { value: '', component: Input, componentProps: { label: 'SMS Code' } },

  // ============================================================================
  // Computed Fields
  // ============================================================================

  interestRate: { value: 0, component: Input, componentProps: { label: 'Interest Rate (%)', disabled: true } },
  monthlyPayment: { value: 0, component: Input, componentProps: { label: 'Monthly Payment', disabled: true } },
  fullName: { value: '', component: Input, componentProps: { label: 'Full Name', disabled: true } },
  age: { value: null, component: Input, componentProps: { label: 'Age', disabled: true } },
  totalIncome: { value: 0, component: Input, componentProps: { label: 'Total Income', disabled: true } },
  paymentToIncomeRatio: { value: 0, component: Input, componentProps: { label: 'Payment/Income (%)', disabled: true } },
  coBorrowersIncome: { value: 0, component: Input, componentProps: { label: 'Co-Borrowers Income', disabled: true } },
};
