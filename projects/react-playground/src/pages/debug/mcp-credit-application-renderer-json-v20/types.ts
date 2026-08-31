// types.ts — form type + field enums + option type + constant dictionaries.
// Reused as-is across core / renderer-react / renderer-json (target-agnostic).

/** Option shape for Select / RadioGroup data-sources. */
export type SelectOption = { value: string; label: string };

// ---- Field enums (string-literal unions) --------------------------------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

export type Gender = 'male' | 'female';

export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'garage';

export type FormMode = 'create' | 'edit' | 'view';

// ---- Nested sub-form shapes ---------------------------------------------

export type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
};

export type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

export type Address = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

// ---- Array-element shapes (use `type`, not `interface`) -----------------

export type Property = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
};

export type ExistingLoan = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

export type CoBorrowerPersonal = {
  lastName: string;
  firstName: string;
  middleName: string;
};

export type CoBorrower = {
  personalData: CoBorrowerPersonal;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

// ---- Root form type ------------------------------------------------------
// `type` (not `interface`) → satisfies FormWizard generic `T extends Record<string, any>`.

export type CreditApplicationForm = {
  // Step 1 — loan
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

  // Step 2 — personal
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3 — contacts
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  sameEmail: boolean;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Step 4 — employment
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

  // Step 5 — additional
  maritalStatus: MaritalStatus;
  dependents: number;
  education: Education;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6 — confirmation
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed (readonly, filled by behavior)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};
