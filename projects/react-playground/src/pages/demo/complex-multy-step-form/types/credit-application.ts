import type { Address } from '../components/nested-forms/Address/types';
import type { CoBorrower } from '../components/nested-forms/CoBorrower/types';
import type { ExistingLoan } from '../components/nested-forms/ExistingLoan/types';
import type { PassportData } from '../components/nested-forms/PassportData/types';
import type { PersonalData } from '../components/nested-forms/PersonalData/types';
import type { Property } from '../components/nested-forms/Property/types';

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

/**
 * Ввод заявки — то, что заполняет пользователь и что уходит на сервер.
 *
 * Числовое поле ввода бывает пустым — тогда его значение `null`.
 */
export interface CreditApplication {
  // Шаг 1: Основная информация
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number;
  loanPurpose: string;

  // Ипотека
  propertyValue: number | null;
  /** Вводится пользователем; для ипотеки подставляется расчётом — 20 % стоимости. */
  initialPayment: number | null;

  // Автокредит
  carBrand: string;
  carModel: string;
  carYear: number | null;
  carPrice: number | null;

  // Шаг 2: Персональные данные
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Шаг 3: Контактная информация
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  /** Дополнительный email совпадает с основным. */
  sameEmail: boolean;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Шаг 4: Информация о занятости
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number | null;
  workExperienceCurrent: number | null;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  additionalIncomeSource: string;
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // Шаг 5: Дополнительная информация
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;
  /** Сканы документов: `File[]` уходит при отправке через FormData. */
  documents: File[] | null;
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Шаг 6: Согласия
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

/**
 * Вычисляемые поля заявки: значения пишет поведение (`compute`), пользователь их не вводит,
 * на сервер они не уходят (см. `application/payload.ts`).
 */
export interface CreditApplicationDerived {
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}

/** Значения формы заявки: ввод и вычисляемые поля — то, что держит модель. */
export type CreditApplicationForm = CreditApplication & CreditApplicationDerived;
