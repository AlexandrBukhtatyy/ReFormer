// types.ts — form type + field enums + { value, label } option type + constant dictionaries
// MCP-only sandbox (iter-v20, target=renderer-react). Types as `type` aliases (never interface),
// per type-safety Recipe 2 (structural index-signature compatibility with FormProxy<T>).

export type Option<V extends string = string> = { value: V; label: string };

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'other';

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

export type PropertyItem = {
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

export type CreditApplicationForm = {
  // Step 1 — Основная информация о кредите
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;
  propertyValue: number | null; // conditional: mortgage
  carBrand: string | null; // conditional: car
  carModel: string | null; // conditional: car
  carYear: number | null; // conditional: car
  carPrice: number | null; // conditional: car

  // Step 2 — Персональные данные
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Step 3 — Контактная информация
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  sameEmail: boolean; // spec-implied control for emailAdditional copy
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address; // conditional: sameAsRegistration === false

  // Step 4 — Информация о занятости
  employmentStatus: EmploymentStatus;
  companyName: string | null; // conditional: employed
  companyInn: string | null; // conditional: employed
  companyPhone: string | null; // conditional: employed
  companyAddress: string | null; // conditional: employed
  position: string | null; // conditional: employed
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string | null;
  businessType: string | null; // conditional: selfEmployed
  businessInn: string | null; // conditional: selfEmployed
  businessActivity: string | null; // conditional: selfEmployed

  // Step 5 — Дополнительная информация
  maritalStatus: MaritalStatus;
  dependents: number;
  education: Education;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6 — Подтверждение и согласия
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // Computed (readonly)
  interestRate: number | null; // C.1
  monthlyPayment: number | null; // C.2
  initialPayment: number | null; // C.3 (20% of propertyValue)
  fullName: string; // C.4
  age: number | null; // C.5
  totalIncome: number | null; // C.6
  paymentToIncomeRatio: number | null; // C.7
  coBorrowersIncome: number | null; // C.8
};

// ── Option dictionaries ──────────────────────────────────────────────────────
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
  { value: 'other', label: 'Иное' },
];

export const CURRENT_YEAR = new Date().getFullYear();
export const MAX_CAR_YEAR = CURRENT_YEAR + 1;
