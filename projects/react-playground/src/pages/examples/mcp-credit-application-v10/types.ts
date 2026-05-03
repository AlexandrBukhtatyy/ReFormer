// =============================================================================
// types.ts — TypeScript model for the credit-application form (iter-10, core)
// =============================================================================
//
// Spec: docs/specs/credit-application-form.md
// Stack target: core (no RenderSchema). Pure TS-flow + manual React.
// =============================================================================

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car' | 'other';

// -----------------------------------------------------------------------------
// Nested forms
// -----------------------------------------------------------------------------

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

export type CoBorrower = {
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
};

// -----------------------------------------------------------------------------
// Root model
// -----------------------------------------------------------------------------

export type CreditApplicationFormV10 = {
  // Step 1 — Loan
  loanType: LoanType;
  loanAmount: number | undefined;
  loanTerm: number;
  loanPurpose: string;
  // Mortgage
  propertyValue: number | undefined;
  initialPayment: number | undefined;
  // Car loan
  carBrand: string;
  carModel: string;
  carYear: number | undefined;
  carPrice: number | undefined;

  // Step 2 — Personal & passport
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3 — Contacts
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Step 4 — Employment
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | undefined;
  workExperienceCurrent: number | undefined;
  monthlyIncome: number | undefined;
  additionalIncome: number | undefined;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // Step 5 — Additional
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6 — Confirmation
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed (read-only)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | undefined;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

// -----------------------------------------------------------------------------
// Constant option lists (used both in schema componentProps + reuse where needed)
// -----------------------------------------------------------------------------

export const LOAN_TYPE_OPTIONS: ReadonlyArray<{ value: LoanType; label: string }> = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_OPTIONS: ReadonlyArray<{ value: EmploymentStatus; label: string }> = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_OPTIONS: ReadonlyArray<{ value: MaritalStatus; label: string }> = [
  { value: 'single', label: 'Не женат / Не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'Разведён(а)' },
  { value: 'widowed', label: 'Вдовец / Вдова' },
];

export const EDUCATION_OPTIONS: ReadonlyArray<{ value: EducationLevel; label: string }> = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

export const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{ value: PropertyType; label: string }> = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Другое' },
];
