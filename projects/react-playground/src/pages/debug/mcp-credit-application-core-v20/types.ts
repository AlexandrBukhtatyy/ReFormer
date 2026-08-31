// types.ts — CreditApplication form type + nested groups + unions + option dictionaries.
// Все form-shape типы объявлены через `type` (не interface) для структурной совместимости
// с FormProxy<T>/ArrayNode<T> (Recipe 2 из type-safety-recipes).

export type Option<V extends string = string> = { value: V; label: string };

// --- Unions -----------------------------------------------------------------
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car';

// --- Nested groups ----------------------------------------------------------
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

// --- Array element types ----------------------------------------------------
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
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

// --- Root form --------------------------------------------------------------
export type CreditForm = {
  // Step 1 — loan
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  // mortgage-only
  propertyValue: number | null;
  initialPayment: number | null;
  // car-only
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

  // Computed (readonly)
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
};

export type FormMode = 'create' | 'edit' | 'view';

// --- Option dictionaries ----------------------------------------------------
export const LOAN_TYPE_OPTIONS: Option<LoanType>[] = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

export const GENDER_OPTIONS: Option<Gender>[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUS_OPTIONS: Option<EmploymentStatus>[] = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUS_OPTIONS: Option<MaritalStatus>[] = [
  { value: 'single', label: 'Холост / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

export const EDUCATION_OPTIONS: Option<Education>[] = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Учёная степень' },
];

export const PROPERTY_TYPE_OPTIONS: Option<PropertyType>[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
];

export const CURRENT_YEAR = new Date().getFullYear();
