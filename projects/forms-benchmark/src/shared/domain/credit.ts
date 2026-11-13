/**
 * Предметная часть кредитной заявки (docs/specs/credit-application-form.md + BENCH-CONTRACT §8),
 * общая для всех реализаций: типы значений, начальные значения и фабрики строк, опции, метаданные
 * полей (подпись, контрол, маска), шаги визарда, условия видимости, вычисляемые поля C.1–C.8,
 * константы правил и канонический payload.
 *
 * Правила валидации каждая реализация выражает средствами своей библиотеки. Здесь — только числа,
 * выражения и предикаты, которые задаёт спека; порядок правил поля — порядок ключей в
 * `messages/credit.ts`.
 *
 * Модуль чистый (без DOM, React и API): его импортирует и e2e (pom/credit.ts).
 *
 * Решения там, где спека открыта:
 * - Строковые поля в состоянии формы — всегда строка: `''` вместо `null` из столбца «Значение»
 *   (нативный input не различает null и ''). Числовые — `number | null`, пустой ввод — `null`.
 * - «Условное» поле = видно и обязательно только при условии; скрытое не валидируется и
 *   сбрасывается к начальному значению (CREDIT_VISIBILITY).
 * - Возраст 18–70 — правило поля `personalData.birthDate` (его вводит пользователь); доля платежа
 *   ≤ 50 % — правило `monthlyIncome`; сумма ≤ стоимость − взнос — правило `loanAmount`.
 * - Первоначальный взнос вычисляемый (C.3, только чтение) и округляется ВВЕРХ до рубля, поэтому
 *   «взнос ≥ 20 %» (1.6) выполняется по построению — отдельного правила нет.
 * - Вычисляемые поля в payload входят, но считает их нормализатор из ввода (одна функция на всех).
 */

/** Опция Select/RadioGroup. Совпадает по форме с `SelectOption` из `ui/controls`. */
export interface Option {
  value: string;
  label: string;
}

// ── Фиксированные часы бенча (BENCH-CONTRACT §5) ─────────────────────────────
/** «Сегодня» для возраста и `carYear.max`. */
export const BENCH_TODAY = '2026-06-15';
export const CURRENT_YEAR = 2026;

// ── Типы значений ────────────────────────────────────────────────────────────
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';
export type Gender = 'male' | 'female';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Education = 'secondary' | 'specialized' | 'higher' | 'postgraduate';
/** Значения справочника `propertyTypes` (`getDictionaries()`). */
export type PropertyType = 'apartment' | 'house' | 'car' | 'land';

export interface CreditPersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  /** `YYYY-MM-DD` или `''` — значение `input type="date"`. */
  birthDate: string;
  gender: Gender;
  birthPlace: string;
}

export interface CreditPassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export interface CreditAddress {
  /** Значение из `getRegions()`. */
  region: string;
  /** Значение из `getCities(region)`. */
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
}

export interface CreditProperty {
  type: PropertyType | '';
  description: string;
  estimatedValue: number | null;
  hasEncumbrance: boolean;
}

export interface CreditExistingLoan {
  bank: string;
  type: string;
  amount: number | null;
  remainingAmount: number | null;
  monthlyPayment: number | null;
  maturityDate: string;
}

/** Личные данные созаёмщика — ФИО и дата рождения (как в эталонном демо). */
export interface CreditCoBorrowerPersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

export interface CreditCoBorrower {
  personalData: CreditCoBorrowerPersonalData;
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number | null;
}

/** Ввод заявки: ключи таблиц шагов 1–6 спеки (кроме вычисляемого `initialPayment`) + `sameEmail`. */
export interface CreditInput {
  // Шаг 1
  /** `''` — выбрана пустая опция Select (ошибка «обязательно»). */
  loanType: LoanType | '';
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  propertyValue: number | null;
  carBrand: string;
  /** Значение из `getCarModels(carBrand)`. */
  carModel: string;
  carYear: number | null;
  carPrice: number | null;
  // Шаг 2
  personalData: CreditPersonalData;
  passportData: CreditPassportData;
  inn: string;
  snils: string;
  // Шаг 3
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  /** Чекбокс шага 3 (BENCH-CONTRACT §8): `emailAdditional` — копия `email`, только чтение. */
  sameEmail: boolean;
  emailAdditional: string;
  registrationAddress: CreditAddress;
  sameAsRegistration: boolean;
  residenceAddress: CreditAddress;
  // Шаг 4
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
  // Шаг 5
  maritalStatus: MaritalStatus;
  dependents: number | null;
  education: Education | '';
  hasProperty: boolean;
  properties: CreditProperty[];
  hasExistingLoans: boolean;
  existingLoans: CreditExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CreditCoBorrower[];
  // Шаг 6
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;
}

/** Вычисляемые поля C.1–C.8 — только чтение (`computed-{path}`). */
export interface CreditComputed {
  interestRate: number;
  monthlyPayment: number;
  /** `null` — не ипотека или стоимость не введена. */
  initialPayment: number | null;
  fullName: string;
  /** `null` — дата рождения не введена. */
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}

/** Все значения формы: ввод + вычисляемые (как держат их ReFormer, Formik `setFieldValue`, RHF `setValue`). */
export type CreditValues = CreditInput & CreditComputed;

/** Тело `POST /api/v1/credit-applications` — результат `toCreditPayload`. */
export type CreditPayload = CreditValues;

// ── Фабрики и начальные значения ─────────────────────────────────────────────
export const emptyAddress = (): CreditAddress => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

/** Строка `properties` (5.5–5.8). */
export const emptyProperty = (): CreditProperty => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

/** Строка `existingLoans` (5.10–5.15). */
export const emptyExistingLoan = (): CreditExistingLoan => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

