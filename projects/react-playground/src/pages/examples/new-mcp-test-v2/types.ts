/**
 * Тип формы «Заявка на кредит» + доменные константы.
 *
 * `type`, а не `interface` — constraint `T extends Record<string, any>` у
 * `FormWizard` требует structural-совместимости.
 */

export interface Option {
  value: string;
  label: string;
}

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type FormMode = 'create' | 'edit' | 'view';

export type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  birthPlace: string;
};

export type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

export type AddressData = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

export type PropertyItem = {
  type: string;
  description: string;
  estimatedValue: number | null;
  hasEncumbrance: boolean;
};

export type ExistingLoanItem = {
  bank: string;
  type: string;
  amount: number | null;
  remainingAmount: number | null;
  monthlyPayment: number | null;
  maturityDate: string;
};

export type CoBorrowerItem = {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number | null;
};

export type CreditApplicationForm = {
  /* --- Шаг 1: кредит --- */
  loanType: string;
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  propertyValue: number | null;
  /** C.3 — вычисляемое, readonly */
  initialPayment: number | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;
  /** C.1 — вычисляемое, readonly */
  interestRate: number | null;
  /** C.2 — вычисляемое, readonly */
  monthlyPayment: number | null;

  /* --- Шаг 2: персональные данные --- */
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;
  /** C.4 — вычисляемое, readonly */
  fullName: string;
  /** C.5 — вычисляемое, readonly */
  age: number | null;

  /* --- Шаг 3: контакты --- */
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  /**
   * Флага нет в таблице полей спеки, но таблица поведения ссылается на него
   * (3.4 «Копируется из основного при установке флага sameEmail»).
   */
  sameEmail: boolean;
  registrationAddress: AddressData;
  sameAsRegistration: boolean;
  residenceAddress: AddressData;

  /* --- Шаг 4: занятость --- */
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
  /** C.6 — вычисляемое, readonly */
  totalIncome: number | null;
  /** C.7 — вычисляемое, readonly */
  paymentToIncomeRatio: number | null;

  /* --- Шаг 5: дополнительно --- */
  maritalStatus: string;
  dependents: number | null;
  education: string;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];
  /** C.8 — вычисляемое, readonly */
  coBorrowersIncome: number | null;

  /* --- Шаг 6: подтверждение --- */
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
};

/** Селекторы шагов wizard-а: они же ключи `validation.steps`. */
export type StepSelector =
  | 'loan'
  | 'personal'
  | 'contacts'
  | 'employment'
  | 'additional'
  | 'confirm';

/* ------------------------------------------------------------------ */
/* Константные справочники                                            */
/* ------------------------------------------------------------------ */

export const LOAN_TYPES: Option[] = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

export const GENDERS: Option[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUSES: Option[] = [
  { value: 'employed', label: 'Работа по найму' },
  { value: 'selfEmployed', label: 'ИП / самозанятый' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUSES: Option[] = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

export const EDUCATION_LEVELS: Option[] = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Учёная степень' },
];

export const PROPERTY_TYPES: Option[] = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Иное' },
];

/** Базовая ставка по типу кредита (C.1). */
export const BASE_RATES: Record<string, number> = {
  consumer: 18.5,
  mortgage: 9.5,
  car: 13.5,
  business: 16,
  refinance: 14.5,
};

/** Регионы со сниженной ставкой (C.1 — «зависит от региона»). */
export const PREFERENTIAL_REGIONS = ['moscow', 'spb'];
