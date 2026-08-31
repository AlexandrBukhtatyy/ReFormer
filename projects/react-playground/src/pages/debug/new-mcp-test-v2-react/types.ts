/**
 * Типы формы «Заявка на кредит» (target: @reformer/renderer-react).
 *
 * Все формы-шейпы объявлены через `type`-alias, а НЕ через `interface`:
 * `Record<string, FormValue>` требует index signature, у `interface` её неявно нет,
 * и `FormProxy<T>` / `ArrayNode<T>` такой тип отвергнут.
 */

/** Опция для Select / RadioGroup. */
export type Option = {
  value: string;
  label: string;
};

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
export type PropertyType = 'apartment' | 'house' | 'land' | 'car' | 'other';

/** Режим формы: создание / редактирование / просмотр (все поля заблокированы). */
export type FormMode = 'create' | 'edit' | 'view';

/** Вложенная форма PersonalData (шаг 2, а также каждый созаёмщик шага 5). */
export type PersonalData = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
};

/** Вложенная форма PassportData (шаг 2). */
export type PassportData = {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
};

/** Вложенная форма Address — адрес регистрации и адрес проживания (шаг 3). */
export type AddressData = {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

/** Элемент массива properties (шаг 5). */
export type PropertyItem = {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
};

/** Элемент массива existingLoans (шаг 5). */
export type ExistingLoanItem = {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
};

/** Элемент массива coBorrowers (шаг 5) — с вложенной группой personalData. */
export type CoBorrowerItem = {
  personalData: PersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
};

/**
 * Корневой тип формы. Опциональные числа — `number | null` (конвенция «пользователь очистил
 * поле»); встроенные валидаторы `min`/`max`/`minLength`/… пропускают пустые значения сами.
 */
export type CreditApplicationForm = {
  // --- Шаг 1: основная информация о кредите ---
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  propertyValue: number | null;
  initialPayment: number | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carPrice: number | null;

  // --- Шаг 2: персональные данные ---
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // --- Шаг 3: контактная информация ---
  phoneMain: string;
  phoneAdditional: string | null;
  email: string;
  emailAdditional: string | null;
  /**
   * Флага нет в таблицах полей спеки, но таблица поведения требует
   * «email → emailAdditional, копирование, sameEmail=true» — без носителя условия
   * поведение невыразимо. Рендерится чекбоксом на шаге 3.
   */
  sameEmail: boolean;
  registrationAddress: AddressData;
  sameAsRegistration: boolean;
  residenceAddress: AddressData;

  // --- Шаг 4: информация о занятости ---
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

  // --- Шаг 5: дополнительная информация ---
  maritalStatus: MaritalStatus;
  dependents: number | null;
  education: EducationLevel;
  hasProperty: boolean;
  properties: PropertyItem[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoanItem[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrowerItem[];

  // --- Шаг 6: подтверждение и согласия ---
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // --- Вычисляемые поля (readonly, считаются в form.behavior.ts) ---
  interestRate: number | null;
  monthlyPayment: number | null;
  fullName: string;
  age: number | null;
  totalIncome: number | null;
  paymentToIncomeRatio: number | null;
  coBorrowersIncome: number | null;
};

/** Максимальный год выпуска автомобиля — текущий + 1. */
export const CAR_YEAR_MAX = new Date().getFullYear() + 1;

/** Минимальный год выпуска автомобиля. */
export const CAR_YEAR_MIN = 2000;

/** Возрастные границы заёмщика. */
export const BORROWER_MIN_AGE = 18;
export const BORROWER_MAX_AGE = 70;

/** Доля первоначального взноса от стоимости недвижимости. */
export const INITIAL_PAYMENT_SHARE = 0.2;

/** Порог блокирующей долговой нагрузки, %. */
export const PAYMENT_TO_INCOME_LIMIT = 50;

/** Порог предупреждения о долговой нагрузке, %. */
export const PAYMENT_TO_INCOME_WARNING = 40;

/** Максимальная сумма кредита — не более N годовых доходов. */
export const MAX_INCOME_YEARS = 10;

/** Базовые ставки по типу кредита, % годовых. */
export const BASE_INTEREST_RATE: Record<LoanType, number> = {
  consumer: 18,
  mortgage: 9.5,
  car: 12,
  business: 15,
  refinance: 13,
};

/** Регионы с пониженной ставкой (крупные рынки). */
export const PREFERRED_REGIONS: readonly string[] = ['moscow', 'spb'];