/** Строка `coBorrowers` (5.17–5.21). */
export const emptyCoBorrower = (): CreditCoBorrower => ({
  personalData: { lastName: '', firstName: '', middleName: '', birthDate: '' },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

/** Начальный ввод (столбец «Значение» спеки). Не мутировать: нужна копия — `structuredClone`. */
export const CREDIT_INITIAL_INPUT: CreditInput = {
  loanType: 'consumer',
  loanAmount: null,
  loanTerm: 12,
  loanPurpose: '',
  propertyValue: null,
  carBrand: '',
  carModel: '',
  carYear: null,
  carPrice: null,

  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  passportData: { series: '', number: '', issueDate: '', issuedBy: '', departmentCode: '' },
  inn: '',
  snils: '',

  phoneMain: '',
  phoneAdditional: '',
  email: '',
  sameEmail: false,
  emailAdditional: '',
  registrationAddress: emptyAddress(),
  sameAsRegistration: true,
  residenceAddress: emptyAddress(),

  employmentStatus: 'employed',
  companyName: '',
  companyInn: '',
  companyPhone: '',
  companyAddress: '',
  position: '',
  workExperienceTotal: null,
  workExperienceCurrent: null,
  monthlyIncome: null,
  additionalIncome: null,
  additionalIncomeSource: '',
  businessType: '',
  businessInn: '',
  businessActivity: '',

  maritalStatus: 'single',
  dependents: 0,
  education: 'higher',
  hasProperty: false,
  properties: [],
  hasExistingLoans: false,
  existingLoans: [],
  hasCoBorrower: false,
  coBorrowers: [],

  agreePersonalData: false,
  agreeCreditHistory: false,
  agreeMarketing: false,
  agreeTerms: false,
  confirmAccuracy: false,
  electronicSignature: '',
};

// ── Константы правил ─────────────────────────────────────────────────────────
export const LOAN_AMOUNT_MIN = 50_000;
export const LOAN_AMOUNT_MAX = 10_000_000;
export const LOAN_TERM_MIN = 6;
export const LOAN_TERM_MAX = 240;
export const LOAN_PURPOSE_MIN_LENGTH = 10;
export const LOAN_PURPOSE_MAX_LENGTH = 500;
export const PROPERTY_VALUE_MIN = 1_000_000;
/** Первоначальный взнос — 20 % стоимости недвижимости (1.6, C.3). */
export const INITIAL_PAYMENT_PERCENT = 20;
export const CAR_BRAND_MIN_LENGTH = 2;
export const CAR_BRAND_MAX_LENGTH = 50;
/** `minLength: 1` спеки совпадает с «обязательно» — отдельного правила нет. */
export const CAR_MODEL_MAX_LENGTH = 50;
export const CAR_YEAR_MIN = 2000;
/** Текущий год + 1 — по часам бенча. */
export const CAR_YEAR_MAX = CURRENT_YEAR + 1;
export const CAR_PRICE_MIN = 300_000;
export const CAR_PRICE_MAX = 10_000_000;
export const AGE_MIN = 18;
export const AGE_MAX = 70;
/** Стаж (мес.), доп. доход, иждивенцы и все суммы строк массивов — не меньше нуля. */
export const NON_NEGATIVE_MIN = 0;
export const MONTHLY_INCOME_MIN = 10_000;
/** Платёж не больше 50 % дохода; сравнивается округлённое значение C.7. */
export const PAYMENT_TO_INCOME_MAX = 50;
export const DEPENDENTS_MAX = 10;
export const SMS_CODE_LENGTH = 6;

// ── Маски (общий MaskedInput: `9` — цифра, остальное — литерал) ──────────────
export const MASKS = {
  phone: '+7 (999) 999-99-99',
  passportSeries: '99 99',
  passportNumber: '999999',
  departmentCode: '999-999',
  /** ИНН физлица и ИП — 12 цифр. */
  inn12: '999999999999',
  /** ИНН компании — 10 цифр. */
  inn10: '9999999999',
  snils: '999-999-999 99',
  postalCode: '999999',
  smsCode: '999999',
} as const;

/**
 * Полное совпадение с маской — правило `pattern` каждого маскированного поля (частично введённое
 * значение не принимается). `.source` годится для JSON Schema `pattern`.
 */
export function maskPattern(mask: string): RegExp {
  const body = mask.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/9/g, '\\d');
  return new RegExp(`^${body}$`);
}

// ── Опции (статические; справочники — в API) ─────────────────────────────────
export const LOAN_TYPES: readonly Option[] = [
  { value: 'consumer', label: 'Потребительский кредит' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'car', label: 'Автокредит' },
  { value: 'business', label: 'Кредит для бизнеса' },
  { value: 'refinancing', label: 'Рефинансирование' },
];

export const GENDERS: readonly Option[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

export const EMPLOYMENT_STATUSES: readonly Option[] = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Индивидуальный предприниматель' },
  { value: 'unemployed', label: 'Не работаю' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

export const MARITAL_STATUSES: readonly Option[] = [
  { value: 'single', label: 'Холост/не замужем' },
  { value: 'married', label: 'Женат/замужем' },
  { value: 'divorced', label: 'Разведен(а)' },
  { value: 'widowed', label: 'Вдовец/вдова' },
];

export const EDUCATIONS: readonly Option[] = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

// ── Метаданные полей ─────────────────────────────────────────────────────────
/**
 * Контрол поля → общий примитив `ui/controls`: text/email → TextInput (`type="email"`),
 * textarea → Textarea, number → NumberInput, date → DateInput, masked → MaskedInput, select →
 * Select, radio → RadioGroup, checkbox → Checkbox (подпись справа, `FieldFrame inline`).
 */
export type ControlKind =
  | 'text'
  | 'email'
  | 'textarea'
  | 'number'
  | 'date'
  | 'masked'
  | 'select'
  | 'radio'
  | 'checkbox';

export interface FieldMeta {
  label: string;
  control: ControlKind;
  placeholder?: string;
  mask?: string;
  /** Статические опции; у Select без `options` они приходят из API (см. `optionsFrom`). */
  options?: readonly Option[];
  /** Источник опций динамического Select. */
  optionsFrom?: 'regions' | 'cities' | 'carModels' | 'propertyTypes';
  /** Только чтение при условии (копия): `emailAdditional` при `sameEmail`. */
  readOnlyWhen?: 'sameEmail';
}

const PHONE_PLACEHOLDER = '+7 (___) ___-__-__';
const EMAIL_PLACEHOLDER = 'example@mail.com';

const ADDRESS_FIELDS = {
  region: {
    label: 'Регион',
    control: 'select',
    placeholder: 'Выберите регион',
    optionsFrom: 'regions',
  },
  city: { label: 'Город', control: 'select', placeholder: 'Выберите город', optionsFrom: 'cities' },
  street: { label: 'Улица', control: 'text', placeholder: 'Введите улицу' },
  house: { label: 'Дом', control: 'text', placeholder: '№' },
  apartment: { label: 'Квартира', control: 'text', placeholder: '№' },
  postalCode: { label: 'Индекс', control: 'masked', placeholder: '000000', mask: MASKS.postalCode },
} as const satisfies Record<keyof CreditAddress, FieldMeta>;

type Prefixed<P extends string, T> = { [K in keyof T & string as `${P}.${K}`]: T[K] };

function prefixed<P extends string, T extends Record<string, FieldMeta>>(prefix: P, fields: T) {
  const out: Record<string, FieldMeta> = {};
  for (const [k, meta] of Object.entries(fields)) out[`${prefix}.${k}`] = meta;
  return out as Prefixed<P, T>;
}

/**
 * Поле по пути-шаблону: вложенные — через точку, строки массивов — `[]`
 * (`coBorrowers[].personalData.lastName`). Порядок ключей — порядок на экране.
 */
export const CREDIT_FIELDS = {
  // Шаг 1
  loanType: {
    label: 'Тип кредита',
    control: 'select',
    placeholder: 'Выберите тип кредита',
    options: LOAN_TYPES,
  },
  loanAmount: { label: 'Сумма кредита (₽)', control: 'number', placeholder: 'Введите сумму' },
  loanTerm: { label: 'Срок кредита (месяцев)', control: 'number', placeholder: 'Введите срок' },
  loanPurpose: {
    label: 'Цель кредита',
    control: 'textarea',
    placeholder: 'Опишите, на что планируете потратить средства',
  },
  propertyValue: {
    label: 'Стоимость недвижимости (₽)',
    control: 'number',
    placeholder: 'Введите стоимость',
  },
  carBrand: { label: 'Марка автомобиля', control: 'text', placeholder: 'Например: Toyota' },
  carModel: {
    label: 'Модель автомобиля',
    control: 'select',
    placeholder: 'Выберите модель',
    optionsFrom: 'carModels',
  },
  carYear: { label: 'Год выпуска', control: 'number', placeholder: '2020' },
  carPrice: {
    label: 'Стоимость автомобиля (₽)',
    control: 'number',
    placeholder: 'Введите стоимость',
  },
  // Шаг 2
  'personalData.lastName': { label: 'Фамилия', control: 'text', placeholder: 'Введите фамилию' },
  'personalData.firstName': { label: 'Имя', control: 'text', placeholder: 'Введите имя' },
  'personalData.middleName': {
    label: 'Отчество',
    control: 'text',
    placeholder: 'Введите отчество',
  },
  'personalData.birthDate': { label: 'Дата рождения', control: 'date' },
  'personalData.gender': { label: 'Пол', control: 'radio', options: GENDERS },
  'personalData.birthPlace': {
    label: 'Место рождения',
    control: 'text',
    placeholder: 'Введите место рождения',
  },
  'passportData.series': {
    label: 'Серия паспорта',
    control: 'masked',
    placeholder: '12 34',
    mask: MASKS.passportSeries,
  },
  'passportData.number': {
    label: 'Номер паспорта',
    control: 'masked',
    placeholder: '123456',
    mask: MASKS.passportNumber,
  },
  'passportData.issueDate': { label: 'Дата выдачи', control: 'date' },
  'passportData.issuedBy': {
    label: 'Кем выдан',
    control: 'text',
    placeholder: 'Введите название органа',
  },
  'passportData.departmentCode': {
    label: 'Код подразделения',
    control: 'masked',
    placeholder: '123-456',
    mask: MASKS.departmentCode,
  },
  inn: { label: 'ИНН', control: 'masked', placeholder: '123456789012', mask: MASKS.inn12 },
  snils: { label: 'СНИЛС', control: 'masked', placeholder: '123-456-789 00', mask: MASKS.snils },
  // Шаг 3
  phoneMain: {
    label: 'Основной телефон',
    control: 'masked',
    placeholder: PHONE_PLACEHOLDER,
    mask: MASKS.phone,
  },
  phoneAdditional: {
    label: 'Дополнительный телефон',
    control: 'masked',
    placeholder: PHONE_PLACEHOLDER,
    mask: MASKS.phone,
  },
  email: { label: 'Email', control: 'email', placeholder: EMAIL_PLACEHOLDER },
  sameEmail: { label: 'Дополнительный email совпадает с основным', control: 'checkbox' },
  emailAdditional: {
    label: 'Дополнительный email',
    control: 'email',
    placeholder: EMAIL_PLACEHOLDER,
    readOnlyWhen: 'sameEmail',
  },
  ...prefixed('registrationAddress', ADDRESS_FIELDS),
  sameAsRegistration: {
    label: 'Адрес проживания совпадает с адресом регистрации',
    control: 'checkbox',
  },
  ...prefixed('residenceAddress', ADDRESS_FIELDS),
  // Шаг 4
  employmentStatus: { label: 'Статус занятости', control: 'radio', options: EMPLOYMENT_STATUSES },
  companyName: { label: 'Название компании', control: 'text', placeholder: 'Введите название' },
  companyInn: {
    label: 'ИНН компании',
    control: 'masked',
    placeholder: '1234567890',
    mask: MASKS.inn10,
  },
  companyPhone: {
    label: 'Телефон компании',
    control: 'masked',
    placeholder: PHONE_PLACEHOLDER,
    mask: MASKS.phone,
  },
  companyAddress: { label: 'Адрес компании', control: 'text', placeholder: 'Полный адрес' },
  position: { label: 'Должность', control: 'text', placeholder: 'Ваша должность' },
  businessType: { label: 'Тип бизнеса', control: 'text', placeholder: 'ИП, ООО и т.д.' },
  businessInn: {
    label: 'ИНН ИП',
    control: 'masked',
    placeholder: '123456789012',
    mask: MASKS.inn12,
  },
  businessActivity: {
    label: 'Вид деятельности',
    control: 'textarea',
    placeholder: 'Опишите вид деятельности',
  },
  workExperienceTotal: {
    label: 'Общий стаж работы (месяцев)',
    control: 'number',
    placeholder: '0',
  },
  workExperienceCurrent: {
    label: 'Стаж на текущем месте (месяцев)',
    control: 'number',
    placeholder: '0',
  },
  monthlyIncome: { label: 'Ежемесячный доход (₽)', control: 'number', placeholder: '0' },
  additionalIncome: { label: 'Дополнительный доход (₽)', control: 'number', placeholder: '0' },
  additionalIncomeSource: {
    label: 'Источник дополнительного дохода',
    control: 'text',
    placeholder: 'Опишите источник',
  },
  // Шаг 5
  maritalStatus: { label: 'Семейное положение', control: 'radio', options: MARITAL_STATUSES },
  dependents: { label: 'Количество иждивенцев', control: 'number', placeholder: '0' },
  education: {
    label: 'Образование',
    control: 'select',
    placeholder: 'Выберите уровень образования',
    options: EDUCATIONS,
  },
  hasProperty: { label: 'У меня есть имущество', control: 'checkbox' },
  'properties[].type': {
    label: 'Тип имущества',
    control: 'select',
    placeholder: 'Выберите тип',
    optionsFrom: 'propertyTypes',
  },
  'properties[].description': {
    label: 'Описание',
    control: 'textarea',
    placeholder: 'Опишите имущество',
  },
  'properties[].estimatedValue': {
    label: 'Оценочная стоимость',
    control: 'number',
    placeholder: '0',
  },
  'properties[].hasEncumbrance': { label: 'Имеется обременение (залог)', control: 'checkbox' },
  hasExistingLoans: { label: 'У меня есть другие кредиты', control: 'checkbox' },
  'existingLoans[].bank': { label: 'Банк', control: 'text', placeholder: 'Название банка' },
  'existingLoans[].type': { label: 'Тип кредита', control: 'text', placeholder: 'Тип кредита' },
  'existingLoans[].amount': { label: 'Сумма кредита', control: 'number', placeholder: '0' },
  'existingLoans[].remainingAmount': {
    label: 'Остаток задолженности',
    control: 'number',
    placeholder: '0',
  },
  'existingLoans[].monthlyPayment': {
    label: 'Ежемесячный платеж',
    control: 'number',
    placeholder: '0',
  },
  'existingLoans[].maturityDate': { label: 'Дата погашения', control: 'date' },
  hasCoBorrower: { label: 'Добавить созаемщика', control: 'checkbox' },
  'coBorrowers[].personalData.lastName': {
    label: 'Фамилия',
    control: 'text',
    placeholder: 'Введите фамилию',
  },
  'coBorrowers[].personalData.firstName': {
    label: 'Имя',
    control: 'text',
    placeholder: 'Введите имя',
  },
  'coBorrowers[].personalData.middleName': {
    label: 'Отчество',
    control: 'text',
    placeholder: 'Введите отчество',
  },
  'coBorrowers[].personalData.birthDate': { label: 'Дата рождения', control: 'date' },
  'coBorrowers[].phone': {
    label: 'Телефон',
    control: 'masked',
    placeholder: PHONE_PLACEHOLDER,
    mask: MASKS.phone,
  },
  'coBorrowers[].email': { label: 'Email', control: 'email', placeholder: EMAIL_PLACEHOLDER },
  'coBorrowers[].relationship': {
    label: 'Родство',
    control: 'text',
    placeholder: 'Укажите родство',
  },
  'coBorrowers[].monthlyIncome': {
    label: 'Ежемесячный доход',
    control: 'number',
    placeholder: '0',
  },
  // Шаг 6
  agreePersonalData: { label: 'Согласие на обработку персональных данных', control: 'checkbox' },
  agreeCreditHistory: { label: 'Согласие на проверку кредитной истории', control: 'checkbox' },
  agreeMarketing: { label: 'Согласие на получение маркетинговых материалов', control: 'checkbox' },
  agreeTerms: { label: 'Согласие с условиями кредитования', control: 'checkbox' },
  confirmAccuracy: { label: 'Подтверждаю точность введенных данных', control: 'checkbox' },
  electronicSignature: {
    label: 'Код подтверждения из СМС',
    control: 'masked',
    placeholder: '123456',
    mask: MASKS.smsCode,
  },
} as const satisfies Record<string, FieldMeta>;

export type CreditFieldPath = keyof typeof CREDIT_FIELDS;

/** Подписи вычисляемых полей (`ReadonlyValue`). */
export const COMPUTED_LABELS: Record<keyof CreditComputed, string> = {
  interestRate: 'Процентная ставка (%)',
  monthlyPayment: 'Ежемесячный платеж (₽)',
  initialPayment: 'Первоначальный взнос (₽)',
  fullName: 'Полное имя',
  age: 'Возраст (лет)',
  totalIncome: 'Общий доход (₽)',
  paymentToIncomeRatio: 'Процент платежа от дохода (%)',
  coBorrowersIncome: 'Доход созаемщиков (₽)',
};

/** Заголовки секций (`Section`) — разметка шагов, см. baseline/credit/CreditForm.tsx. */
export const SECTION_TITLES = {
  mortgage: 'Ипотека',
  car: 'Автокредит',
  calculation: 'Расчёт',
  personalData: 'Личные данные',
  passportData: 'Паспортные данные',
  registrationAddress: 'Адрес регистрации',
  residenceAddress: 'Адрес проживания',
  employer: 'Работа по найму',
  business: 'ИП',
  income: 'Доход',
} as const;

/** Массивы шага 5: флаг, заголовки, фабрика пустой строки. */
export const CREDIT_ARRAYS = {
  properties: {
    flag: 'hasProperty',
    title: 'Имущество',
    rowTitle: 'Объект',
    addLabel: 'Добавить имущество',
    empty: emptyProperty,
  },
  existingLoans: {
    flag: 'hasExistingLoans',
    title: 'Существующие кредиты',
    rowTitle: 'Кредит',
    addLabel: 'Добавить кредит',
    empty: emptyExistingLoan,
  },
  coBorrowers: {
    flag: 'hasCoBorrower',
    title: 'Созаемщики',
    rowTitle: 'Созаемщик',
    addLabel: 'Добавить созаемщика',
    empty: emptyCoBorrower,
  },
} as const;

export type CreditArrayKey = keyof typeof CREDIT_ARRAYS;

// ── Пути ─────────────────────────────────────────────────────────────────────
const SEGMENTS = /[.[\]-]+/;

/** Путь DOM-контракта: `properties.0.type` / `properties[0].type` → `properties-0-type`. */
export const toDomPath = (path: string): string => path.split(SEGMENTS).filter(Boolean).join('-');

/**
 * Путь-шаблон поля: `coBorrowers.2.personalData.lastName`, `coBorrowers-2-personalData-lastName`
 * и сам шаблон `coBorrowers[].personalData.lastName` → `coBorrowers[].personalData.lastName`.
 * Пустой индекс `[]` шаблона сохраняется (раньше терялся при разбиении).
 */
export function toFieldPattern(path: string): string {
  let out = '';
  for (const seg of path
    .replace(/\[\]/g, '.[].')
    .split(/[.\]-]+|\[(?!\])/)
    .filter(Boolean)) {
    if (seg === '[' || seg === '[]' || /^\d+$/.test(seg)) out += '[]';
    else out += out ? `.${seg}` : seg;
  }
  return out;
}

/** Метаданные поля по любому пути (`properties.3.type`, `properties-3-type`, шаблону). */
export const fieldMeta = (path: string): FieldMeta =>
  (CREDIT_FIELDS as Record<string, FieldMeta>)[toFieldPattern(path)];

// ── Шаги визарда ─────────────────────────────────────────────────────────────
export interface CreditStep {
  title: string;
  /** Поля шага (пути-шаблоны) в порядке экрана: управляющие поля — раньше зависимых. */
  fields: readonly CreditFieldPath[];
  /** Ключи верхнего уровня — то, что проверяет «Далее» (группы и массивы целиком). */
  keys: readonly (keyof CreditInput)[];
  /** Вычисляемые поля, показанные на шаге. */
  computed: readonly (keyof CreditComputed)[];
}

const ALL_PATHS = Object.keys(CREDIT_FIELDS) as CreditFieldPath[];

function step(
  title: string,
  from: CreditFieldPath,
  to: CreditFieldPath,
  computed: readonly (keyof CreditComputed)[]
): CreditStep {
  const fields = ALL_PATHS.slice(ALL_PATHS.indexOf(from), ALL_PATHS.indexOf(to) + 1);
  const keys = [...new Set(fields.map((p) => p.split(/[.[]/)[0]))] as (keyof CreditInput)[];
  return { title, fields, keys, computed };
}

/** Шесть шагов (спека, «Поля формы»). `CREDIT_STEPS[i]` — шаг `i + 1`. */
export const CREDIT_STEPS: readonly CreditStep[] = [
  step('Основная информация о кредите', 'loanType', 'carPrice', [
    'initialPayment',
    'interestRate',
    'monthlyPayment',
  ]),
  step('Персональные данные', 'personalData.lastName', 'snils', ['fullName', 'age']),
  step('Контактная информация', 'phoneMain', 'residenceAddress.postalCode', []),
  step('Информация о занятости', 'employmentStatus', 'additionalIncomeSource', [
    'totalIncome',
    'paymentToIncomeRatio',
  ]),
  step('Дополнительная информация', 'maritalStatus', 'coBorrowers[].monthlyIncome', [
    'coBorrowersIncome',
  ]),
  step('Подтверждение и согласия', 'agreePersonalData', 'electronicSignature', []),
];

// ── Условия ──────────────────────────────────────────────────────────────────
export const isMortgage = (loanType: string): boolean => loanType === 'mortgage';
export const isCarLoan = (loanType: string): boolean => loanType === 'car';
export const isEmployed = (status: string): boolean => status === 'employed';
export const isSelfEmployed = (status: string): boolean => status === 'selfEmployed';
/** Адрес проживания вводится, только когда он не совпадает с адресом регистрации. */
export const livesElsewhere = (sameAsRegistration: boolean): boolean => !sameAsRegistration;
/** Источник доп. дохода обязателен при доходе > 0 (условная обязательность 🆕). */
export const needsIncomeSource = (additionalIncome: number | null): boolean =>
  additionalIncome != null && additionalIncome > 0;

/**
 * Условные поля (✅ «Условные поля», «Управление массивом»): при `visible === false` поле
 * размонтировано, не валидируется и равно начальному значению (массив — `[]`).
 *
 * `residenceAddress` при совпадении адресов — копия `registrationAddress` (CREDIT_COPIES); при
 * снятии флага поля проживания появляются пустыми.
 */
export const CREDIT_VISIBILITY: ReadonlyArray<{
  fields: readonly (keyof CreditInput)[];
  computed?: readonly (keyof CreditComputed)[];
  visible: (v: CreditInput) => boolean;
}> = [
  {
    fields: ['propertyValue'],
    computed: ['initialPayment'],
    visible: (v) => isMortgage(v.loanType),
  },
  {
    fields: ['carBrand', 'carModel', 'carYear', 'carPrice'],
    visible: (v) => isCarLoan(v.loanType),
  },
  {
    fields: ['companyName', 'companyInn', 'companyPhone', 'companyAddress', 'position'],
    visible: (v) => isEmployed(v.employmentStatus),
  },
  {
    fields: ['businessType', 'businessInn', 'businessActivity'],
    visible: (v) => isSelfEmployed(v.employmentStatus),
  },
  { fields: ['residenceAddress'], visible: (v) => livesElsewhere(v.sameAsRegistration) },
  { fields: ['properties'], visible: (v) => v.hasProperty },
  { fields: ['existingLoans'], visible: (v) => v.hasExistingLoans },
  {
    fields: ['coBorrowers'],
    computed: ['coBorrowersIncome'],
    visible: (v) => v.hasCoBorrower,
  },
];

/**
 * Копирование (✅): пока флаг установлен, цель равна источнику. `emailAdditional` при этом виден
 * и только для чтения (`readOnly`, не `disabled`); при снятии флага цель — начальное значение.
 */
export const CREDIT_COPIES = [
  { flag: 'sameEmail', source: 'email', target: 'emailAdditional' },
  { flag: 'sameAsRegistration', source: 'registrationAddress', target: 'residenceAddress' },
] as const;

/**
 * Сброс зависимых (🆕): изменение источника пользователем → цель к начальному значению (`''`).
 * Загрузка заявки сменой не считается. Для адреса проживания — так же: город — Select опций
 * региона, прежнее значение в новый список не входит.
 */
export const CREDIT_RESETS = [
  { source: 'carBrand', target: 'carModel' },
  { source: 'registrationAddress.region', target: 'registrationAddress.city' },
  { source: 'residenceAddress.region', target: 'residenceAddress.city' },
] as const;

/**
 * Перепроверка зависимого правила (🆕 «Ревалидация», BENCH-CONTRACT §3): после попытки «Далее» на
 * шаге изменение `source` перепроверяет `target`. Строки массива — в пределах своей строки.
 */
export const CREDIT_REVALIDATE = [
  { source: 'loanType', target: 'loanAmount' },
  { source: 'propertyValue', target: 'loanAmount' },
  { source: 'workExperienceTotal', target: 'workExperienceCurrent' },
  { source: 'additionalIncome', target: 'monthlyIncome' },
  { source: 'additionalIncome', target: 'additionalIncomeSource' },
  { source: 'existingLoans[].amount', target: 'existingLoans[].remainingAmount' },
] as const;

// ── Вычисляемые поля C.1–C.8 ─────────────────────────────────────────────────
const BASE_RATES: Record<LoanType, number> = {
  consumer: 15.5,
  mortgage: 8.5,
  car: 12.0,
  business: 18.0,
  refinancing: 14.0,
};
/** Ставка без выбранного типа кредита. */
const DEFAULT_RATE = 15.0;
/** Надбавка за ипотеку в регионе `moscow`. */
const MOSCOW_MORTGAGE_MARKUP = 0.5;
/** Скидка за имущество в залоге: флаг и хотя бы одна строка. */
const PROPERTY_DISCOUNT = 0.5;

/** C.1 Ставка (%): база по типу, +0.5 ипотека в Москве (регион регистрации), −0.5 за имущество. */
export function computeInterestRate(
  loanType: string,
  registrationRegion: string,
  hasProperty: boolean,
  propertyCount: number
): number {
  let rate = BASE_RATES[loanType as LoanType] ?? DEFAULT_RATE;
  if (isMortgage(loanType) && registrationRegion === 'moscow') rate += MOSCOW_MORTGAGE_MARKUP;
  if (hasProperty && propertyCount > 0) rate -= PROPERTY_DISCOUNT;
  return Math.max(rate, 0);
}

/** C.2 Ежемесячный платёж (₽), аннуитет P·i·(1+i)^n / ((1+i)^n − 1), округление до рубля. */
export function computeMonthlyPayment(
  loanAmount: number | null,
  loanTerm: number | null,
  interestRate: number
): number {
  if (loanAmount == null || loanTerm == null || loanAmount <= 0 || loanTerm <= 0) return 0;
  const i = interestRate / 12 / 100;
  if (i === 0) return Math.round(loanAmount / loanTerm);
  const growth = Math.pow(1 + i, loanTerm);
  return Math.round((loanAmount * i * growth) / (growth - 1));
}

/** C.3 Первоначальный взнос (₽): 20 % стоимости с округлением вверх; не ипотека — `null`. */
export function computeInitialPayment(
  loanType: string,
  propertyValue: number | null
): number | null {
  if (!isMortgage(loanType) || propertyValue == null || propertyValue <= 0) return null;
  return Math.ceil((propertyValue * INITIAL_PAYMENT_PERCENT) / 100);
}

/** C.4 «Фамилия Имя Отчество» — части обрезаны, пустые пропущены. */
export function computeFullName(p: {
  lastName: string;
  firstName: string;
  middleName: string;
}): string {
  return [p.lastName, p.firstName, p.middleName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** C.5 Полных лет на `today` (часы бенча); пустая или неполная дата — `null`. */
export function computeAge(birthDate: string, today: string = BENCH_TODAY): number | null {
  const b = ISO_DATE.exec(birthDate);
  const t = ISO_DATE.exec(today);
  if (!b || !t) return null;
  const [by, bm, bd] = b.slice(1).map(Number);
  const [ty, tm, td] = t.slice(1).map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** C.6 Общий доход (₽) = основной + дополнительный (по спеке, без созаёмщиков). */
export const computeTotalIncome = (
  monthlyIncome: number | null,
  additionalIncome: number | null
): number => (monthlyIncome ?? 0) + (additionalIncome ?? 0);

/** C.7 Платёж от дохода (%), округление до целого; без платежа или дохода — 0. */
export function computePaymentToIncomeRatio(monthlyPayment: number, totalIncome: number): number {
  if (monthlyPayment <= 0 || totalIncome <= 0) return 0;
  return Math.round((monthlyPayment / totalIncome) * 100);
}

/** C.8 Сумма доходов созаёмщиков (₽). */
export const computeCoBorrowersIncome = (
  coBorrowers: readonly { monthlyIncome: number | null }[]
): number => coBorrowers.reduce((sum, c) => sum + (c.monthlyIncome ?? 0), 0);

/** Все вычисляемые поля из ввода — по одной формуле на всех. */
export function computeCredit(v: CreditInput): CreditComputed {
  const interestRate = computeInterestRate(
    v.loanType,
    v.registrationAddress.region,
    v.hasProperty,
    v.properties.length
  );
  const monthlyPayment = computeMonthlyPayment(v.loanAmount, v.loanTerm, interestRate);
  const totalIncome = computeTotalIncome(v.monthlyIncome, v.additionalIncome);
  return {
    interestRate,
    monthlyPayment,
    initialPayment: computeInitialPayment(v.loanType, v.propertyValue),
    fullName: computeFullName(v.personalData),
    age: computeAge(v.personalData.birthDate),
    totalIncome,
    paymentToIncomeRatio: computePaymentToIncomeRatio(monthlyPayment, totalIncome),
    coBorrowersIncome: computeCoBorrowersIncome(v.coBorrowers),
  };
}

/** Начальные значения формы: ввод + вычисляемые из него. */
export const CREDIT_INITIAL: CreditValues = {
  ...CREDIT_INITIAL_INPUT,
  ...computeCredit(CREDIT_INITIAL_INPUT),
};

// ── Кросс-правила (🆕 «Кросс-валидация») ──────────────────────────────────────
/** `loanAmount.maxMortgage`: сумма ипотеки больше «стоимость − взнос». Нет данных — не нарушено. */
export function exceedsMortgageLimit(
  loanType: string,
  loanAmount: number | null,
  propertyValue: number | null
): boolean {
  const initial = computeInitialPayment(loanType, propertyValue);
  if (initial == null || propertyValue == null || loanAmount == null) return false;
  return loanAmount > propertyValue - initial;
}

/** `personalData.birthDate.minAge` / `.maxAge`: возраст вне 18–70 (включительно). */
export const isTooYoung = (birthDate: string): boolean => {
  const age = computeAge(birthDate);
  return age != null && age < AGE_MIN;
};
export const isTooOld = (birthDate: string): boolean => {
  const age = computeAge(birthDate);
  return age != null && age > AGE_MAX;
};

/** `workExperienceCurrent.maxTotal`. */
export const experienceExceedsTotal = (current: number | null, total: number | null): boolean =>
  current != null && total != null && current > total;

/** `existingLoans[].remainingAmount.maxAmount`. */
export const remainingExceedsAmount = (remaining: number | null, amount: number | null): boolean =>
  remaining != null && amount != null && remaining > amount;

/** `monthlyIncome.paymentRatio`: доля платежа (C.7) из всего ввода больше 50 %. */
export const paymentRatioTooHigh = (v: CreditInput): boolean =>
  computeCredit(v).paymentToIncomeRatio > PAYMENT_TO_INCOME_MAX;

// ── Число ⇄ значение input ───────────────────────────────────────────────────
/** Значение `input type="number"` (строка) → число формы: пусто или не число — `null`. */
export function parseNumberInput(raw: string | number | null | undefined): number | null {
  // Числа и пустое значение проходят как есть: библиотеки (RHF `setValueAs`) прогоняют через разбор
  // и значения, которые записывают сами (начальные, `setValue`), а не только строки из DOM.
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Число формы → значение `input type="number"`: `null` — пустая строка. */
export const formatNumberInput = (value: number | null | undefined): string =>
  value == null ? '' : String(value);

// ── Канонический payload ─────────────────────────────────────────────────────
const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean => v === true;

const I = CREDIT_INITIAL_INPUT;

const address = (a: CreditAddress): CreditAddress => ({
  region: str(a.region),
  city: str(a.city),
  street: str(a.street),
  house: str(a.house),
  apartment: str(a.apartment),
  postalCode: str(a.postalCode),
});

/**
 * Тело `POST /api/v1/credit-applications` из значений формы — одинаковое у всех реализаций
 * побайтно (порядок ключей фиксирован):
 * - строки обрезаны; числа — `number | null` (строка числа и `''` тоже принимаются); флаги — `=== true`;
 * - скрытые условием поля — начальное значение, выключенный массив — `[]` (CREDIT_VISIBILITY);
 * - копии: `emailAdditional` = `email` при `sameEmail`, `residenceAddress` = `registrationAddress`
 *   при `sameAsRegistration`;
 * - строки массивов — в порядке формы; вычисляемые поля C.1–C.8 — `computeCredit` от этого ввода
 *   (хранимые библиотекой вычисляемые значения игнорируются).
 */
export function toCreditPayload(v: CreditInput): CreditPayload {
  const mortgage = isMortgage(v.loanType);
  const car = isCarLoan(v.loanType);
  const employed = isEmployed(v.employmentStatus);
  const selfEmployed = isSelfEmployed(v.employmentStatus);
  const sameEmail = bool(v.sameEmail);
  const sameAsRegistration = bool(v.sameAsRegistration);
  const hasProperty = bool(v.hasProperty);
  const hasExistingLoans = bool(v.hasExistingLoans);
  const hasCoBorrower = bool(v.hasCoBorrower);
  const email = str(v.email);
  const registrationAddress = address(v.registrationAddress);

  const input: CreditInput = {
    loanType: str(v.loanType) as CreditInput['loanType'],
    loanAmount: num(v.loanAmount),
    loanTerm: num(v.loanTerm),
    loanPurpose: str(v.loanPurpose),
    propertyValue: mortgage ? num(v.propertyValue) : I.propertyValue,
    carBrand: car ? str(v.carBrand) : I.carBrand,
    carModel: car ? str(v.carModel) : I.carModel,
    carYear: car ? num(v.carYear) : I.carYear,
    carPrice: car ? num(v.carPrice) : I.carPrice,

    personalData: {
      lastName: str(v.personalData.lastName),
      firstName: str(v.personalData.firstName),
      middleName: str(v.personalData.middleName),
      birthDate: str(v.personalData.birthDate),
      gender: str(v.personalData.gender) as CreditPersonalData['gender'],
      birthPlace: str(v.personalData.birthPlace),
    },
    passportData: {
      series: str(v.passportData.series),
      number: str(v.passportData.number),
      issueDate: str(v.passportData.issueDate),
      issuedBy: str(v.passportData.issuedBy),
      departmentCode: str(v.passportData.departmentCode),
    },
    inn: str(v.inn),
    snils: str(v.snils),

    phoneMain: str(v.phoneMain),
    phoneAdditional: str(v.phoneAdditional),
    email,
    sameEmail,
    emailAdditional: sameEmail ? email : str(v.emailAdditional),
    registrationAddress,
    sameAsRegistration,
    residenceAddress: sameAsRegistration ? { ...registrationAddress } : address(v.residenceAddress),

    employmentStatus: str(v.employmentStatus) as EmploymentStatus,
    companyName: employed ? str(v.companyName) : I.companyName,
    companyInn: employed ? str(v.companyInn) : I.companyInn,
    companyPhone: employed ? str(v.companyPhone) : I.companyPhone,
    companyAddress: employed ? str(v.companyAddress) : I.companyAddress,
    position: employed ? str(v.position) : I.position,
    workExperienceTotal: num(v.workExperienceTotal),
    workExperienceCurrent: num(v.workExperienceCurrent),
    monthlyIncome: num(v.monthlyIncome),
    additionalIncome: num(v.additionalIncome),
    additionalIncomeSource: str(v.additionalIncomeSource),
    businessType: selfEmployed ? str(v.businessType) : I.businessType,
    businessInn: selfEmployed ? str(v.businessInn) : I.businessInn,
    businessActivity: selfEmployed ? str(v.businessActivity) : I.businessActivity,

    maritalStatus: str(v.maritalStatus) as MaritalStatus,
    dependents: num(v.dependents),
    education: str(v.education) as CreditInput['education'],
    hasProperty,
    properties: hasProperty
      ? v.properties.map((p) => ({
          type: str(p.type) as CreditProperty['type'],
          description: str(p.description),
          estimatedValue: num(p.estimatedValue),
          hasEncumbrance: bool(p.hasEncumbrance),
        }))
      : [],
    hasExistingLoans,
    existingLoans: hasExistingLoans
      ? v.existingLoans.map((l) => ({
          bank: str(l.bank),
          type: str(l.type),
          amount: num(l.amount),
          remainingAmount: num(l.remainingAmount),
          monthlyPayment: num(l.monthlyPayment),
          maturityDate: str(l.maturityDate),
        }))
      : [],
    hasCoBorrower,
    coBorrowers: hasCoBorrower
      ? v.coBorrowers.map((c) => ({
          personalData: {
            lastName: str(c.personalData.lastName),
            firstName: str(c.personalData.firstName),
            middleName: str(c.personalData.middleName),
            birthDate: str(c.personalData.birthDate),
          },
          phone: str(c.phone),
          email: str(c.email),
          relationship: str(c.relationship),
          monthlyIncome: num(c.monthlyIncome),
        }))
      : [],

    agreePersonalData: bool(v.agreePersonalData),
    agreeCreditHistory: bool(v.agreeCreditHistory),
    agreeMarketing: bool(v.agreeMarketing),
    agreeTerms: bool(v.agreeTerms),
    confirmAccuracy: bool(v.confirmAccuracy),
    electronicSignature: str(v.electronicSignature),
  };
  return { ...input, ...computeCredit(input) };
}
